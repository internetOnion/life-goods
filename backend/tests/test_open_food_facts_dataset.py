import json
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock

import mongomock

from lifegoods.identifiers import normalize_identifier
from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageUnavailable,
    OpenFoodFactsDatasetSource,
)

FIXTURES = Path(__file__).parent / "fixtures" / "open_food_facts"
VERSION_ID = "dataset-2026-08-27"
COLLECTION_NAME = "off_products_dataset_2026_08_27"
RETRIEVED_AT = datetime(2026, 8, 27, 8, 0, tzinfo=UTC)
ACTIVATED_AT = datetime(2026, 8, 27, 9, 0, tzinfo=UTC)


def dataset_database():
    database = mongomock.MongoClient().lifegoods_off
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": VERSION_ID,
            "collection_name": COLLECTION_NAME,
            "source_url": "https://static.openfoodfacts.org/data/export.jsonl.gz",
            "retrieval_completed_at": RETRIEVED_AT,
            "activated_at": ACTIVATED_AT,
            "sha256": "a" * 64,
            "status": "ACTIVE",
        }
    )
    database[CONTROL_COLLECTION].insert_one(
        {"_id": ACTIVE_POINTER_ID, "active_version_id": VERSION_ID}
    )
    return database


def test_dataset_lookup_maps_full_document_and_version_provenance() -> None:
    database = dataset_database()
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    database[COLLECTION_NAME].insert_one(payload["product"])
    source = OpenFoodFactsDatasetSource(database)

    result = source.fetch(normalize_identifier("4006381333931"))

    assert isinstance(result, ExternalPackageFound)
    record = result.record
    assert record.identifier == "4006381333931"
    assert record.dataset_version.id == VERSION_ID
    assert record.dataset_version.retrieved_at == RETRIEVED_AT
    assert record.dataset_version.activated_at == ACTIVATED_AT
    assert record.source_revision == "1787462400"
    assert {value.source_field for value in record.names} >= {
        "product_name",
        "product_name_en",
    }
    assert record.selected_images
    assert record.ingredient_texts
    assert record.additives is not None
    assert record.additives.value == ("en:e322", "en:e330")
    assert record.manufacturing_places is not None
    assert record.manufacturing_places.value == "Cambodia"
    assert [(item.value, item.language) for item in record.storage_conditions] == [
        ("Keep in a cool, dry place", "en"),
        ("រក្សាទុកកន្លែងត្រជាក់ និងស្ងួត", "kh"),
    ]
    assert record.halal_label_claim is not None
    assert record.halal_label_claim.value == ("en:halal",)


def test_dataset_batch_lookup_preserves_order_and_version_provenance() -> None:
    database = dataset_database()
    database[COLLECTION_NAME].insert_many(
        [
            {"code": "4006381333931", "product_name": "First"},
            {"code": "8850000000003", "product_name": "Second"},
        ]
    )
    source = OpenFoodFactsDatasetSource(database)

    results = source.fetch_many(
        VERSION_ID,
        (
            normalize_identifier("8850000000003"),
            normalize_identifier("4006381333931"),
            normalize_identifier("12345670"),
        ),
    )

    assert [type(result) for result in results] == [
        ExternalPackageFound,
        ExternalPackageFound,
        ExternalPackageNotFound,
    ]
    assert isinstance(results[0], ExternalPackageFound)
    assert isinstance(results[1], ExternalPackageFound)
    assert isinstance(results[2], ExternalPackageNotFound)
    assert results[0].record.identifier == "8850000000003"
    assert results[1].record.identifier == "4006381333931"
    assert results[2].dataset_version.id == VERSION_ID


def test_dataset_lookup_preserves_missing_fields_without_negative_evidence() -> None:
    database = dataset_database()
    payload = json.loads((FIXTURES / "sparse.json").read_text())
    database[COLLECTION_NAME].insert_one(payload["product"])

    result = OpenFoodFactsDatasetSource(database).fetch(
        normalize_identifier("8850000000003")
    )

    assert isinstance(result, ExternalPackageFound)
    assert result.record.brands is None
    assert result.record.ingredient_texts == ()
    assert result.record.allergen_declaration is None
    assert result.record.additives is None
    assert result.record.manufacturing_places is None
    assert result.record.storage_conditions == ()
    assert result.record.halal_label_claim is None
    assert result.record.selected_images == ()


def test_dataset_no_match_identifies_the_version_that_was_checked() -> None:
    database = dataset_database()
    database[COLLECTION_NAME].create_index("code")
    result = OpenFoodFactsDatasetSource(database).fetch(
        normalize_identifier("4006381333931")
    )

    assert isinstance(result, ExternalPackageNotFound)
    assert result.dataset_version.id == VERSION_ID


def test_dataset_lookup_caches_manifest_but_reads_active_pointer_each_time(
    monkeypatch,
) -> None:
    database = dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931"})
    pointer_find = MagicMock(wraps=database[CONTROL_COLLECTION].find_one)
    manifest_find = MagicMock(wraps=database[VERSIONS_COLLECTION].find_one)
    product_find = MagicMock(wraps=database[COLLECTION_NAME].find_one)
    list_names = MagicMock(wraps=database.list_collection_names)
    monkeypatch.setattr(database[CONTROL_COLLECTION], "find_one", pointer_find)
    monkeypatch.setattr(database[VERSIONS_COLLECTION], "find_one", manifest_find)
    monkeypatch.setattr(database[COLLECTION_NAME], "find_one", product_find)
    monkeypatch.setattr(database, "list_collection_names", list_names)
    source = OpenFoodFactsDatasetSource(database)

    first = source.fetch(normalize_identifier("4006381333931"))
    second = source.fetch(normalize_identifier("4006381333931"))

    assert isinstance(first, ExternalPackageFound)
    assert isinstance(second, ExternalPackageFound)
    assert pointer_find.call_count == 2
    assert manifest_find.call_count == 1
    assert product_find.call_count == 2
    assert list_names.call_count == 1


def test_dataset_no_match_rechecks_cached_collection_before_returning(monkeypatch) -> None:
    database = dataset_database()
    database[COLLECTION_NAME].create_index("code")
    source = OpenFoodFactsDatasetSource(database)

    first = source.fetch(normalize_identifier("4006381333931"))
    monkeypatch.setattr(source, "_collection_exists", lambda _name: False)
    second = source.fetch(normalize_identifier("4006381333931"))

    assert isinstance(first, ExternalPackageNotFound)
    assert isinstance(second, ExternalPackageUnavailable)


def test_dataset_manifest_cache_observes_activation_and_rollback_immediately() -> None:
    database = dataset_database()
    second_version_id = "dataset-2026-08-28"
    second_collection = "off_products_dataset_2026_08_28"
    database[COLLECTION_NAME].insert_one(
        {"code": "4006381333931", "product_name": "First"}
    )
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": second_version_id,
            "collection_name": second_collection,
            "source_url": "https://static.openfoodfacts.org/data/export.jsonl.gz",
            "retrieval_completed_at": RETRIEVED_AT,
            "activated_at": ACTIVATED_AT,
            "sha256": "b" * 64,
            "status": "ACTIVE",
        }
    )
    database[second_collection].insert_one(
        {"code": "4006381333931", "product_name": "Second"}
    )
    source = OpenFoodFactsDatasetSource(database)

    first = source.fetch(normalize_identifier("4006381333931"))
    database[CONTROL_COLLECTION].update_one(
        {"_id": ACTIVE_POINTER_ID}, {"$set": {"active_version_id": second_version_id}}
    )
    second = source.fetch(normalize_identifier("4006381333931"))
    database[CONTROL_COLLECTION].update_one(
        {"_id": ACTIVE_POINTER_ID}, {"$set": {"active_version_id": VERSION_ID}}
    )
    rolled_back = source.fetch(normalize_identifier("4006381333931"))

    assert isinstance(first, ExternalPackageFound)
    assert isinstance(second, ExternalPackageFound)
    assert isinstance(rolled_back, ExternalPackageFound)
    assert first.record.dataset_version.id == VERSION_ID
    assert second.record.dataset_version.id == second_version_id
    assert rolled_back.record.dataset_version.id == VERSION_ID


def test_missing_active_version_is_unavailable() -> None:
    database = mongomock.MongoClient().lifegoods_off

    result = OpenFoodFactsDatasetSource(database).fetch(
        normalize_identifier("4006381333931")
    )

    assert isinstance(result, ExternalPackageUnavailable)
    assert result.reason == "DATASET_UNAVAILABLE"


def test_dataset_lookup_parses_mongodb_images_selected_with_partitioned_barcode() -> None:
    database = dataset_database()
    product = {
        "code": "0000101209159",
        "product_name": "Bovetti Chocolate Spread",
        "images": {
            "selected": {
                "front": {
                    "fr": {
                        "imgid": "1",
                        "rev": "4",
                        "sizes": {
                            "100": {"w": 75, "h": 100},
                            "400": {"w": 300, "h": 400},
                        },
                    }
                },
                "ingredients": {
                    "fr": {
                        "imgid": "2",
                        "rev": "10",
                    }
                },
                "nutrition": {
                    "fr": {
                        "imgid": "3",
                        "rev": 15,
                    }
                },
            }
        },
    }
    database[COLLECTION_NAME].insert_one(product)
    source = OpenFoodFactsDatasetSource(database)

    result = source.fetch(normalize_identifier("0000101209159"))

    assert isinstance(result, ExternalPackageFound)
    images = result.record.selected_images
    assert len(images) == 3

    front_image = next(img for img in images if img.role == "front")
    assert front_image.url == (
        "https://images.openfoodfacts.org/images/products/000/010/120/9159/front_fr.4.400.jpg"
    )
    assert front_image.source_field == "images.selected.front.fr"
    assert front_image.language == "fr"

    ingredients_image = next(img for img in images if img.role == "ingredients")
    assert ingredients_image.url == (
        "https://images.openfoodfacts.org/images/products/000/010/120/9159/ingredients_fr.10.400.jpg"
    )
    assert ingredients_image.source_field == "images.selected.ingredients.fr"
    assert ingredients_image.language == "fr"

    nutrition_image = next(img for img in images if img.role == "nutrition")
    assert nutrition_image.url == (
        "https://images.openfoodfacts.org/images/products/000/010/120/9159/nutrition_fr.15.400.jpg"
    )
    assert nutrition_image.source_field == "images.selected.nutrition.fr"
    assert nutrition_image.language == "fr"


def test_dataset_lookup_handles_short_gtin8_barcode_unpartitioned() -> None:
    database = dataset_database()
    product = {
        "code": "42104964",
        "product_name": "Ciel 33cl",
        "images": {
            "selected": {
                "front": {
                    "en": {
                        "imgid": "1",
                        "rev": "2",
                    }
                }
            }
        },
    }
    database[COLLECTION_NAME].insert_one(product)
    source = OpenFoodFactsDatasetSource(database)

    result = source.fetch(normalize_identifier("42104964"))

    assert isinstance(result, ExternalPackageFound)
    images = result.record.selected_images
    assert len(images) == 1
    assert images[0].url == (
        "https://images.openfoodfacts.org/images/products/42104964/front_en.2.400.jpg"
    )
    assert images[0].source_field == "images.selected.front.en"


def test_dataset_lookup_handles_12_digit_upc_barcode_partitioning() -> None:
    database = dataset_database()
    product = {
        "code": "737628064502",
        "product_name": "UPC Product",
        "images": {
            "selected": {
                "front": {
                    "en": {
                        "imgid": "1",
                    }
                }
            }
        },
    }
    database[COLLECTION_NAME].insert_one(product)
    source = OpenFoodFactsDatasetSource(database)

    result = source.fetch(normalize_identifier("737628064502"))

    assert isinstance(result, ExternalPackageFound)
    images = result.record.selected_images
    assert len(images) == 1
    assert images[0].url == (
        "https://images.openfoodfacts.org/images/products/737/628/064/502/front_en.400.jpg"
    )
    assert images[0].source_field == "images.selected.front.en"


def test_dataset_lookup_falls_back_to_direct_image_urls() -> None:
    database = dataset_database()
    product = {
        "code": "4006381333931",
        "product_name": "Fallback Image Product",
        "lang": "en",
        "image_front_url": "https://images.openfoodfacts.org/images/products/400/front.jpg",
    }
    database[COLLECTION_NAME].insert_one(product)
    source = OpenFoodFactsDatasetSource(database)

    result = source.fetch(normalize_identifier("4006381333931"))

    assert isinstance(result, ExternalPackageFound)
    images = result.record.selected_images
    assert len(images) == 1
    assert images[0].url == (
        "https://images.openfoodfacts.org/images/products/400/front.jpg"
    )
    assert images[0].source_field == "image_front_url"
    assert images[0].role == "front"
    assert images[0].language == "en"
