from collections.abc import Iterator
from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from lifegoods.adapters.catalog_models import (
    EvidenceRecord,
    ExternalIdentifierRecord,
    IdentifierEvidenceLinkRecord,
    PackageVariantRecord,
    ProductRecord,
)
from lifegoods.adapters.database import Base
from lifegoods.main import create_app
from lifegoods.matching.external_source import (
    ExternalLookupResult,
    ExternalPackageNotFound,
    ExternalSourceMetadata,
)
from lifegoods.matching.identifier import NormalizedIdentifier


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
            request_url=(
                f"https://world.openfoodfacts.org/api/v3/product/{identifier.value}.json"
            ),
            retrieved_at=datetime(2026, 8, 24, 9, 0, tzinfo=UTC),
            raw_response=b'{"result":{"id":"product_not_found"}}',
            source=self.metadata,
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
            session_factory=session_factory,
            external_source=ConfirmedNoMatchSource(),
            utc_now=lambda: datetime(2026, 8, 24, 9, 0, tzinfo=UTC),
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


def test_candidate_is_returned_through_the_persistence_boundary(
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
    assert response.json()["candidates"] == [
        {
            "source_kind": "REVIEWED_CATALOG",
            "package_variant_id": "variant-1",
            "product_id": "product-1",
            "external_record_id": None,
            "source": None,
            "identity_evidence": [],
            "label_evidence": [],
            "reference_images": [],
            "retrieved_at": None,
            "is_current": None,
            "source_revision": None,
        }
    ]


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
    assert [candidate["package_variant_id"] for candidate in response.json()["candidates"]] == [
        "variant-1",
        "variant-2",
    ]


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
