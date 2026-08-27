import gzip
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import mongomock
import pytest

from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
)
from lifegoods.open_food_facts.cli import (
    DatasetImportError,
    activate_version,
    import_url,
    list_versions,
    prune_versions,
    rollback_version,
)

SOURCE_URL = "https://static.openfoodfacts.test/products.jsonl.gz"
PROBE_CODE = "4006381333931"
SAMPLE_DATASET = (
    Path(__file__).parent / "fixtures" / "open_food_facts" / "dataset-sample.jsonl"
)


def clock(start: datetime):
    current = start

    def now() -> datetime:
        nonlocal current
        value = current
        current += timedelta(seconds=1)
        return value

    return now


def export_bytes(products: list[dict[str, object]]) -> bytes:
    content = b"\n".join(json.dumps(product).encode() for product in products) + b"\n"
    return gzip.compress(content, mtime=0)


def http_client(content: bytes) -> httpx.Client:
    return httpx.Client(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(200, stream=httpx.ByteStream(content))
        )
    )


def product(code: str, *, name: str = "Test product") -> dict[str, object]:
    return {
        "code": code,
        "product_name": name,
        "schema_version": 1003,
        "nested": {"kept": [1, 2, 3]},
    }


def test_import_streams_hashes_validates_and_preserves_full_documents() -> None:
    database = mongomock.MongoClient().lifegoods_off
    compressed = gzip.compress(SAMPLE_DATASET.read_bytes(), mtime=0)
    progress: list[dict[str, int | float]] = []

    manifest = import_url(
        database,
        SOURCE_URL,
        probe_codes=(PROBE_CODE,),
        client=http_client(compressed),
        now=clock(datetime(2026, 8, 27, tzinfo=UTC)),
        batch_size=1,
        progress=progress.append,
        progress_interval_seconds=0.001,
    )

    assert manifest["status"] == "READY"
    assert manifest["byte_count"] == len(compressed)
    assert manifest["document_count"] == manifest["inserted_count"] == 2
    assert manifest["malformed_count"] == manifest["duplicate_count"] == 0
    assert manifest["schema_versions"] == [1003]
    assert len(manifest["sha256"]) == 64
    stored = database[manifest["collection_name"]].find_one({"code": PROBE_CODE})
    assert stored is not None
    assert stored["brands"] == "LifeGoods fixture"
    assert "uq_off_code" in database[manifest["collection_name"]].index_information()
    assert progress[-1]["byte_count"] == len(compressed)
    assert progress[-1]["document_count"] == 2
    assert progress[-1]["inserted_count"] == 2


@pytest.mark.parametrize(
    "content, expected",
    [
        (gzip.compress(b"not-json\n", mtime=0), "Malformed documents: 1"),
        (
            export_bytes([product(PROBE_CODE), product(PROBE_CODE, name="Duplicate")]),
            "Duplicate product codes: 1",
        ),
        (export_bytes([product("8850000000003")]), "Known barcode probes missing"),
        (gzip.compress(b"", mtime=0), "contained no product data"),
    ],
)
def test_invalid_import_never_becomes_ready(content: bytes, expected: str) -> None:
    database = mongomock.MongoClient().lifegoods_off

    with pytest.raises(DatasetImportError, match=expected):
        import_url(
            database,
            SOURCE_URL,
            probe_codes=(PROBE_CODE,),
            client=http_client(content),
        )

    manifest = database[VERSIONS_COLLECTION].find_one({})
    assert manifest is not None
    assert manifest["status"] == "FAILED"
    assert database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID}) is None


def test_incomplete_gzip_stream_is_rejected() -> None:
    database = mongomock.MongoClient().lifegoods_off
    truncated = export_bytes([product(PROBE_CODE)])[:-5]

    with pytest.raises(DatasetImportError, match="gzip stream ended"):
        import_url(
            database,
            SOURCE_URL,
            probe_codes=(PROBE_CODE,),
            client=http_client(truncated),
        )


def test_activation_rollback_and_prune_preserve_active_and_previous() -> None:
    database = mongomock.MongoClient().lifegoods_off
    now = clock(datetime(2026, 8, 27, tzinfo=UTC))
    first = import_url(
        database,
        SOURCE_URL,
        probe_codes=(PROBE_CODE,),
        client=http_client(export_bytes([product(PROBE_CODE, name="First")])),
        now=now,
    )
    activate_version(database, first["_id"], now=now)
    second = import_url(
        database,
        SOURCE_URL,
        probe_codes=(PROBE_CODE,),
        client=http_client(export_bytes([product(PROBE_CODE, name="Second")])),
        now=now,
    )
    activate_version(database, second["_id"], now=now)

    pointer = database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID})
    assert pointer is not None
    assert pointer["active_version_id"] == second["_id"]
    assert pointer["previous_version_id"] == first["_id"]
    assert prune_versions(database) == []

    active = rollback_version(database, now=now)
    assert active["_id"] == first["_id"]
    assert active["status"] == "ACTIVE"
    assert len(list_versions(database)) == 2
