import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event, Lock

import httpx
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, inspect, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from lifegoods.adapters.catalog_models import (
    ExternalFieldEvidenceRecord,
    ExternalSnapshotRecord,
    ExternalSourceRecord,
)
from lifegoods.adapters.database import Base
from lifegoods.adapters.external_snapshot_repository import (
    SqlAlchemyExternalSnapshotRepository,
)
from lifegoods.adapters.open_food_facts import OpenFoodFactsPackageSource
from lifegoods.adapters.package_match_repository import SqlAlchemyPackageMatchRepository
from lifegoods.application.package_matches import FindPackageMatches
from lifegoods.main import create_app
from lifegoods.matching.external_requests import ExternalLookupLocks, SlidingWindowRequestBudget
from lifegoods.matching.external_source import (
    ExternalLookupResult,
    ExternalPackageFound,
    ExternalPackageRecord,
    ExternalSourceMetadata,
)
from lifegoods.matching.identifier import NormalizedIdentifier

FIXTURES = Path(__file__).parent / "fixtures" / "open_food_facts"
COMPLETE_RESPONSE = (FIXTURES / "complete.json").read_bytes()
SPARSE_RESPONSE = (FIXTURES / "sparse.json").read_bytes()


class MutableClock:
    def __init__(self) -> None:
        self.value = datetime(2026, 8, 24, 10, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.value

    def advance(self, delta: timedelta) -> None:
        self.value += delta


def memory_session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


def test_found_snapshot_is_persisted_reused_and_refreshed() -> None:
    clock = MutableClock()
    request_count = 0

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(200, content=COMPLETE_RESPONSE)

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(respond)),
        utc_now=clock.now,
    )
    factory = memory_session_factory()
    with TestClient(
        create_app(session_factory=factory, external_source=source, utc_now=clock.now)
    ) as client:
        first = client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )
        second = client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )
        clock.advance(timedelta(hours=24, seconds=1))
        refreshed = client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert first.status_code == second.status_code == refreshed.status_code == 200
    assert request_count == 2
    candidate = first.json()["candidates"][0]
    assert candidate["source_kind"] == "OPEN_FOOD_FACTS"
    assert candidate["external_record_id"] == "4006381333931"
    assert candidate["source"] == {
        "name": "Open Food Facts",
        "source_type": "COMMUNITY_DATABASE",
        "base_url": "https://world.openfoodfacts.org",
        "record_url": "https://world.openfoodfacts.org/product/4006381333931",
        "attribution": "Open Food Facts contributors",
        "database_license": "ODbL",
        "contents_license": "Database Contents License",
        "image_license": "CC BY-SA",
        "terms_version": None,
    }
    assert candidate["is_current"] is True
    assert candidate["source_revision"] == "1787462400"
    assert {item["field"] for item in candidate["identity_evidence"]} >= {
        "name",
        "brands",
        "quantity",
    }
    assert candidate["reference_images"]
    reference_image = candidate["reference_images"][0]
    assert reference_image["url"].startswith("/api/v1/open-food-facts-images?url=")
    assert reference_image["source_url"] == (
        "https://world.openfoodfacts.org/product/4006381333931"
    )
    assert reference_image["retrieved_at"] == "2026-08-24T10:00:00Z"
    assert "raw_response" not in json.dumps(first.json())

    with factory() as session:
        snapshots = session.scalars(
            select(ExternalSnapshotRecord).order_by(ExternalSnapshotRecord.retrieved_at)
        ).all()
        assert len(snapshots) == 2
        assert snapshots[0].raw_response_hash == hashlib.sha256(COMPLETE_RESPONSE).hexdigest()
        assert snapshots[0].raw_response["status"] == "success"
        assert snapshots[0].retrieved_at != snapshots[1].retrieved_at
        assert session.scalar(select(func.count()).select_from(ExternalSourceRecord)) == 1
        field_rows = session.scalars(select(ExternalFieldEvidenceRecord)).all()
        assert field_rows
        assert all(row.source_field and row.source_uri and row.retrieved_at for row in field_rows)


def test_expired_snapshot_is_not_returned_when_refresh_is_unavailable() -> None:
    clock = MutableClock()
    request_count = 0

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        if request_count == 1:
            return httpx.Response(200, content=COMPLETE_RESPONSE)
        return httpx.Response(503, json={"status": "failure"})

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(respond)),
        utc_now=clock.now,
    )
    factory = memory_session_factory()
    with TestClient(
        create_app(session_factory=factory, external_source=source, utc_now=clock.now)
    ) as client:
        assert (
            client.get(
                "/api/v1/package-matches", params={"identifier": "4006381333931"}
            ).status_code
            == 200
        )
        clock.advance(timedelta(hours=24, seconds=1))
        unavailable = client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert unavailable.status_code == 503
    assert unavailable.json()["error"]["code"] == "PACKAGE_MATCH_SOURCE_UNAVAILABLE"
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(ExternalSnapshotRecord)) == 1


def test_confirmed_no_match_is_persisted_briefly_then_retried() -> None:
    clock = MutableClock()
    request_count = 0

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(404, json={"result": {"id": "product_not_found"}})

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(respond)),
        utc_now=clock.now,
    )
    factory = memory_session_factory()
    with TestClient(
        create_app(session_factory=factory, external_source=source, utc_now=clock.now)
    ) as client:
        first = client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )
        second = client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )
        clock.advance(timedelta(minutes=15, seconds=1))
        third = client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert first.json()["candidates"] == second.json()["candidates"] == []
    assert third.status_code == 200
    assert request_count == 2
    with factory() as session:
        snapshots = session.scalars(select(ExternalSnapshotRecord)).all()
        assert len(snapshots) == 2
        assert {snapshot.outcome for snapshot in snapshots} == {"NOT_FOUND"}


def test_sparse_record_omits_missing_fields_instead_of_creating_negative_evidence() -> None:
    sparse_payload = json.loads(SPARSE_RESPONSE)
    sparse_payload["product"]["code"] = "8850000000003"
    source = OpenFoodFactsPackageSource(
        httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(200, json=sparse_payload)
            )
        )
    )
    factory = memory_session_factory()
    with TestClient(create_app(session_factory=factory, external_source=source)) as client:
        response = client.get(
            "/api/v1/package-matches", params={"identifier": "8850000000003"}
        )

    assert response.status_code == 200
    candidate = response.json()["candidates"][0]
    assert {item["field"] for item in candidate["identity_evidence"]} == {"name"}
    assert {item["field"] for item in candidate["label_evidence"]} == {
        "packaging_languages"
    }
    assert candidate["reference_images"] == []


def test_default_request_budget_rejects_thirteenth_cold_lookup_without_calling_off() -> None:
    request_count = 0

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(404, json={"result": {"id": "product_not_found"}})

    source = OpenFoodFactsPackageSource(httpx.Client(transport=httpx.MockTransport(respond)))
    factory = memory_session_factory()
    with TestClient(create_app(session_factory=factory, external_source=source)) as client:
        responses = [
            client.get("/api/v1/package-matches", params={"identifier": identifier})
            for identifier in _valid_ean13_identifiers(13)
        ]

    assert [response.status_code for response in responses[:12]] == [200] * 12
    assert responses[12].status_code == 503
    assert request_count == 12


def test_concurrent_cold_lookups_share_one_external_request(tmp_path: Path) -> None:
    database_path = tmp_path / "concurrent.db"
    engine = create_engine(
        f"sqlite+pysqlite:///{database_path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    source = BlockingFoundSource()
    budget = SlidingWindowRequestBudget(12)
    locks = ExternalLookupLocks()

    def execute_lookup() -> object:
        with factory() as session:
            finder = FindPackageMatches(
                SqlAlchemyPackageMatchRepository(session),
                SqlAlchemyExternalSnapshotRepository(session),
                source,
                budget,
                locks,
                utc_now=source.retrieved_at,
            )
            return finder.execute("4006381333931")

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(execute_lookup)
        assert source.started.wait(timeout=2)
        second = executor.submit(execute_lookup)
        source.release.set()
        assert first.result(timeout=2).candidates
        assert second.result(timeout=2).candidates

    assert source.request_count == 1
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(ExternalSnapshotRecord)) == 1


def test_migrations_apply_external_snapshot_schema_to_empty_database(
    tmp_path: Path, monkeypatch: object
) -> None:
    database_path = tmp_path / "migrations.db"
    monkeypatch.setenv(
        "LIFEGOODS_DATABASE_URL", f"sqlite+pysqlite:///{database_path}"
    )
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    command.upgrade(config, "head")

    table_names = set(inspect(create_engine(f"sqlite+pysqlite:///{database_path}")).get_table_names())
    assert {"external_sources", "external_snapshots", "external_field_evidence"} <= table_names


class BlockingFoundSource:
    metadata = ExternalSourceMetadata(
        name="Open Food Facts",
        source_type="COMMUNITY_DATABASE",
        base_url="https://world.openfoodfacts.org",
        attribution="Open Food Facts contributors",
        database_license="ODbL",
        contents_license="Database Contents License",
        image_license="CC BY-SA",
    )

    def __init__(self) -> None:
        self.started = Event()
        self.release = Event()
        self._count_lock = Lock()
        self.request_count = 0
        self._retrieved_at = datetime(2026, 8, 24, 10, 0, tzinfo=UTC)

    def retrieved_at(self) -> datetime:
        return self._retrieved_at

    def fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        with self._count_lock:
            self.request_count += 1
        self.started.set()
        assert self.release.wait(timeout=2)
        return ExternalPackageFound(
            record=ExternalPackageRecord(
                identifier=identifier.value,
                source_record_id=identifier.value,
                request_url=(
                    f"https://world.openfoodfacts.org/api/v3/product/{identifier.value}.json"
                ),
                source_url=f"https://world.openfoodfacts.org/product/{identifier.value}",
                retrieved_at=self._retrieved_at,
                source_revision="1",
                raw_response=b'{"status":"success","product":{"code":"4006381333931"}}',
                source=self.metadata,
                names=(),
                brands=None,
                quantity=None,
                selected_images=(),
                ingredient_texts=(),
                allergen_declaration=None,
                allergen_tags=None,
                trace_declaration=None,
                trace_tags=None,
                nutrition=(),
                packaging_languages=None,
                countries_sold=None,
            )
        )


def _valid_ean13_identifiers(count: int) -> list[str]:
    return [_ean13(f"123456789{index:03d}") for index in range(count)]


def _ean13(first_twelve_digits: str) -> str:
    weighted_sum = sum(
        int(digit) * (1 if index % 2 == 0 else 3)
        for index, digit in enumerate(first_twelve_digits)
    )
    return f"{first_twelve_digits}{(-weighted_sum) % 10}"
