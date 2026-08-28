from collections.abc import Iterator
from datetime import UTC, date, datetime
from pathlib import Path

import mongomock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from lifegoods.catalog import (
    EvidenceRecord,
    ExternalIdentifierRecord,
    IdentifierEvidenceLinkRecord,
    PackageVariantRecord,
    ProductRecord,
)
from lifegoods.core.concurrency import KeyedSlidingWindowLimiter
from lifegoods.core.database import Base
from lifegoods.core.settings import Settings
from lifegoods.identifiers import NormalizedIdentifier
from lifegoods.main import create_app
from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
    ExternalDatasetVersion,
    ExternalLookupResult,
    ExternalPackageNotFound,
    ExternalPackageUnavailable,
    ExternalSourceMetadata,
    ExternalSourceUnavailableReason,
    OpenFoodFactsDatasetSource,
)
from lifegoods.package_matches import PackageMatchCandidateResponse

PACKAGE_MATCH_FIXTURES = (
    Path(__file__).parents[2] / "evaluation" / "fixtures" / "package_matches"
)
DATASET_VERSION = ExternalDatasetVersion(
    id="dataset-2026-08-27",
    source_url="https://static.openfoodfacts.org/data/export.jsonl.gz",
    retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
    activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
    sha256="a" * 64,
)


class ConfirmedNoMatchSource:
    metadata = ExternalSourceMetadata(
        name="Open Food Facts",
        source_type="COMMUNITY_DATABASE",
        base_url="https://world.openfoodfacts.org",
        attribution="Open Food Facts contributors",
        database_license="ODbL",
        contents_license="Database Contents License",
        image_license="CC BY-SA",
    )

    def fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        return ExternalPackageNotFound(
            identifier=identifier.value,
            source=self.metadata,
            dataset_version=DATASET_VERSION,
        )


class UnavailableSource(ConfirmedNoMatchSource):
    def fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        return ExternalPackageUnavailable(
            identifier=identifier.value,
            reason=ExternalSourceUnavailableReason.DATASET_UNAVAILABLE,
        )


@pytest.mark.parametrize("fixture_name", ["off_complete.json", "off_sparse.json"])
def test_shared_off_candidate_fixtures_match_the_api_contract(fixture_name: str) -> None:
    PackageMatchCandidateResponse.model_validate_json(
        (PACKAGE_MATCH_FIXTURES / fixture_name).read_text()
    )


def evidence_record(number: int) -> EvidenceRecord:
    timestamp = datetime(2026, 8, 23, tzinfo=UTC)
    return EvidenceRecord(
        id=f"evidence-{number}",
        evidence_type="IDENTIFIER_OBSERVATION",
        source_name="LifeGoods test fixture",
        source_uri=f"https://example.test/evidence/{number}",
        language="und",
        observed_at=timestamp,
        retrieved_at=timestamp,
        license_name="TEST_FIXTURE",
        integrity_hash=f"sha256:test-{number}",
        storage_reference=f"fixture://identifier/{number}",
    )


@pytest.fixture
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
def client(session_factory: sessionmaker[Session]) -> Iterator[TestClient]:
    with TestClient(
        create_app(
            settings=Settings(project_catalog_enabled=True),
            session_factory=session_factory,
            external_source=ConfirmedNoMatchSource(),
        )
    ) as test_client:
        yield test_client


def test_valid_identifier_with_no_candidate_is_not_a_product_claim(client: TestClient) -> None:
    response = client.get("/api/v1/package-matches", params={"identifier": "4 006381 333931"})

    assert response.status_code == 200
    assert response.json() == {
        "normalized_identifier": "4006381333931",
        "scheme": "EAN_13",
        "candidates": [],
        "open_food_facts": {
            "status": "NOT_FOUND",
            "dataset_version": {
                "id": "dataset-2026-08-27",
                "source_url": "https://static.openfoodfacts.org/data/export.jsonl.gz",
                "retrieved_at": "2026-08-27T08:00:00Z",
                "activated_at": "2026-08-27T09:00:00Z",
                "sha256": "a" * 64,
            },
            "error_code": None,
        },
    }


def test_invalid_identifier_uses_the_stable_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/package-matches", params={"identifier": "1234"})

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "IDENTIFIER_LENGTH_UNSUPPORTED",
            "message": "The identifier is not a supported GTIN, EAN, or UPC length.",
        }
    }


def test_missing_identifier_uses_the_stable_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/package-matches")

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "IDENTIFIER_REQUIRED",
            "message": "An identifier is required.",
        }
    }


def test_missing_reference_image_url_uses_the_image_error_envelope(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/open-food-facts-images")

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "REFERENCE_IMAGE_URL_INVALID",
            "message": "A valid reference image URL is required.",
        }
    }


def test_reviewed_catalog_rows_are_not_read_by_package_match(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory.begin() as session:
        product = ProductRecord(id="product-1")
        variant = PackageVariantRecord(id="variant-1", product=product)
        evidence = evidence_record(1)
        identifier = ExternalIdentifierRecord(
            id="identifier-1",
            package_variant=variant,
            scheme="EAN_13",
            normalized_value="4006381333931",
            validation_state="VALID",
            production_method="HUMAN_ENTRY",
            review_state="ACCEPTED",
            confidence=1.0,
            primary_evidence=evidence,
            evidence_links=[IdentifierEvidenceLinkRecord(evidence=evidence, stance="SUPPORTS")],
        )
        session.add(identifier)

    response = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})

    assert response.status_code == 200
    assert response.json()["candidates"] == []


def test_project_catalog_is_disabled_by_default(
    session_factory: sessionmaker[Session],
) -> None:
    with session_factory.begin() as session:
        product = ProductRecord(id="product-disabled")
        variant = PackageVariantRecord(id="variant-disabled", product=product)
        evidence = evidence_record(99)
        session.add(
            ExternalIdentifierRecord(
                id="identifier-disabled",
                package_variant=variant,
                scheme="EAN_13",
                normalized_value="4006381333931",
                validation_state="VALID",
                production_method="HUMAN_ENTRY",
                review_state="ACCEPTED",
                confidence=1.0,
                primary_evidence=evidence,
                evidence_links=[
                    IdentifierEvidenceLinkRecord(evidence=evidence, stance="SUPPORTS")
                ],
            )
        )

    with TestClient(
        create_app(session_factory=session_factory, external_source=ConfirmedNoMatchSource())
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    assert response.json()["candidates"] == []


def test_off_candidate_exposes_active_dataset_version(
    session_factory: sessionmaker[Session],
) -> None:
    database = mongomock.MongoClient().lifegoods_off
    collection_name = "off_products_dataset_2026_08_27"
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": DATASET_VERSION.id,
            "collection_name": collection_name,
            "source_url": DATASET_VERSION.source_url,
            "retrieval_completed_at": DATASET_VERSION.retrieved_at,
            "activated_at": DATASET_VERSION.activated_at,
            "sha256": DATASET_VERSION.sha256,
            "status": "ACTIVE",
        }
    )
    database[CONTROL_COLLECTION].insert_one(
        {"_id": ACTIVE_POINTER_ID, "active_version_id": DATASET_VERSION.id}
    )
    database[collection_name].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Dataset product",
            "last_modified_t": 1787462400,
        }
    )

    with TestClient(
        create_app(
            session_factory=session_factory,
            external_source=OpenFoodFactsDatasetSource(database),
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["open_food_facts"]["status"] == "AVAILABLE"
    assert body["open_food_facts"]["dataset_version"]["id"] == DATASET_VERSION.id
    assert body["candidates"][0]["dataset_version"] == {
        "id": DATASET_VERSION.id,
        "source_url": DATASET_VERSION.source_url,
        "retrieved_at": "2026-08-27T08:00:00Z",
        "activated_at": "2026-08-27T09:00:00Z",
        "sha256": DATASET_VERSION.sha256,
    }
    assert body["candidates"][0]["source_revision"] == "1787462400"

    identifier_evidence = body["candidates"][0]["identity_evidence"][0]
    assert identifier_evidence["source_revision"] == "1787462400"


def test_dataset_unavailability_does_not_return_reviewed_candidates(
    session_factory: sessionmaker[Session],
) -> None:
    with session_factory.begin() as session:
        product = ProductRecord(id="product-1")
        variant = PackageVariantRecord(id="variant-1", product=product)
        evidence = evidence_record(1)
        session.add(
            ExternalIdentifierRecord(
                id="identifier-1",
                package_variant=variant,
                scheme="EAN_13",
                normalized_value="4006381333931",
                validation_state="VALID",
                production_method="HUMAN_ENTRY",
                review_state="ACCEPTED",
                confidence=1.0,
                primary_evidence=evidence,
                evidence_links=[
                    IdentifierEvidenceLinkRecord(evidence=evidence, stance="SUPPORTS")
                ],
            )
        )

    with TestClient(
        create_app(
            settings=Settings(project_catalog_enabled=True),
            session_factory=session_factory,
            external_source=UnavailableSource(),
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PACKAGE_MATCH_SOURCE_UNAVAILABLE"


def test_dataset_unavailability_without_reviewed_candidate_returns_503(
    session_factory: sessionmaker[Session],
) -> None:
    with TestClient(
        create_app(session_factory=session_factory, external_source=UnavailableSource())
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PACKAGE_MATCH_SOURCE_UNAVAILABLE"


def test_disputed_identifier_associations_remain_representable(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory.begin() as session:
        for number in (1, 2):
            product = ProductRecord(id=f"product-{number}")
            variant = PackageVariantRecord(id=f"variant-{number}", product=product)
            evidence = evidence_record(number)
            session.add(
                ExternalIdentifierRecord(
                    id=f"identifier-{number}",
                    package_variant=variant,
                    scheme="EAN_13",
                    normalized_value="4006381333931",
                    validation_state="VALID",
                    production_method="HUMAN_ENTRY",
                    review_state="DISPUTED",
                    confidence=None,
                    primary_evidence=evidence,
                    evidence_links=[
                        IdentifierEvidenceLinkRecord(evidence=evidence, stance="SUPPORTS")
                    ],
                )
            )

    response = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})

    assert response.status_code == 200
    assert response.json()["candidates"] == []


def test_rejected_or_not_yet_effective_identifiers_are_not_candidates(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory.begin() as session:
        evidence = evidence_record(1)
        session.add(
            ExternalIdentifierRecord(
                id="identifier-1",
                package_variant=PackageVariantRecord(
                    id="variant-1", product=ProductRecord(id="product-1")
                ),
                scheme="EAN_13",
                normalized_value="4006381333931",
                validation_state="VALID",
                production_method="HUMAN_ENTRY",
                review_state="REJECTED",
                confidence=1.0,
                effective_from=date(2099, 1, 1),
                primary_evidence=evidence,
                evidence_links=[IdentifierEvidenceLinkRecord(evidence=evidence, stance="SUPPORTS")],
            )
        )

    response = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})

    assert response.status_code == 200
    assert response.json()["candidates"] == []


def test_package_matches_returns_429_when_rate_limit_is_exceeded() -> None:
    clock = 100.0
    limiter = KeyedSlidingWindowLimiter(requests_per_minute=2, monotonic=lambda: clock)
    with TestClient(
        create_app(
            external_source=ConfirmedNoMatchSource(),
            package_match_limiter=limiter,
        )
    ) as client:
        # First 2 requests within limit succeed
        res1 = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})
        assert res1.status_code == 200

        clock = 120.0
        res2 = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})
        assert res2.status_code == 200

        # 3rd request exceeds limit
        clock = 130.0
        res3 = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})
        assert res3.status_code == 429
        assert res3.headers.get("retry-after") == "30"
        assert res3.json() == {
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please try again later.",
            }
        }


def test_package_matches_rate_limit_isolates_by_client_ip() -> None:
    clock = 100.0
    limiter = KeyedSlidingWindowLimiter(requests_per_minute=1, monotonic=lambda: clock)
    with TestClient(
        create_app(
            external_source=ConfirmedNoMatchSource(),
            package_match_limiter=limiter,
        )
    ) as client:
        # Request from client 1
        res1 = client.get(
            "/api/v1/package-matches",
            params={"identifier": "4006381333931"},
            headers={"x-forwarded-for": "10.0.0.1"},
        )
        assert res1.status_code == 200

        # Subsequent request from client 1 is rate limited
        res1_blocked = client.get(
            "/api/v1/package-matches",
            params={"identifier": "4006381333931"},
            headers={"x-forwarded-for": "10.0.0.1"},
        )
        assert res1_blocked.status_code == 429

        # Request from client 2 still succeeds
        res2 = client.get(
            "/api/v1/package-matches",
            params={"identifier": "4006381333931"},
            headers={"x-forwarded-for": "10.0.0.2"},
        )
        assert res2.status_code == 200

