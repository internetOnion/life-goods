from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from lifegoods.core.database import Base
from lifegoods.identifiers import NormalizedIdentifier
from lifegoods.main import create_app
from lifegoods.open_food_facts import (
    ExternalDatasetVersion,
    ExternalLookupResult,
    ExternalPackageNotFound,
    ExternalSourceMetadata,
)


class DummySource:
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
            dataset_version=ExternalDatasetVersion(
                id="dataset-test",
                source_url="https://example.test",
                retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
                activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
                sha256="0" * 64,
            ),
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
    app = create_app(
        session_factory=session_factory,
        external_source=DummySource(),
    )
    with TestClient(app) as test_client:
        yield test_client


def test_scalar_endpoint_renders_html(client: TestClient) -> None:
    response = client.get("/scalar")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "scalar" in response.text.lower()


def test_scalar_route_is_excluded_from_openapi(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    openapi_spec = response.json()
    assert "/scalar" not in openapi_spec.get("paths", {})


def test_allergen_assessment_contract_exposes_only_backend_release_states(
    client: TestClient,
) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    openapi_spec = response.json()
    schemas = openapi_spec["components"]["schemas"]

    assert schemas["AllergenAssessmentStatus"]["enum"] == [
        "COMPLETED",
        "NOT_ASSESSED",
    ]
    assert schemas["AllergenAssessmentReason"]["enum"] == [
        "FEATURE_DISABLED",
        "REFERENCE_UNAVAILABLE",
        "EVIDENCE_UNAVAILABLE",
        "ASSESSMENT_FAILED",
    ]

    assessment_schema = schemas["AllergenAssessmentResponse"]
    assert {"status", "reason", "evidence_coverage"}.issubset(
        assessment_schema["required"]
    )
    assert assessment_schema["properties"]["status"] == {
        "$ref": "#/components/schemas/AllergenAssessmentStatus"
    }
    assert assessment_schema["properties"]["reason"]["anyOf"] == [
        {"$ref": "#/components/schemas/AllergenAssessmentReason"},
        {"type": "null"},
    ]
    assert "allergen_assessment" in schemas["PackageMatchCandidateResponse"]["required"]

    paths = openapi_spec["paths"]
    assert not any("allergen" in path for path in paths)
    package_match_parameters = paths["/api/v1/package-matches"]["get"]["parameters"]
    assert [parameter["name"] for parameter in package_match_parameters] == ["identifier"]

    forbidden_contract_terms = {
        "allergy_profile",
        "preferences",
        "package_capture",
        "translation",
    }
    package_match_contract = str(
        {
            "path": paths["/api/v1/package-matches"],
            "candidate": schemas["PackageMatchCandidateResponse"],
            "assessment": assessment_schema,
        }
    ).lower()
    assert all(term not in package_match_contract for term in forbidden_contract_terms)
