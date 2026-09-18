import mongomock
import pytest

from lifegoods.open_food_facts.dataset import CONTROL_COLLECTION, VERSIONS_COLLECTION
from lifegoods.open_food_facts.search_index import (
    SEARCH_SCHEMA_VERSION,
    SearchIndexIncompatibleError,
    SearchIndexUnavailableError,
    build_search_index,
    index_document,
    validate_search_index_readiness,
)


def test_index_document_valid_and_invalid_codes() -> None:
    # Valid EAN-13
    doc = index_document(
        {
            "code": "4006381333931",
            "product_name": "Dark Chocolate",
            "product_name_km": "សូកូឡាខ្មៅ",
            "brands": "Example Brand",
            "manufacturing_places": "Cambodia, France",
            "quantity": "100g",
            "generic_name_en": "Dark chocolate bar",
            "packaging_tags": ["en:paper-box"],
            "labels_tags": ["en:organic", "en:vegetarian"],
        }
    )
    assert doc is not None
    assert doc["code"] == "4006381333931"
    assert "dark chocolate" in doc["name_values"]
    assert "សូកូឡាខ្មៅ" in doc["name_values"]
    assert "example brand" in doc["brand_values"]
    assert doc["manufacturing_places"] == ["Cambodia", "France"]
    assert "cambodia" in doc["country_tokens"]
    assert "សូកូឡាខ្មៅ" in doc["name_tokens"]
    assert doc["name_sort"] == "dark chocolate"
    assert len(doc["names"]) == 2
    assert doc["generic_name"] == {
        "value": "Dark chocolate bar",
        "language": "en",
        "source_field": "generic_name_en",
    }
    assert doc["packaging"] == "paper box"
    assert doc["labels"] == ["organic", "vegetarian"]

    # Valid UPC-A with leading zero
    upc = index_document({"code": "012345678905", "product_name": "Zero Code"})
    assert upc is not None
    assert upc["code"] == "012345678905"

    # Dirty formatted code (must equal stored code)
    assert index_document({"code": "4006-3813-3393-1", "product_name": "Hyphen"}) is None
    assert index_document({"code": " 4006381333931 ", "product_name": "Spaced"}) is None

    # Invalid check digit
    assert index_document({"code": "12345678", "product_name": "Bad Check"}) is None

    # Non-barcode code
    assert index_document({"code": "not-a-code", "product_name": "Invalid"}) is None
    assert index_document({"code": "", "product_name": "Empty"}) is None

    # Can bypass barcode validation when explicitly requested (for baseline benchmarks)
    bypass = index_document({"code": "3", "product_name": "Test"}, validate_barcode=False)
    assert bypass is not None
    assert bypass["code"] == "3"


def test_build_search_index_records_exclusions_and_indexes() -> None:
    database = mongomock.MongoClient().lifegoods_off
    version_id = "dataset-test-1"
    collection_name = "off_products_dataset_test_1"

    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": version_id,
            "collection_name": collection_name,
            "status": "READY",
        }
    )
    database[CONTROL_COLLECTION].insert_one({"_id": "active", "active_version_id": version_id})

    # Insert 2 valid products, 2 invalid products
    database[collection_name].insert_many(
        [
            {"code": "4006381333931", "product_name": "Dark Chocolate", "brands": "Acme"},
            {"code": "012345678905", "product_name": "Oat Milk", "brands": "Bio"},
            {"code": "4006-3813-3393-1", "product_name": "Hyphen Code"},  # dirty -> excluded
            {"code": "99999999", "product_name": "Bad Check Digit"},  # invalid -> excluded
        ]
    )

    result = build_search_index(database, version_id)
    assert result["search_index"]["status"] == "READY"
    assert result["search_index"]["schema_version"] == SEARCH_SCHEMA_VERSION
    assert result["search_index"]["document_count"] == 2
    assert result["search_index"]["excluded_count"] == 2

    # Verify search collection exists and has documents
    search_col_name = result["search_index"]["collection_name"]
    assert search_col_name in database.list_collection_names()
    assert database[search_col_name].count_documents({}) == 2

    # Verify readiness validation passes
    col_name = validate_search_index_readiness(database, version_id)
    assert col_name == search_col_name


def test_validate_search_index_readiness_failures() -> None:
    database = mongomock.MongoClient().lifegoods_off
    version_id = "dataset-test-2"
    collection_name = "off_products_dataset_test_2"

    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": version_id,
            "collection_name": collection_name,
            "status": "READY",
        }
    )

    # Missing search_index
    with pytest.raises(SearchIndexUnavailableError, match="missing"):
        validate_search_index_readiness(database, version_id)

    # Incompatible schema version
    database[VERSIONS_COLLECTION].update_one(
        {"_id": version_id},
        {"$set": {"search_index": {"status": "READY", "schema_version": 999}}},
    )
    with pytest.raises(SearchIndexIncompatibleError, match="schema version"):
        validate_search_index_readiness(database, version_id)

    # Status not READY
    database[VERSIONS_COLLECTION].update_one(
        {"_id": version_id},
        {"$set": {"search_index": {"status": "BUILDING", "schema_version": SEARCH_SCHEMA_VERSION}}},
    )
    with pytest.raises(SearchIndexUnavailableError, match="status is 'BUILDING'"):
        validate_search_index_readiness(database, version_id)

    # Collection missing
    database[VERSIONS_COLLECTION].update_one(
        {"_id": version_id},
        {
            "$set": {
                "search_index": {
                    "status": "READY",
                    "schema_version": SEARCH_SCHEMA_VERSION,
                    "collection_name": "nonexistent_collection",
                }
            }
        },
    )
    with pytest.raises(SearchIndexUnavailableError, match="unavailable"):
        validate_search_index_readiness(database, version_id)


def test_ensure_search_indexes_preserves_data_and_rejects_wrong_definition() -> None:
    from lifegoods.open_food_facts.search_index import (
        SORTED_SEARCH_INDEXES,
        ensure_search_indexes,
    )

    database = mongomock.MongoClient().lifegoods_off
    database[VERSIONS_COLLECTION].insert_one({"_id": "test", "collection_name": "source"})
    database.source.insert_one({"code": "4006381333931", "product_name": "Milk"})
    manifest = build_search_index(database, "test")
    name = manifest["search_index"]["collection_name"]
    before = list(database[name].find({}))
    for index in SORTED_SEARCH_INDEXES:
        database[name].drop_index(index)
    with pytest.raises(SearchIndexUnavailableError):
        validate_search_index_readiness(database, "test")
    assert ensure_search_indexes(database, "test")["status"] == "READY"
    assert ensure_search_indexes(database, "test")["status"] == "READY"
    assert list(database[name].find({})) == before
    assert database[VERSIONS_COLLECTION].find_one({"_id": "test"}) == manifest
    index = next(iter(SORTED_SEARCH_INDEXES))
    database[name].drop_index(index)
    database[name].create_index("code", name=index)
    with pytest.raises(SearchIndexUnavailableError):
        validate_search_index_readiness(database, "test")
