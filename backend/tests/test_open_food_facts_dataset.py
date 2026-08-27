import json
from datetime import UTC, datetime
from pathlib import Path

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
    payload = json.loads((FIXTURES / "complete.json").read_text())
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
    assert result.record.selected_images == ()


def test_dataset_no_match_identifies_the_version_that_was_checked() -> None:
    result = OpenFoodFactsDatasetSource(dataset_database()).fetch(
        normalize_identifier("4006381333931")
    )

    assert isinstance(result, ExternalPackageNotFound)
    assert result.dataset_version.id == VERSION_ID


def test_missing_active_version_is_unavailable() -> None:
    database = mongomock.MongoClient().lifegoods_off

    result = OpenFoodFactsDatasetSource(database).fetch(
        normalize_identifier("4006381333931")
    )

    assert isinstance(result, ExternalPackageUnavailable)
    assert result.reason == "DATASET_UNAVAILABLE"
