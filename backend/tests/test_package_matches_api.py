from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from lifegoods.adapters.database import Base
from lifegoods.catalog.models import (
    EvidenceRecord,
    ExternalIdentifierRecord,
    PackageVariantRecord,
    ProductRecord,
)
from lifegoods.main import create_app


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
    with TestClient(create_app(session_factory=session_factory)) as test_client:
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
        identifier = ExternalIdentifierRecord(
            id="identifier-1",
            package_variant=variant,
            scheme="EAN_13",
            normalized_value="4006381333931",
            validation_state="VALID",
            association_state="ACCEPTED",
            evidence=[
                EvidenceRecord(
                    id="evidence-1",
                    source_uri="https://example.test/evidence/1",
                    observed_at=datetime(2026, 8, 23, tzinfo=UTC),
                )
            ],
        )
        session.add(identifier)

    response = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})

    assert response.status_code == 200
    assert response.json()["candidates"] == [
        {"package_variant_id": "variant-1", "product_id": "product-1"}
    ]


def test_disputed_identifier_associations_remain_representable(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory.begin() as session:
        for number in (1, 2):
            product = ProductRecord(id=f"product-{number}")
            variant = PackageVariantRecord(id=f"variant-{number}", product=product)
            session.add(
                ExternalIdentifierRecord(
                    id=f"identifier-{number}",
                    package_variant=variant,
                    scheme="EAN_13",
                    normalized_value="4006381333931",
                    validation_state="VALID",
                    association_state="DISPUTED",
                    evidence=[
                        EvidenceRecord(
                            id=f"evidence-{number}",
                            source_uri=f"https://example.test/evidence/{number}",
                            observed_at=datetime(2026, 8, 23, tzinfo=UTC),
                        )
                    ],
                )
            )

    response = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})

    assert response.status_code == 200
    assert response.json()["candidates"] == [
        {"package_variant_id": "variant-1", "product_id": "product-1"},
        {"package_variant_id": "variant-2", "product_id": "product-2"},
    ]
