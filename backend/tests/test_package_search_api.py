from datetime import UTC, datetime

from fastapi.testclient import TestClient

from lifegoods.core.concurrency import KeyedSlidingWindowLimiter
from lifegoods.identifiers import NormalizedIdentifier
from lifegoods.main import create_app
from lifegoods.open_food_facts import (
    ExternalDatasetVersion,
    ExternalLookupResult,
    ExternalPackageNotFound,
    ExternalPackageRecord,
    ExternalPackageSearchPage,
    ExternalPackageSearchUnavailableError,
    ExternalSelectedImage,
    ExternalSourceMetadata,
    SourcedValue,
)

VERSION = ExternalDatasetVersion(
    id="dataset-search",
    source_url="https://static.openfoodfacts.org/data/export.jsonl.gz",
    retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
    activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
    sha256="a" * 64,
)
SOURCE = ExternalSourceMetadata(
    name="Open Food Facts",
    source_type="COMMUNITY_DATABASE",
    base_url="https://world.openfoodfacts.org",
    attribution="Open Food Facts contributors",
    database_license="ODbL",
    contents_license="Database Contents License",
    image_license="CC BY-SA",
)


def package_record() -> ExternalPackageRecord:
    return ExternalPackageRecord(
        identifier="4006381333931",
        source_record_id="4006381333931",
        request_url=VERSION.source_url,
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        retrieved_at=VERSION.retrieved_at,
        source_revision="1787462400",
        source=SOURCE,
        dataset_version=VERSION,
        names=(
            SourcedValue("Dark Chocolate", "product_name", "en"),
            SourcedValue("សូកូឡាខ្មៅ", "product_name_km", "km"),
        ),
        brands=SourcedValue(("Example Foods",), "brands"),
        quantity=SourcedValue("100 g", "quantity"),
        selected_images=(
            ExternalSelectedImage(
                role="front",
                url="https://images.openfoodfacts.org/images/products/400/front.jpg",
                source_field="image_front_url",
                language="en",
            ),
        ),
        ingredient_texts=(),
        allergen_declaration=None,
        allergen_tags=None,
        trace_declaration=None,
        trace_tags=None,
        additives=None,
        manufacturing_places=SourcedValue("Cambodia", "manufacturing_places"),
        storage_conditions=(),
        halal_label_claim=None,
        nutrition=(),
        packaging_languages=None,
        countries_sold=SourcedValue(("en:cambodia",), "countries_tags"),
    )


class SearchSource:
    metadata = SOURCE

    def __init__(self, *, unavailable: bool = False) -> None:
        self.unavailable = unavailable

    def fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        return ExternalPackageNotFound(
            identifier=identifier.value,
            source=SOURCE,
            dataset_version=VERSION,
        )

    def search(
        self,
        query: str,
        *,
        offset: int,
        limit: int,
    ) -> ExternalPackageSearchPage:
        if self.unavailable:
            raise ExternalPackageSearchUnavailableError
        return ExternalPackageSearchPage(
            normalized_query=" ".join(query.split()),
            records=(package_record(),),
            dataset_version=VERSION,
            next_offset=offset + limit,
        )


def test_package_search_returns_compact_provenance_preserving_results() -> None:
    with TestClient(create_app(external_source=SearchSource())) as client:
        response = client.get(
            "/api/v1/package-search",
            params={"query": "  dark   chocolate ", "offset": 0, "limit": 12},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["normalized_query"] == "dark chocolate"
    assert body["dataset_version"]["id"] == VERSION.id
    assert body["next_offset"] == 12
    result = body["results"][0]
    assert result["identifier"] == "4006381333931"
    assert [name["language"] for name in result["names"]] == ["en", "km"]
    assert result["brands"]["value"] == ["Example Foods"]
    assert result["quantity"]["value"] == "100 g"
    assert result["manufacturing_place"]["value"] == "Cambodia"
    assert result["reference_image"]["url"].startswith(
        "/api/v1/open-food-facts-images?url="
    )
    assert result["reference_image"]["source_name"] == "Open Food Facts"


def test_package_search_validates_query_and_pagination() -> None:
    with TestClient(create_app(external_source=SearchSource())) as client:
        too_short = client.get("/api/v1/package-search", params={"query": " "})
        too_large = client.get(
            "/api/v1/package-search", params={"query": "milk", "limit": 25}
        )

    assert too_short.status_code == 422
    assert too_short.json()["error"]["code"] == "PACKAGE_SEARCH_QUERY_INVALID"
    assert too_large.status_code == 422
    assert too_large.json()["error"]["code"] == "PACKAGE_SEARCH_QUERY_INVALID"


def test_package_search_reports_source_unavailability() -> None:
    with TestClient(create_app(external_source=SearchSource(unavailable=True))) as client:
        response = client.get("/api/v1/package-search", params={"query": "milk"})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PACKAGE_MATCH_SOURCE_UNAVAILABLE"


def test_package_search_has_an_independent_rate_limit() -> None:
    limiter = KeyedSlidingWindowLimiter(requests_per_minute=1, monotonic=lambda: 100.0)
    with TestClient(
        create_app(
            external_source=SearchSource(),
            package_search_limiter=limiter,
        )
    ) as client:
        first = client.get("/api/v1/package-search", params={"query": "milk"})
        blocked = client.get("/api/v1/package-search", params={"query": "cola"})

    assert first.status_code == 200
    assert blocked.status_code == 429
    assert blocked.headers["retry-after"] == "60"
    assert blocked.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
