from datetime import UTC, datetime
from typing import Any, cast
from unittest.mock import MagicMock

import mongomock
import pytest
from fastapi.testclient import TestClient
from pymongo.database import Database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from lifegoods.core.database import Base
from lifegoods.main import create_app
from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
    OpenFoodFactsDatasetSource,
)
from lifegoods.package_matches.search import (
    MongoPackageSearch,
    build_search_index,
    search_collection_name,
)


def search_database() -> tuple[Database[dict[str, Any]], str]:
    database = cast(Database[dict[str, Any]], mongomock.MongoClient().lifegoods_off)
    version_id = "version-1"
    collection_name = "off_products_version-1"
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": version_id,
            "collection_name": collection_name,
            "source_url": "https://example.test/export.jsonl.gz",
            "retrieval_completed_at": datetime(2026, 8, 30, tzinfo=UTC),
            "activated_at": datetime(2026, 8, 30, tzinfo=UTC),
            "sha256": "a" * 64,
            "status": "ACTIVE",
        }
    )
    database[CONTROL_COLLECTION].insert_one(
        {"_id": ACTIVE_POINTER_ID, "active_version_id": version_id}
    )
    database[collection_name].insert_many(
        [
            {
                "code": "4006381333931",
                "product_name_en": "Oreo Chocolate",
                "product_name_fr": "Oreo Chocolat",
                "brands": "Oreo",
                "quantity": "120 g",
                "manufacturing_places": "China",
                "manufacturing_places_tags": ["en:china"],
                "ingredients_text_en": "Wheat flour, sugar",
                "ingredients_text_fr": "Farine de blé, sucre",
                "traces": "May contain milk",
                "traces_tags": ["en:milk"],
                "allergens_tags": ["en:wheat"],
                "additives_tags": ["en:e322"],
                "conservation_conditions_en": "Store in a cool, dry place",
                "labels_tags": ["en:halal"],
                "nutriments": {"energy-kcal_100g": 480, "unrelated": "ignored"},
                "nutrition_data_per": "100g",
                "languages_tags": ["en:english", "fr:french"],
                "countries_tags": ["en:germany"],
                "lang": "en",
            },
            {
                "code": "8850000000003",
                "product_name_en": "Cambodia Rice",
                "brands": "Cambodia",
                "manufacturing_places": "Thailand",
                "manufacturing_places_tags": ["en:thailand"],
                "lang": "en",
            },
            {
                "code": "12345670",
                "product_name_en": "China Tea",
                "brands": "Tea House",
                "manufacturing_places": "China",
                "manufacturing_places_tags": ["en:china"],
                "lang": "en",
            },
        ]
    )
    return database, version_id


def test_search_matches_name_brand_and_manufacturing_country() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    search = MongoPackageSearch(OpenFoodFactsDatasetSource(database))

    page = search.search("china", page=1, page_size=20)

    assert [hit.record.identifier for hit in page.results] == [
        "12345670",
        "4006381333931",
    ]
    assert page.results[0].matched_fields == ("name", "manufacturing_country")
    assert page.results[1].matched_fields == ("manufacturing_country",)


def test_search_matches_a_valid_identifier() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    search = MongoPackageSearch(OpenFoodFactsDatasetSource(database))

    page = search.search("4006381333931", page=1, page_size=20)

    assert [hit.record.identifier for hit in page.results] == ["4006381333931"]
    assert page.results[0].matched_fields == ("identifier",)


def test_search_supports_prefixes_and_reports_brand_match() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    search = MongoPackageSearch(OpenFoodFactsDatasetSource(database))

    page = search.search("ore", page=1, page_size=20)

    assert [hit.record.identifier for hit in page.results] == ["4006381333931"]
    assert page.results[0].matched_fields == ("name", "brand")


def test_search_fetches_selected_products_in_one_version_pinned_batch() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    source = OpenFoodFactsDatasetSource(database)
    fetch_many = MagicMock(wraps=source.fetch_many)
    source.fetch_many = fetch_many  # type: ignore[method-assign]
    search = MongoPackageSearch(source)

    page = search.search("ore", page=1, page_size=20)

    assert page.results
    fetch_many.assert_called_once()
    assert fetch_many.call_args.args[0] == version_id
    assert len(fetch_many.call_args.args[1]) == len(page.results)


def test_failed_search_index_build_removes_temporary_collection(monkeypatch) -> None:
    database, version_id = search_database()
    import importlib

    search_module = importlib.import_module("lifegoods.package_matches.search")

    def fail_index(_product):
        raise RuntimeError("synthetic index failure")

    monkeypatch.setattr(search_module, "_index_document", fail_index)

    with pytest.raises(RuntimeError, match="synthetic index failure"):
        build_search_index(database, version_id)

    assert f"{search_collection_name(version_id)}_building" not in database.list_collection_names()


def test_search_excludes_sold_country_from_manufacturing_match() -> None:
    database, version_id = search_database()
    database["off_products_version-1"].update_one(
        {"code": "4006381333931"}, {"$set": {"countries_tags": ["en:cambodia"]}}
    )
    build_search_index(database, version_id)
    search = MongoPackageSearch(OpenFoodFactsDatasetSource(database))

    page = search.search("cambodia", page=1, page_size=20)

    assert [hit.record.identifier for hit in page.results] == ["8850000000003"]


def test_search_paginates_and_returns_has_more() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    search = MongoPackageSearch(OpenFoodFactsDatasetSource(database))

    page = search.search("china", page=1, page_size=1)

    assert len(page.results) == 1
    assert page.has_more is True


def test_search_skips_matching_records_with_invalid_identifiers() -> None:
    database, version_id = search_database()
    database["off_products_version-1"].update_one(
        {"code": "4006381333931"}, {"$set": {"product_name_en": "Nutella"}}
    )
    database["off_products_version-1"].insert_one(
        {
            "code": "12345671",
            "product_name_en": "Nutella",
            "brands": "Nutella",
            "lang": "en",
        }
    )
    build_search_index(database, version_id)
    search = MongoPackageSearch(OpenFoodFactsDatasetSource(database))

    page = search.search("nutella", page=1, page_size=20)

    assert [hit.record.identifier for hit in page.results] == ["4006381333931"]


class AllowAllLimiter:
    def try_acquire(self, _key: str) -> tuple[bool, int]:
        return True, 0


def test_search_api_returns_product_facts_and_match_fields() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    client = TestClient(
        create_app(
            session_factory=sessionmaker(engine, expire_on_commit=False),
            external_source=OpenFoodFactsDatasetSource(database),
            package_match_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
            search_rate_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
        )
    )

    response = client.get("/api/v1/package-matches/search", params={"q": "oreo"})

    assert response.status_code == 200
    body = response.json()
    assert body["results"][0]["brand"] == ["Oreo"]
    assert body["results"][0]["made_in"] == ["China"]
    assert body["results"][0]["ingredients"] == "Wheat flour, sugar"
    assert body["results"][0]["allergens"] == ["wheat"]
    assert body["results"][0]["additives"] == [{"code": "e322", "name": "e322"}]
    assert body["results"][0]["matched_fields"] == ["name", "brand"]
    assert {item["value"] for item in body["results"][0]["other_names"]} >= {"Oreo Chocolat"}


def test_search_api_returns_every_non_empty_sourced_field_as_evidence() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    client = TestClient(
        create_app(
            session_factory=sessionmaker(engine, expire_on_commit=False),
            external_source=OpenFoodFactsDatasetSource(database),
            package_match_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
            search_rate_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
        )
    )

    response = client.get("/api/v1/package-matches/search", params={"q": "oreo"})

    assert response.status_code == 200
    evidence = response.json()["results"][0]["evidence"]
    returned_fields = {(item["field"], item["source_field"]) for item in evidence}
    assert returned_fields >= {
        ("identifier", "code"),
        ("name", "product_name_en"),
        ("name", "product_name_fr"),
        ("brands", "brands"),
        ("quantity", "quantity"),
        ("ingredient_text", "ingredients_text_en"),
        ("ingredient_text", "ingredients_text_fr"),
        ("allergen_tags", "allergens_tags"),
        ("trace_declaration", "traces"),
        ("trace_tags", "traces_tags"),
        ("additive_tags", "additives_tags"),
        ("manufacturing_places", "manufacturing_places"),
        ("storage_instructions", "conservation_conditions_en"),
        ("halal_label_claim", "labels_tags"),
        ("nutrition", "nutriments"),
        ("nutrition", "nutrition_data_per"),
        ("packaging_languages", "languages_tags"),
        ("countries_sold", "countries_tags"),
    }
    assert all(item["source_name"] == "Open Food Facts" for item in evidence)
    assert all(item["dataset_version_id"] == version_id for item in evidence)


def test_search_api_preserves_missing_fields_as_unknown() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    client = TestClient(
        create_app(
            session_factory=sessionmaker(engine, expire_on_commit=False),
            external_source=OpenFoodFactsDatasetSource(database),
            package_match_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
            search_rate_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
        )
    )

    response = client.get("/api/v1/package-matches/search", params={"q": "cambodia"})

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["brand"] is not None
    assert result["made_in"] == ["Thailand"]
    assert result["allergens"] is None
    assert result["additives"] is None
    evidence = {
        (item["field"], item["source_field"]): item["value"]
        for item in result["evidence"]
    }
    assert evidence[("allergen_declaration", "allergens")] is None
    assert evidence[("allergen_tags", "allergens_tags")] is None
    assert evidence[("trace_declaration", "traces")] is None
    assert evidence[("trace_tags", "traces_tags")] is None
    assert evidence[("additive_tags", "additives_tags")] is None
    assert evidence[("halal_label_claim", "labels_tags")] is None
    assert evidence[("nutrition", "nutriments")] is None


def test_search_api_returns_search_specific_validation_error() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    client = TestClient(
        create_app(
            session_factory=sessionmaker(engine, expire_on_commit=False),
            external_source=OpenFoodFactsDatasetSource(database),
            package_match_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
            search_rate_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
        )
    )

    response = client.get("/api/v1/package-matches/search")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "SEARCH_QUERY_REQUIRED"


def test_search_api_rejects_punctuation_only_query() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    client = TestClient(
        create_app(
            session_factory=sessionmaker(engine, expire_on_commit=False),
            external_source=OpenFoodFactsDatasetSource(database),
            package_match_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
            search_rate_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
        )
    )

    response = client.get("/api/v1/package-matches/search", params={"q": "!!"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "SEARCH_QUERY_INVALID"


def test_search_api_returns_not_found_when_query_has_no_matches() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    client = TestClient(
        create_app(
            session_factory=sessionmaker(engine, expire_on_commit=False),
            external_source=OpenFoodFactsDatasetSource(database),
            package_match_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
            search_rate_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
        )
    )

    response = client.get(
        "/api/v1/package-matches/search",
        params={"q": "aaaaaa", "page": 1, "page_size": 20},
    )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "SEARCH_RESULTS_NOT_FOUND",
            "message": "No Package Match candidates were found for this search query.",
        }
    }


def test_search_displays_manufacturing_tags_when_raw_place_is_missing() -> None:
    database, version_id = search_database()
    database["off_products_version-1"].update_one(
        {"code": "4006381333931"},
        {"$unset": {"manufacturing_places": ""}},
    )
    build_search_index(database, version_id)
    search = MongoPackageSearch(OpenFoodFactsDatasetSource(database))

    page = search.search("china", page=1, page_size=20)

    tagged = next(hit for hit in page.results if hit.record.identifier == "4006381333931")
    assert tagged.made_in == ("china",)


def test_search_endpoint_is_documented_in_openapi() -> None:
    database, version_id = search_database()
    build_search_index(database, version_id)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    client = TestClient(
        create_app(
            session_factory=sessionmaker(engine, expire_on_commit=False),
            external_source=OpenFoodFactsDatasetSource(database),
            package_match_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
            search_rate_limiter=AllowAllLimiter(),  # type: ignore[arg-type]
        )
    )

    operation = client.get("/openapi.json").json()["paths"]["/api/v1/package-matches/search"]["get"]

    assert operation["operationId"] == "searchPackageMatches"
    assert {parameter["name"] for parameter in operation["parameters"]} == {
        "q",
        "page",
        "page_size",
    }
    assert operation["responses"]["404"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorEnvelope"
    }
