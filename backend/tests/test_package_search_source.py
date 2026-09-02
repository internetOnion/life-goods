from datetime import UTC, datetime
from typing import Any

from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    PACKAGE_SEARCH_COUNTRY_INDEX,
    PACKAGE_SEARCH_TEXT_INDEX,
    VERSIONS_COLLECTION,
    ExternalPackageSearchUnavailableError,
    OpenFoodFactsDatasetSource,
)

VERSION_ID = "dataset-search"
COLLECTION_NAME = "off_products_dataset_search"


class Cursor:
    def __init__(self, documents: list[dict[str, Any]]) -> None:
        self.documents = documents
        self.sort_spec: list[tuple[str, Any]] | None = None
        self.offset = 0
        self.count = len(documents)

    def sort(self, spec: list[tuple[str, Any]]) -> "Cursor":
        self.sort_spec = spec
        return self

    def skip(self, offset: int) -> "Cursor":
        self.offset = offset
        return self

    def limit(self, count: int) -> "Cursor":
        self.count = count
        return self

    def __iter__(self):
        return iter(self.documents[self.offset : self.offset + self.count])


class ProductCollection:
    def __init__(
        self,
        documents: list[dict[str, Any]],
        *,
        include_search_indexes: bool = True,
    ) -> None:
        self.cursor = Cursor(documents)
        self.filter: dict[str, Any] | None = None
        self.projection: dict[str, Any] | None = None
        self.include_search_indexes = include_search_indexes

    def index_information(self) -> dict[str, Any]:
        if not self.include_search_indexes:
            return {"_id_": {"key": [("_id", 1)]}}
        return {
            PACKAGE_SEARCH_TEXT_INDEX: {},
            PACKAGE_SEARCH_COUNTRY_INDEX: {},
        }

    def find(self, filter_: dict[str, Any], projection: dict[str, Any]) -> Cursor:
        self.filter = filter_
        self.projection = projection
        return self.cursor


class FixedCollection:
    def __init__(self, value: dict[str, Any]) -> None:
        self.value = value

    def find_one(self, _filter: dict[str, Any]) -> dict[str, Any]:
        return self.value


class SearchDatabase:
    def __init__(
        self,
        documents: list[dict[str, Any]],
        *,
        include_search_indexes: bool = True,
    ) -> None:
        timestamp = datetime(2026, 8, 27, 8, 0, tzinfo=UTC)
        self.product_collection = ProductCollection(
            documents,
            include_search_indexes=include_search_indexes,
        )
        self.collections = {
            CONTROL_COLLECTION: FixedCollection(
                {"_id": ACTIVE_POINTER_ID, "active_version_id": VERSION_ID}
            ),
            VERSIONS_COLLECTION: FixedCollection(
                {
                    "_id": VERSION_ID,
                    "collection_name": COLLECTION_NAME,
                    "source_url": "https://example.test/export.jsonl.gz",
                    "retrieval_completed_at": timestamp,
                    "activated_at": timestamp,
                    "sha256": "a" * 64,
                    "status": "ACTIVE",
                }
            ),
            COLLECTION_NAME: self.product_collection,
        }

    def __getitem__(self, name: str):
        return self.collections[name]

    def list_collection_names(self, filter: dict[str, Any] | None = None) -> list[str]:
        names = list(self.collections)
        if filter and "name" in filter:
            return [name for name in names if name == filter["name"]]
        return names


def test_search_uses_cambodia_filter_text_ranking_and_stable_tie_break() -> None:
    database = SearchDatabase(
        [
            {
                "code": "4006381333931",
                "product_name": "Dark Chocolate",
                "brands": "Example Foods",
                "quantity": "100 g",
                "manufacturing_places": "Cambodia",
                "last_modified_t": 1787462400,
            },
            {
                "code": "8850000000003",
                "product_name_km": "សូកូឡា",
                "quantity": "80 g",
                "last_modified_t": 1787462401,
            },
        ]
    )
    source = OpenFoodFactsDatasetSource(database)  # type: ignore[arg-type]

    page = source.search("  dark   chocolate  ", offset=0, limit=1)

    collection = database.product_collection
    assert collection.filter == {
        "countries_tags": "en:cambodia",
        "$text": {"$search": "dark chocolate"},
    }
    assert collection.cursor.sort_spec == [
        ("score", {"$meta": "textScore"}),
        ("code", 1),
    ]
    assert page.normalized_query == "dark chocolate"
    assert [record.identifier for record in page.records] == ["4006381333931"]
    assert page.records[0].quantity is not None
    assert page.records[0].manufacturing_places is not None
    assert page.next_offset == 1


def test_search_is_unavailable_when_required_indexes_are_missing() -> None:
    database = SearchDatabase([], include_search_indexes=False)
    source = OpenFoodFactsDatasetSource(database)  # type: ignore[arg-type]

    try:
        source.search("milk", offset=0, limit=12)
    except ExternalPackageSearchUnavailableError as error:
        assert "indexes" in str(error)
    else:
        raise AssertionError("Expected missing search indexes to be unavailable")
