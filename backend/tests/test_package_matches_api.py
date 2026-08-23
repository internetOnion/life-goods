from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from lifegoods.adapters.database import Base
from lifegoods.catalog.models import ExternalIdentifierRecord, PackageVariantRecord, ProductRecord
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
        )
        session.add(identifier)

    response = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})

    assert response.status_code == 200
    assert response.json()["candidates"] == [
        {"package_variant_id": "variant-1", "product_id": "product-1"}
    ]
