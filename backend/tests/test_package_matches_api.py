import logging
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
from lifegoods.package_matches import (
    AllergenFinding,
    PackageMatchCandidateResponse,
    StandardAllergenAssessmentEvaluator,
)
from lifegoods.reference_datasets import DatabaseAllergenReferenceDataAccess
from lifegoods.reference_datasets.bundle import ReferenceBundle
from lifegoods.reference_datasets.importer import import_reference_bundle
from lifegoods.reference_datasets.lifecycle import activate_reference_dataset_version
from lifegoods.reference_datasets.models import ReferenceDatasetVersionRecord

PACKAGE_MATCH_FIXTURES = (
    Path(__file__).parents[2] / "evaluation" / "fixtures" / "package_matches"
)
CODEX_MINIMAL_BUNDLE_PATH = (
    Path(__file__).parents[1]
    / "src"
    / "lifegoods"
    / "reference_datasets"
    / "bundles"
    / "codex_2026_food_allergen_minimal.json"
)
CODEX_REVIEWED_ENGLISH_BUNDLE_PATH = (
    Path(__file__).parents[1]
    / "src"
    / "lifegoods"
    / "reference_datasets"
    / "bundles"
    / "codex_2026_food_allergen_reviewed_english_v1.json"
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


class FailingMatcher:
    def match(self, **_kwargs: object) -> tuple[AllergenFinding, ...]:
        raise RuntimeError("matcher failed")


def off_source_with_record(**overrides: object) -> OpenFoodFactsDatasetSource:
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
    record: dict[str, object] = {
        "code": "4006381333931",
        "product_name_en": "Dark chocolate",
        "ingredients_text_en": "Cocoa mass, sugar, cocoa butter, milk powder",
        "allergens": "Contains milk",
        "allergens_tags": ["en:milk"],
        "last_modified_t": 1787462400,
    }
    record.update(overrides)
    database[collection_name].insert_one(record)
    return OpenFoodFactsDatasetSource(database)


@pytest.mark.parametrize("fixture_name", ["off_complete.json", "off_sparse.json"])
def test_shared_off_candidate_fixtures_match_the_api_contract(fixture_name: str) -> None:
        PackageMatchCandidateResponse.model_validate_json(
            (PACKAGE_MATCH_FIXTURES / fixture_name).read_text(encoding="utf-8")
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
            settings=Settings(allergen_assessments_enabled=False),
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
    assert body["candidates"][0]["allergen_assessment"] == {
        "status": "NOT_ASSESSED",
        "reason": "FEATURE_DISABLED",
        "evidence_coverage": "NOT_ASSESSED",
        "engine_version": None,
        "reference_dataset_version": None,
        "concepts": [],
        "findings": [],
        "source_signals": [],
    }

    identifier_evidence = body["candidates"][0]["identity_evidence"][0]
    assert identifier_evidence["source_revision"] == "1787462400"


@pytest.mark.parametrize("reference_state", ["MISSING", "INVALID"])
def test_assessment_reference_unavailability_preserves_package_match_http_200(
    reference_state: str,
    session_factory: sessionmaker[Session],
) -> None:
    if reference_state == "INVALID":
        bundle = ReferenceBundle.from_json_file(CODEX_MINIMAL_BUNDLE_PATH)
        with session_factory() as session:
            import_reference_bundle(session, bundle)
            activate_reference_dataset_version(session, bundle.manifest.id)
            version = session.get(ReferenceDatasetVersionRecord, bundle.manifest.id)
            assert version is not None
            version.validation_errors = ["release invalidated for test"]
            session.commit()

    with TestClient(
        create_app(
            settings=Settings(
                allergen_assessments_enabled=True,
                assessment_cache_enabled=False,
            ),
            session_factory=session_factory,
            external_source=off_source_with_record(),
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    candidate = response.json()["candidates"][0]
    assert candidate["external_record_id"] == "4006381333931"
    assert candidate["allergen_assessment"]["status"] == "NOT_ASSESSED"
    assert candidate["allergen_assessment"]["reason"] == "REFERENCE_UNAVAILABLE"
    assert candidate["allergen_assessment"]["concepts"] == []
    assert candidate["allergen_assessment"]["findings"] == []


def test_matcher_failure_is_isolated_from_package_match_and_forbidden_verdicts(
    session_factory: sessionmaker[Session],
) -> None:
    bundle = ReferenceBundle.from_json_file(CODEX_MINIMAL_BUNDLE_PATH)
    with session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(session, bundle.manifest.id)

    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=DatabaseAllergenReferenceDataAccess(session_factory),
        matcher=FailingMatcher(),
    )
    with TestClient(
        create_app(
            settings=Settings(assessment_cache_enabled=False),
            session_factory=session_factory,
            external_source=off_source_with_record(),
            allergen_evaluator=evaluator,
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    candidate = response.json()["candidates"][0]
    assert candidate["external_record_id"] == "4006381333931"
    assessment = candidate["allergen_assessment"]
    assert assessment["status"] == "NOT_ASSESSED"
    assert assessment["reason"] == "ASSESSMENT_FAILED"
    assert assessment["reference_dataset_version"]["id"] == bundle.manifest.id
    assert assessment["concepts"] == []
    assert assessment["findings"] == []
    assert {signal["field"] for signal in assessment["source_signals"]} == {
        "allergen_declaration",
        "allergen_tags",
    }
    for forbidden_verdict in (
        "allergen-free",
        "no-allergen",
        "compliance",
        "medical",
        "personalized-harm",
        "cross-contact",
        "purchase verdict",
    ):
        assert forbidden_verdict not in response.text.lower()


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


def test_package_matches_rate_limit_ignores_spoofed_forwarded_for() -> None:
    clock = 100.0
    limiter = KeyedSlidingWindowLimiter(requests_per_minute=1, monotonic=lambda: clock)
    with TestClient(
        create_app(
            external_source=ConfirmedNoMatchSource(),
            package_match_limiter=limiter,
        )
    ) as client:
        res1 = client.get(
            "/api/v1/package-matches",
            params={"identifier": "4006381333931"},
            headers={"x-forwarded-for": "10.0.0.1"},
        )
        assert res1.status_code == 200

        res1_blocked = client.get(
            "/api/v1/package-matches",
            params={"identifier": "4006381333931"},
            headers={"x-forwarded-for": "10.0.0.2"},
        )
        assert res1_blocked.status_code == 429


def test_package_matches_rate_limit_isolates_asgi_client_addresses() -> None:
    limiter = KeyedSlidingWindowLimiter(requests_per_minute=1)
    app = create_app(
        external_source=ConfirmedNoMatchSource(),
        package_match_limiter=limiter,
    )

    with TestClient(app, client=("10.0.0.1", 50000)) as first_client:
        assert first_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        ).status_code == 200
        assert first_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        ).status_code == 429

    with TestClient(app, client=("10.0.0.2", 50000)) as second_client:
        assert second_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        ).status_code == 200


def test_package_match_openapi_tightens_types_and_candidate_semantics() -> None:
    app = create_app(
        external_source=ConfirmedNoMatchSource(),
        package_match_limiter=KeyedSlidingWindowLimiter(60),
    )

    schema = app.openapi()
    operation = schema["paths"]["/api/v1/package-matches"]["get"]
    schemas = schema["components"]["schemas"]

    assert "external Evidence" in operation["description"]
    assert "does not prove identity" in operation["description"]
    assert schemas["AllergenConceptOutcomeResponse"]["properties"]["outcome"] == {
        "$ref": "#/components/schemas/AllergenAssessmentOutcome"
    }
    assert schemas["AllergenFindingResponse"]["properties"][
        "relationship_type"
    ] == {"$ref": "#/components/schemas/AllergenRelationshipType"}
    assert schemas["PackageMatchEvidenceResponse"]["properties"]["value"] == {
        "$ref": "#/components/schemas/JsonValue"
    }


def test_package_match_structured_log_excludes_request_and_evidence_values(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = off_source_with_record(product_name_en="DO-NOT-LOG-LABEL")
    app = create_app(
        external_source=source,
        package_match_limiter=KeyedSlidingWindowLimiter(60),
    )
    route_logger = logging.getLogger("lifegoods.package_matches.router")
    monkeypatch.setattr(route_logger, "disabled", False)

    with (
        caplog.at_level("INFO", logger=route_logger.name),
        TestClient(app, client=("203.0.113.42", 50000)) as test_client,
    ):
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    completed = next(
        record
        for record in caplog.records
        if record.__dict__.get("event") == "package_match_lookup_completed"
    )
    assert completed.__dict__["candidate_count"] == 1
    assert completed.__dict__["off_outcome"] == "AVAILABLE"
    assert completed.__dict__["off_dataset_version_id"] == DATASET_VERSION.id
    logged = str(completed.__dict__)
    assert "4006381333931" not in logged
    assert "203.0.113.42" not in logged
    assert "DO-NOT-LOG-LABEL" not in logged


def test_package_matches_with_active_allergen_dataset_evaluates_milk_end_to_end(
    session_factory: sessionmaker[Session],
) -> None:
    # 1. Import and activate minimal Codex food allergen dataset in PostgreSQL/SQLite
    bundle = ReferenceBundle.from_json_file(CODEX_MINIMAL_BUNDLE_PATH)
    with session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(session, bundle.manifest.id)

    # 2. Setup OFF MongoDB with chocolate containing milk powder
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
            "product_name_en": "Dark chocolate",
            "ingredients_text_en": "Cocoa mass, sugar, cocoa butter, milk powder",
            "allergens": "Contains milk",
            "allergens_tags": ["en:milk"],
            "traces": "May contain nuts",
            "traces_tags": ["en:nuts"],
            "last_modified_t": 1787462400,
        }
    )

    # 3. Create app with allergen assessments enabled
    with TestClient(
        create_app(
            settings=Settings(allergen_assessments_enabled=True),
            session_factory=session_factory,
            external_source=OpenFoodFactsDatasetSource(database),
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["candidates"]) == 1
    candidate = body["candidates"][0]

    # Verify identity & label evidence remain unchanged
    assert candidate["source_kind"] == "OPEN_FOOD_FACTS"
    assert candidate["external_record_id"] == "4006381333931"

    # Verify allergen assessment
    assessment = candidate["allergen_assessment"]
    assert assessment["status"] == "COMPLETED"
    assert assessment["reason"] is None
    assert assessment["evidence_coverage"] == "PARTIAL"
    assert assessment["engine_version"] == "0.1.0"
    assert assessment["reference_dataset_version"]["id"] == "codex-food-allergen-2026-minimal"
    assert assessment["reference_dataset_version"]["review_kind"] == "FOOD_DOMAIN_REVIEW"

    # Verify concepts
    assert len(assessment["concepts"]) == 1
    concept = assessment["concepts"][0]
    assert concept["concept_id"] == "concept-food-allergen-milk"
    assert concept["name"] == "Milk and milk products"
    assert concept["outcome"] == "DERIVED_FROM_INGREDIENT"
    assert concept["reason"] is None
    assert len(concept["finding_ids"]) == 1

    # Verify findings
    assert len(assessment["findings"]) == 1
    finding = assessment["findings"][0]
    assert finding["id"] == concept["finding_ids"][0]
    assert finding["concept_id"] == "concept-food-allergen-milk"
    assert finding["mapping_id"] == "map-en-milk-exact"
    assert finding["rule_id"] == "rule-codex-2026-milk"
    assert finding["relationship_type"] == "EXACT_NAME"
    assert finding["matched_text"] == "milk"
    assert finding["start_index"] == 33
    assert finding["end_index"] == 37
    assert finding["source_field"] == "ingredients_text_en"
    assert finding["source_url"] == "https://world.openfoodfacts.org/product/4006381333931"
    assert finding["source_revision"] == "1787462400"
    assert finding["off_dataset_version_id"] == "dataset-2026-08-27"
    assert finding["reference_dataset_version_id"] == "codex-food-allergen-2026-minimal"
    assert finding["engine_version"] == "0.1.0"

    # Verify source signals
    signal_fields = [s["field"] for s in assessment["source_signals"]]
    assert "allergen_declaration" in signal_fields
    assert "allergen_tags" in signal_fields


def test_package_match_returns_each_active_leaf_with_ancestry_and_rules(
    session_factory: sessionmaker[Session],
) -> None:
    bundle = ReferenceBundle.from_json_file(CODEX_REVIEWED_ENGLISH_BUNDLE_PATH)
    with session_factory() as session:
        imported = import_reference_bundle(
            session,
            bundle,
            now=lambda: datetime(2026, 8, 29, 8, 0, tzinfo=UTC),
        )
        activate_reference_dataset_version(
            session,
            imported.id,
            now=lambda: datetime(2026, 8, 29, 9, 0, tzinfo=UTC),
        )

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
            "product_name_en": "Mixed meal",
            "ingredients_text_en": "rice, almond, cod, salt",
            "last_modified_t": 1787462400,
        }
    )

    with TestClient(
        create_app(
            settings=Settings(allergen_assessments_enabled=True),
            session_factory=session_factory,
            external_source=OpenFoodFactsDatasetSource(database),
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["normalized_identifier"] == "4006381333931"
    assert body["scheme"] == "EAN_13"
    assert len(body["candidates"]) == 1
    assert body["candidates"][0]["source_kind"] == "OPEN_FOOD_FACTS"
    assert body["candidates"][0]["external_record_id"] == "4006381333931"

    assessment = body["candidates"][0]["allergen_assessment"]
    assert assessment["reference_dataset_version"] == {
        "id": "codex-food-allergen-2026-reviewed-english-v1",
        "source_url": bundle.manifest.source_url,
        "retrieved_at": "2026-08-29T08:00:00Z",
        "activated_at": "2026-08-29T09:00:00Z",
        "sha256": bundle.manifest.sha256,
        "review_kind": "FOOD_DOMAIN_REVIEW",
        "dataset_kind": "FOOD_ALLERGEN",
    }
    assert len(assessment["concepts"]) == 26
    assert [concept["concept_id"] for concept in assessment["concepts"]] == sorted(
        concept["concept_id"] for concept in assessment["concepts"]
    )

    concepts = {concept["concept_id"]: concept for concept in assessment["concepts"]}
    assert concepts["concept-food-allergen-almond"]["parent_ids"] == [
        "concept-food-allergen-specific-tree-nuts",
        "concept-food-allergen-root",
    ]
    assert concepts["concept-food-allergen-almond"]["rule_ids"] == [
        "rule-codex-2026-almond",
        "rule-codex-2026-derivative-exemption",
    ]
    assert concepts["concept-food-allergen-cod"]["parent_ids"] == [
        "concept-food-allergen-fish-group",
        "concept-food-allergen-root",
    ]
    assert concepts["concept-food-allergen-cod"]["rule_ids"] == [
        "rule-codex-2026-cod",
        "rule-codex-2026-derivative-exemption",
    ]
    assert concepts["concept-food-allergen-almond"]["name"] == "Almond"
    assert concepts["concept-food-allergen-cod"]["name"] == "Cod"
    assert {
        concept_id
        for concept_id, concept in concepts.items()
        if concept["outcome"] == "DERIVED_FROM_INGREDIENT"
    } == {"concept-food-allergen-almond", "concept-food-allergen-cod"}
    assert all(
        concept["outcome"] == "LABEL_INCOMPLETE_OR_UNREADABLE"
        for concept_id, concept in concepts.items()
        if concept_id
        not in {"concept-food-allergen-almond", "concept-food-allergen-cod"}
    )
    assert [
        {
            key: finding[key]
            for key in (
                "id",
                "concept_id",
                "mapping_id",
                "rule_id",
                "relationship_type",
                "matched_text",
                "start_index",
                "end_index",
                "language",
                "source_field",
                "source_url",
                "source_revision",
                "off_dataset_version_id",
                "reference_dataset_version_id",
                "engine_version",
            )
        }
        for finding in assessment["findings"]
    ] == [
        {
            "id": "finding-codex-food-allergen-2026-reviewed-english-v1-map-en-almond-exact-6-12",
            "concept_id": "concept-food-allergen-almond",
            "mapping_id": "map-en-almond-exact",
            "rule_id": "rule-codex-2026-almond",
            "relationship_type": "EXACT_NAME",
            "matched_text": "almond",
            "start_index": 6,
            "end_index": 12,
            "language": "en",
            "source_field": "ingredients_text_en",
            "source_url": "https://world.openfoodfacts.org/product/4006381333931",
            "source_revision": "1787462400",
            "off_dataset_version_id": "dataset-2026-08-27",
            "reference_dataset_version_id": "codex-food-allergen-2026-reviewed-english-v1",
            "engine_version": "0.1.0",
        },
        {
            "id": "finding-codex-food-allergen-2026-reviewed-english-v1-map-en-cod-exact-14-17",
            "concept_id": "concept-food-allergen-cod",
            "mapping_id": "map-en-cod-exact",
            "rule_id": "rule-codex-2026-cod",
            "relationship_type": "EXACT_NAME",
            "matched_text": "cod",
            "start_index": 14,
            "end_index": 17,
            "language": "en",
            "source_field": "ingredients_text_en",
            "source_url": "https://world.openfoodfacts.org/product/4006381333931",
            "source_revision": "1787462400",
            "off_dataset_version_id": "dataset-2026-08-27",
            "reference_dataset_version_id": "codex-food-allergen-2026-reviewed-english-v1",
            "engine_version": "0.1.0",
        },
    ]


def test_reviewed_english_matcher_preserves_derivatives_exclusions_and_repetitions_over_http(
    session_factory: sessionmaker[Session],
) -> None:
    bundle = ReferenceBundle.from_json_file(CODEX_REVIEWED_ENGLISH_BUNDLE_PATH)
    with session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(session, bundle.manifest.id)

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
            "product_name_en": "Mixed protein drink",
            "ingredients_text_en": "coconut-milk, whey, tahini, whey",
            "last_modified_t": 1787462400,
        }
    )

    with TestClient(
        create_app(
            settings=Settings(allergen_assessments_enabled=True),
            session_factory=session_factory,
            external_source=OpenFoodFactsDatasetSource(database),
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    body = response.json()
    assessment = body["candidates"][0]["allergen_assessment"]
    assert assessment["status"] == "COMPLETED"
    concepts = {concept["concept_id"]: concept for concept in assessment["concepts"]}
    assert concepts["concept-food-allergen-milk"]["outcome"] == (
        "DERIVED_FROM_INGREDIENT"
    )
    assert concepts["concept-food-allergen-sesame"]["outcome"] == (
        "DERIVED_FROM_INGREDIENT"
    )
    assert [
        {
            key: finding[key]
            for key in (
                "concept_id",
                "mapping_id",
                "rule_id",
                "relationship_type",
                "matched_text",
                "start_index",
                "end_index",
            )
        }
        for finding in assessment["findings"]
    ] == [
        {
            "concept_id": "concept-food-allergen-milk",
            "mapping_id": "map-en-whey-derived",
            "rule_id": "rule-lifegoods-whey-milk-derivative",
            "relationship_type": "DERIVED_FROM",
            "matched_text": "whey",
            "start_index": 14,
            "end_index": 18,
        },
        {
            "concept_id": "concept-food-allergen-sesame",
            "mapping_id": "map-en-tahini-derived",
            "rule_id": "rule-lifegoods-tahini-sesame-derivative",
            "relationship_type": "DERIVED_FROM",
            "matched_text": "tahini",
            "start_index": 20,
            "end_index": 26,
        },
        {
            "concept_id": "concept-food-allergen-milk",
            "mapping_id": "map-en-whey-derived",
            "rule_id": "rule-lifegoods-whey-milk-derivative",
            "relationship_type": "DERIVED_FROM",
            "matched_text": "whey",
            "start_index": 28,
            "end_index": 32,
        },
    ]
    assert all(
        finding["mapping_id"] != "map-en-milk-exact"
        for finding in assessment["findings"]
    )


def test_package_matches_with_active_allergen_dataset_and_no_match_returns_incomplete_label(
    session_factory: sessionmaker[Session],
) -> None:
    bundle = ReferenceBundle.from_json_file(CODEX_MINIMAL_BUNDLE_PATH)
    with session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(session, bundle.manifest.id)

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
            "product_name_en": "Pure Dark chocolate",
            "ingredients_text_en": "Cocoa mass, sugar, cocoa butter, vanilla extract",
            "last_modified_t": 1787462400,
        }
    )

    with TestClient(
        create_app(
            settings=Settings(allergen_assessments_enabled=True),
            session_factory=session_factory,
            external_source=OpenFoodFactsDatasetSource(database),
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    body = response.json()
    assessment = body["candidates"][0]["allergen_assessment"]
    assert assessment["status"] == "COMPLETED"
    assert assessment["reason"] is None
    assert assessment["evidence_coverage"] == "PARTIAL"
    assert len(assessment["concepts"]) == 1
    assert assessment["concepts"][0]["outcome"] == "LABEL_INCOMPLETE_OR_UNREADABLE"
    assert assessment["findings"] == []


def test_package_matches_with_active_allergen_dataset_missing_english_text(
    session_factory: sessionmaker[Session],
) -> None:

    bundle = ReferenceBundle.from_json_file(CODEX_MINIMAL_BUNDLE_PATH)
    with session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(session, bundle.manifest.id)

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
            "product_name_km": "សូកូឡាខ្មៅ",
            "ingredients_text_km": "ម៉ាសកាកាវ ស្ករ ប៊ឺកាកាវ",
            "last_modified_t": 1787462400,
        }
    )

    with TestClient(
        create_app(
            settings=Settings(allergen_assessments_enabled=True),
            session_factory=session_factory,
            external_source=OpenFoodFactsDatasetSource(database),
        )
    ) as test_client:
        response = test_client.get(
            "/api/v1/package-matches", params={"identifier": "4006381333931"}
        )

    assert response.status_code == 200
    body = response.json()
    assessment = body["candidates"][0]["allergen_assessment"]
    assert assessment["status"] == "NOT_ASSESSED"
    assert assessment["reason"] == "EVIDENCE_UNAVAILABLE"
    assert assessment["evidence_coverage"] == "NOT_ASSESSED"
    assert assessment["reference_dataset_version"]["id"] == "codex-food-allergen-2026-minimal"
    assert assessment["concepts"] == []
    assert assessment["findings"] == []
