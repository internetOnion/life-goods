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
