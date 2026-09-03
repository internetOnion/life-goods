import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

import fakeredis
import httpx2 as httpx
import mongomock
import pytest
from fastapi.testclient import TestClient
from pymongo.errors import AutoReconnect
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from lifegoods.core.database import Base
from lifegoods.identifiers import normalize_identifier
from lifegoods.main import create_app
from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
    OpenFoodFactsDatasetSource,
)
from lifegoods.product_lookup import (
    InMemoryProductLookupCache,
    RedisProductLookupCache,
    RedisProductLookupRateLimiter,
    product_lookup_cache_key,
)

FIXTURES = Path(__file__).parent / "fixtures" / "open_food_facts"
VERSION_ID = "dataset-2026-08-27"
COLLECTION_NAME = "off_products_dataset_2026_08_27"
RETRIEVED_AT = datetime(2026, 8, 27, 8, 0, tzinfo=UTC)
ACTIVATED_AT = datetime(2026, 8, 27, 9, 0, tzinfo=UTC)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


def _dataset_database():
    database = mongomock.MongoClient().lifegoods_off
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": VERSION_ID,
            "collection_name": COLLECTION_NAME,
            "source_url": "https://static.openfoodfacts.org/data/export.jsonl.gz",
            "retrieval_completed_at": RETRIEVED_AT,
            "activated_at": ACTIVATED_AT,
            "sha256": "a" * 64,
            "status": "ACTIVE",
        }
    )
    database[CONTROL_COLLECTION].insert_one(
        {"_id": ACTIVE_POINTER_ID, "active_version_id": VERSION_ID}
    )
    return database


def _client(
    database,
    *,
    requests_per_minute: int = 60,
    redis_client=None,
    metrics=None,
    limiter=None,
    client_address: tuple[str, int] = ("testclient", 50000),
) -> TestClient:
    redis_client = redis_client or fakeredis.FakeRedis(decode_responses=True)
    source = OpenFoodFactsDatasetSource(database)
    app = create_app(
        session_factory=_session_factory(),
        external_source=source,
        product_lookup_source=source,
        product_lookup_cache=RedisProductLookupCache(redis_client, ttl_seconds=3600),
        product_lookup_limiter=(
            limiter
            if limiter is not None
            else RedisProductLookupRateLimiter(redis_client, requests_per_minute)
        ),
        product_lookup_metrics=metrics,
    )
    return TestClient(app, client=client_address)


def test_product_lookup_returns_complete_raw_source_record_with_provenance() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    payload["product"]["ecoscore_data"] = {
        "adjustments": [{"name": "origins_of_ingredients", "value": None}]
    }
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        response = client.get("/api/experimental/products/4006-3813-3393-1")

    assert response.status_code == 200
    expected_source_record = {
        key: value for key, value in payload["product"].items() if key != "_id"
    }
    assert response.json() == {
        "data": {"source_record": expected_source_record},
        "meta": {
            "lookup": {"barcode": "4006381333931"},
            "source": {
                "name": "Open Food Facts",
                "product_url": (
                    "https://world.openfoodfacts.org/product/4006381333931"
                ),
            },
            "dataset": {
                "version": VERSION_ID,
                "retrieved_at": "2026-08-27T08:00:00Z",
            },
        },
    }
    assert "_id" not in response.json()["data"]["source_record"]


def test_product_lookup_preserves_sparse_source_record_without_inference() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "sparse.json").read_text(encoding="utf-8"))
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        response = client.get("/api/experimental/products/8850000000003")

    expected = {key: value for key, value in payload["product"].items() if key != "_id"}
    assert response.status_code == 200
    assert response.json()["data"]["source_record"] == expected
    assert response.json()["data"]["source_record"]["quantity"] is None


@pytest.mark.parametrize(
    ("entered", "normalized"),
    [
        ("9638 5074", "96385074"),
        ("0-12345-67890-5", "012345678905"),
        ("4006 381 333931", "4006381333931"),
        ("1 0012345 000017", "10012345000017"),
    ],
)
def test_product_lookup_supports_each_barcode_length_at_the_http_boundary(
    entered: str,
    normalized: str,
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {"code": normalized, "product_name": "Known Product"}
    )

    with _client(database) as client:
        response = client.get(
            "/api/experimental/products/" + quote(entered, safe="-")
        )

    assert response.status_code == 200
    assert response.json()["meta"]["lookup"]["barcode"] == normalized


@pytest.mark.parametrize(
    "invalid_input",
    [
        "1234",  # unsupported length
        "4006381333932",  # invalid check digit
        "400638133393A",  # invalid characters
    ],
    ids=["unsupported-length", "invalid-check-digit", "invalid-characters"],
)
def test_invalid_barcode_uses_stable_error_and_never_enters_lookup_cache(
    invalid_input: str,
) -> None:
    database = _dataset_database()
    redis_client = fakeredis.FakeRedis(decode_responses=True)

    with _client(database, redis_client=redis_client) as client:
        response = client.get(
            "/api/experimental/products/" + quote(invalid_input, safe="")
        )

    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "invalid_barcode", "message": "Barcode is invalid"}
    }
    assert list(redis_client.scan_iter(match="product-lookup:cache:*")) == []


def test_unknown_product_identifies_the_dataset_snapshot_that_was_checked() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].create_index("code")

    with _client(database) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "product_not_found", "message": "Product not found"},
        "meta": {
            "dataset": {
                "version": VERSION_ID,
                "retrieved_at": "2026-08-27T08:00:00Z",
            }
        },
    }


@pytest.mark.parametrize(
    "break_dataset",
    [
        lambda database: database[CONTROL_COLLECTION].delete_many({}),
        lambda database: database[VERSIONS_COLLECTION].delete_many({}),
        lambda database: database[VERSIONS_COLLECTION].update_one(
            {"_id": VERSION_ID}, {"$set": {"status": "FAILED"}}
        ),
        lambda database: None,
    ],
    ids=["missing-pointer", "missing-manifest", "invalid-manifest", "missing-collection"],
)
def test_dataset_snapshot_faults_are_unavailable_instead_of_not_found(
    break_dataset,
) -> None:
    database = _dataset_database()
    break_dataset(database)

    with _client(database) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "dataset_unavailable",
            "message": "Dataset Snapshot is temporarily unavailable",
        }
    }


def test_mongodb_failure_is_reported_as_dataset_unavailable(monkeypatch) -> None:
    database = _dataset_database()

    def fail_lookup(*_args, **_kwargs):
        raise AutoReconnect("private database detail")

    monkeypatch.setattr(database[CONTROL_COLLECTION], "find_one", fail_lookup)
    with _client(database) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 503
    assert "private database detail" not in response.text


class RecordingMetrics:
    def __init__(self) -> None:
        self.events: list[dict[str, object]] = []

    def observe(self, **event: object) -> None:
        self.events.append(event)


def test_non_json_source_value_fails_with_a_sanitized_internal_error() -> None:
    database = _dataset_database()
    metrics = RecordingMetrics()
    database[COLLECTION_NAME].insert_one(
        {"code": "4006381333931", "storage_date": RETRIEVED_AT}
    )

    with _client(database, metrics=metrics) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "Product Lookup failed unexpectedly",
        }
    }
    assert metrics.events[0]["outcome"] == "internal_error"


class ExplodingLimiter:
    def try_acquire(self, _key: str) -> tuple[bool, int]:
        raise RuntimeError("private limiter detail")


class ExplodingMetrics:
    def observe(self, **_event: object) -> None:
        raise RuntimeError("private metrics detail")


@pytest.mark.parametrize(
    ("limiter", "metrics"),
    [
        (ExplodingLimiter(), None),
        (None, ExplodingMetrics()),
    ],
    ids=["limiter-failure", "metrics-failure"],
)
def test_unexpected_dependency_failure_uses_sanitized_internal_error(
    limiter,
    metrics,
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931"})

    with _client(database, limiter=limiter, metrics=metrics) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "Product Lookup failed unexpectedly",
        }
    }
    assert "private" not in response.text


def test_found_outcome_is_served_from_cache_after_source_record_changes() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {"code": "4006381333931", "product_name": "Original"}
    )
    redis_client = fakeredis.FakeRedis(decode_responses=True)

    with _client(database, redis_client=redis_client) as client:
        first = client.get("/api/experimental/products/4006381333931")
        database[COLLECTION_NAME].update_one(
            {"code": "4006381333931"}, {"$set": {"product_name": "Changed"}}
        )
        second = client.get("/api/experimental/products/4006381333931")

    assert first.json()["data"]["source_record"]["product_name"] == "Original"
    assert second.json() == first.json()


def test_not_found_outcome_is_served_from_cache_after_source_record_is_added() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].create_index("code")
    redis_client = fakeredis.FakeRedis(decode_responses=True)

    with _client(database, redis_client=redis_client) as client:
        first = client.get("/api/experimental/products/4006381333931")
        database[COLLECTION_NAME].insert_one(
            {"code": "4006381333931", "product_name": "Added later"}
        )
        second = client.get("/api/experimental/products/4006381333931")

    assert first.status_code == 404
    assert second.status_code == 404
    assert second.json() == first.json()


def test_cache_is_isolated_by_dataset_snapshot_version() -> None:
    database = _dataset_database()
    second_version = "dataset-2026-08-28"
    second_collection = "off_products_dataset_2026_08_28"
    database[COLLECTION_NAME].insert_one(
        {"code": "4006381333931", "product_name": "First snapshot"}
    )
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": second_version,
            "collection_name": second_collection,
            "source_url": "https://static.openfoodfacts.org/data/export.jsonl.gz",
            "retrieval_completed_at": datetime(2026, 8, 28, 8, 0, tzinfo=UTC),
            "activated_at": datetime(2026, 8, 28, 9, 0, tzinfo=UTC),
            "sha256": "b" * 64,
            "status": "ACTIVE",
        }
    )
    database[second_collection].insert_one(
        {"code": "4006381333931", "product_name": "Second snapshot"}
    )

    with _client(database) as client:
        first = client.get("/api/experimental/products/4006381333931")
        database[CONTROL_COLLECTION].update_one(
            {"_id": ACTIVE_POINTER_ID},
            {"$set": {"active_version_id": second_version}},
        )
        second = client.get("/api/experimental/products/4006381333931")

    assert first.json()["data"]["source_record"]["product_name"] == "First snapshot"
    assert second.json()["data"]["source_record"]["product_name"] == "Second snapshot"
    assert second.json()["meta"]["dataset"]["version"] == second_version


def test_malformed_cache_entry_is_repaired_from_dataset_snapshot() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {"code": "4006381333931", "product_name": "Authoritative"}
    )
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    key = product_lookup_cache_key(
        VERSION_ID, normalize_identifier("4006381333931")
    )
    redis_client.set(key, "not-json")

    with _client(database, redis_client=redis_client) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 200
    assert response.json()["data"]["source_record"]["product_name"] == "Authoritative"
    repaired_cache_value = redis_client.get(key)
    assert isinstance(repaired_cache_value, str)
    assert json.loads(repaired_cache_value)["outcome"] == "found"


def test_redis_cache_outage_falls_through_without_logging_shopper_data(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Do not log this Source Record",
        }
    )
    server = fakeredis.FakeServer()
    redis_client = fakeredis.FakeRedis(server=server, decode_responses=True)
    server.connected = False
    for logger_name in (
        "lifegoods.product_lookup.cache",
        "lifegoods.product_lookup.rate_limit",
        "lifegoods.product_lookup.router",
    ):
        monkeypatch.setattr(logging.getLogger(logger_name), "disabled", False)

    with (
        caplog.at_level("INFO"),
        _client(database, redis_client=redis_client) as client,
    ):
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 200
    product_lookup_records = [
        record
        for record in caplog.records
        if record.name.startswith("lifegoods.product_lookup")
    ]
    messages = " ".join(record.getMessage() for record in product_lookup_records)
    extras = " ".join(
        str(
            {
                key: value
                for key, value in record.__dict__.items()
                if key
                in {
                    "event",
                    "outcome",
                    "cache_status",
                    "dataset_version",
                    "failure_category",
                }
            }
        )
        for record in product_lookup_records
    )
    logged = messages + extras
    assert "4006381333931" not in logged
    assert "Do not log this Source Record" not in logged
    assert "testclient" not in logged
    assert "product_lookup_cache_failure" in logged
    assert "product_lookup_completed" in logged


def test_in_memory_cache_expires_at_the_http_seam() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {"code": "4006381333931", "product_name": "Before expiry"}
    )
    clock = 10.0
    cache = InMemoryProductLookupCache(ttl_seconds=5, monotonic=lambda: clock)
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    source = OpenFoodFactsDatasetSource(database)
    app = create_app(
        session_factory=_session_factory(),
        external_source=source,
        product_lookup_source=source,
        product_lookup_cache=cache,
        product_lookup_limiter=RedisProductLookupRateLimiter(redis_client, 60),
    )

    with TestClient(app) as client:
        first = client.get("/api/experimental/products/4006381333931")
        database[COLLECTION_NAME].update_one(
            {"code": "4006381333931"},
            {"$set": {"product_name": "After expiry"}},
        )
        cached = client.get("/api/experimental/products/4006381333931")
        clock = 15.0
        refreshed = client.get("/api/experimental/products/4006381333931")

    assert first.json()["data"]["source_record"]["product_name"] == "Before expiry"
    assert cached.json()["data"]["source_record"]["product_name"] == "Before expiry"
    assert refreshed.json()["data"]["source_record"]["product_name"] == "After expiry"


def test_rate_limit_applies_before_validation_and_returns_retry_after() -> None:
    database = _dataset_database()
    redis_client = fakeredis.FakeRedis(decode_responses=True)

    with _client(
        database, redis_client=redis_client, requests_per_minute=1
    ) as client:
        invalid = client.get("/api/experimental/products/1234")
        limited = client.get("/api/experimental/products/4006381333931")

    assert invalid.status_code == 422
    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "60"
    assert limited.json() == {
        "error": {
            "code": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
        }
    }
    assert list(redis_client.scan_iter(match="product-lookup:cache:*")) == []


def test_rate_limit_isolated_by_client_and_ignores_forwarded_headers() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].create_index("code")
    server = fakeredis.FakeServer()
    first_redis = fakeredis.FakeRedis(server=server, decode_responses=True)
    second_redis = fakeredis.FakeRedis(server=server, decode_responses=True)

    with _client(
        database,
        redis_client=first_redis,
        requests_per_minute=1,
        client_address=("203.0.113.10", 50000),
    ) as first_client:
        first = first_client.get(
            "/api/experimental/products/4006381333931",
            headers={"x-forwarded-for": "10.0.0.1"},
        )
        spoofed = first_client.get(
            "/api/experimental/products/4006381333931",
            headers={"x-forwarded-for": "10.0.0.2"},
        )
    with _client(
        database,
        redis_client=second_redis,
        requests_per_minute=1,
        client_address=("203.0.113.11", 50000),
    ) as second_client:
        isolated = second_client.get("/api/experimental/products/4006381333931")

    assert first.status_code == 404
    assert spoofed.status_code == 429
    assert isolated.status_code == 404
    rate_limit_keys = [str(key) for key in first_redis.scan_iter(
        match="product-lookup:rate-limit:*"
    )]
    assert len(rate_limit_keys) == 2
    assert all("203.0.113" not in key for key in rate_limit_keys)


def test_metrics_are_aggregate_and_exclude_barcode_and_client_address() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931"})
    metrics = RecordingMetrics()

    with _client(database, metrics=metrics) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 200
    assert metrics.events == [
        {
            "outcome": "found",
            "latency_ms": metrics.events[0]["latency_ms"],
            "cache_status": "miss",
            "dataset_version": VERSION_ID,
        }
    ]
    assert "4006381333931" not in str(metrics.events)
    assert "testclient" not in str(metrics.events)


def test_uvicorn_access_log_redacts_product_lookup_path_and_client_address(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = _dataset_database()
    access_logger = logging.getLogger("uvicorn.access")
    monkeypatch.setattr(access_logger, "disabled", False)

    with (
        caplog.at_level("INFO", logger=access_logger.name),
        _client(database),
    ):
        access_logger.info(
            '%s - "%s %s HTTP/%s" %d',
            "203.0.113.42:50000",
            "GET",
            "/api/experimental/products/4006381333931",
            "1.1",
            200,
        )

    message = caplog.records[-1].getMessage()
    assert "4006381333931" not in message
    assert "203.0.113.42" not in message
    assert "/api/experimental/products/[redacted]" in message


@pytest.mark.parametrize(
    ("scenario", "expected_status"),
    [
        ("success-cache-miss", 200),
        ("not-found", 404),
        ("dataset-unavailable", 503),
    ],
)
def test_product_lookup_never_sends_an_outbound_http_request(
    scenario: str,
    expected_status: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = _dataset_database()
    if scenario == "success-cache-miss":
        database[COLLECTION_NAME].insert_one({"code": "4006381333931"})
    elif scenario == "not-found":
        database[COLLECTION_NAME].create_index("code")
    else:
        database[CONTROL_COLLECTION].delete_many({})

    original_send = httpx.Client.send

    def guard_outbound(client, request, *args, **kwargs):
        if isinstance(client, TestClient):
            return original_send(client, request, *args, **kwargs)
        raise AssertionError("Product Lookup attempted an outbound HTTP request")

    monkeypatch.setattr(httpx.Client, "send", guard_outbound)
    with _client(database) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == expected_status
