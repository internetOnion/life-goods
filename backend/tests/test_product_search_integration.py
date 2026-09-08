from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from pymongo import MongoClient

from lifegoods.core.settings import Settings
from lifegoods.identifiers import calculate_check_digit
from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
    OpenFoodFactsDatasetSource,
    build_search_index,
    search_collection_name,
    validate_search_index_readiness,
)
from lifegoods.product_search import (
    InvalidCursorError,
    SearchProducts,
    parse_and_validate_query,
)

pytestmark = pytest.mark.integration

WRITER_URI = (
    "mongodb://lifegoods_writer:lifegoods_writer@localhost:27018/"
    "lifegoods_off?authSource=lifegoods_off"
)


@pytest.fixture(scope="module")
def settings() -> Settings:
    return Settings()


@pytest.fixture(scope="module")
def writer_client(settings: Settings) -> Iterator[MongoClient[dict[str, Any]]]:
    client: MongoClient[dict[str, Any]] = MongoClient(
        WRITER_URI,
        serverSelectionTimeoutMS=settings.off_mongodb_timeout_ms,
    )
    yield client
    client.close()


@pytest.fixture(scope="module")
def reader_client(settings: Settings) -> Iterator[MongoClient[dict[str, Any]]]:
    client: MongoClient[dict[str, Any]] = MongoClient(
        settings.off_mongodb_uri,
        serverSelectionTimeoutMS=settings.off_mongodb_timeout_ms,
    )
    yield client
    client.close()


def _make_valid_code(prefix_num: int) -> str:
    prefix = f"400638{prefix_num:06d}"
    check = calculate_check_digit(prefix)
    return f"{prefix}{check}"


@pytest.fixture
def test_dataset(
    writer_client: MongoClient[dict[str, Any]],
    settings: Settings,
) -> Iterator[tuple[str, str, str]]:
    writer_db = writer_client[settings.off_mongodb_database]

    run_id = uuid.uuid4().hex[:8]
    version_id = f"test-search-{run_id}"
    source_col_name = f"off_products_test_{run_id}"
    search_col_name = search_collection_name(version_id)

    # Backup existing active pointer if present
    existing_pointer = writer_db[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID})

    writer_db[VERSIONS_COLLECTION].insert_one(
        {
            "_id": version_id,
            "collection_name": source_col_name,
            "source_url": "https://example.com/test_export.jsonl.gz",
            "retrieval_completed_at": datetime.now(UTC),
            "activated_at": datetime.now(UTC),
            "sha256": "0" * 64,
            "status": "ACTIVE",
        }
    )
    writer_db[CONTROL_COLLECTION].update_one(
        {"_id": ACTIVE_POINTER_ID},
        {"$set": {"active_version_id": version_id}},
        upsert=True,
    )

    yield version_id, source_col_name, search_col_name

    # Teardown
    writer_db.drop_collection(source_col_name)
    writer_db.drop_collection(search_col_name)
    writer_db[VERSIONS_COLLECTION].delete_one({"_id": version_id})
    if existing_pointer is not None:
        writer_db[CONTROL_COLLECTION].replace_one(
            {"_id": ACTIVE_POINTER_ID}, existing_pointer, upsert=True
        )
    else:
        writer_db[CONTROL_COLLECTION].delete_one({"_id": ACTIVE_POINTER_ID})


def test_build_search_index_lifecycle(
    writer_client: MongoClient[dict[str, Any]],
    reader_client: MongoClient[dict[str, Any]],
    settings: Settings,
    test_dataset: tuple[str, str, str],
) -> None:
    version_id, source_col_name, search_col_name = test_dataset
    writer_db = writer_client[settings.off_mongodb_database]
    reader_db = reader_client[settings.off_mongodb_database]

    # Insert 5 valid products + 2 invalid barcode documents
    docs: list[dict[str, Any]] = [
        {
            "code": _make_valid_code(i),
            "product_name": f"Product {i}",
            "brands": "BrandCo",
        }
        for i in range(5)
    ]
    docs.append({"code": "invalid_code", "product_name": "Bad 1"})
    docs.append({"code": "12345678", "product_name": "Bad 2"})  # Bad check digit
    writer_db[source_col_name].insert_many(docs)

    # Build search index
    stats = build_search_index(writer_db, version_id=version_id)

    assert stats["search_index"]["document_count"] == 5
    assert stats["search_index"]["excluded_count"] == 2

    # Verify manifest in versions collection
    version_doc = writer_db[VERSIONS_COLLECTION].find_one({"_id": version_id})
    assert version_doc is not None
    assert version_doc["search_index"] == {
        "collection_name": search_col_name,
        "status": "READY",
        "schema_version": 1,
        "document_count": 5,
        "excluded_count": 2,
    }

    # Verify MongoDB indexes on the search collection
    indexes = writer_db[search_col_name].index_information()
    assert "ix_search_name_tokens" in indexes
    assert "ix_search_brand_tokens" in indexes
    assert "ix_search_sort" in indexes

    # Verify reader can validate readiness
    ready_col_name = validate_search_index_readiness(reader_db, version_id)
    assert ready_col_name == search_col_name


def test_search_ranking_and_keyset_pagination_on_real_mongodb(
    writer_client: MongoClient[dict[str, Any]],
    reader_client: MongoClient[dict[str, Any]],
    settings: Settings,
    test_dataset: tuple[str, str, str],
) -> None:
    version_id, source_col_name, search_col_name = test_dataset
    writer_db = writer_client[settings.off_mongodb_database]
    reader_db = reader_client[settings.off_mongodb_database]

    # 1. Exact brand product: brand is "Sweet Co", name is "Caramel Crunch"
    code_exact_brand = _make_valid_code(100)
    # 2. Exact name product: brand is "Other Brand", name is "Sweet Co"
    code_exact_name = _make_valid_code(101)
    # 3. Token match product: "Sweet Biscuit" by "Co Bakery"
    code_token_match = _make_valid_code(102)
    # 4. 25 chocolate items for pagination test
    docs: list[dict[str, Any]] = [
        {
            "code": code_exact_brand,
            "product_name": "Caramel Crunch",
            "brands": "Sweet Co",
        },
        {
            "code": code_exact_name,
            "product_name": "Sweet Co",
            "brands": "Other Brand",
        },
        {
            "code": code_token_match,
            "product_name": "Sweet Biscuit",
            "brands": "Co Bakery",
        },
    ]

    for i in range(25):
        docs.append(
            {
                "code": _make_valid_code(200 + i),
                "product_name": f"Chocolate Bar {i:02d}",
                "brands": "Choco Factory",
            }
        )

    writer_db[source_col_name].insert_many(docs)

    build_search_index(writer_db, version_id=version_id)

    source = OpenFoodFactsDatasetSource(reader_db)
    service = SearchProducts(source)

    # Test 1: Ranking tiers for "sweet co"
    # Exact brand (rank 0) should precede exact name (rank 1), then token match (rank 2)
    query_ranked = parse_and_validate_query("sweet co")
    result_ranked = service.execute(query_ranked)
    assert len(result_ranked.products) == 3
    assert result_ranked.products[0].barcode == code_exact_brand
    assert result_ranked.products[0].brands == ["Sweet Co"]
    assert result_ranked.products[1].barcode == code_exact_name
    assert result_ranked.products[1].name is not None
    assert result_ranked.products[1].name.value == "Sweet Co"
    assert result_ranked.products[2].barcode == code_token_match

    # Test 2: Keyset pagination across 25 items for "chocolate"
    query_choc = parse_and_validate_query("chocolate")
    page1 = service.execute(query_choc)
    assert len(page1.products) == 20
    assert page1.next_cursor is not None

    page2 = service.execute(query_choc, cursor=page1.next_cursor)
    assert len(page2.products) == 5
    assert page2.next_cursor is None

    barcodes_page1 = [p.barcode for p in page1.products]
    barcodes_page2 = [p.barcode for p in page2.products]
    all_barcodes = barcodes_page1 + barcodes_page2
    assert len(all_barcodes) == 25
    assert len(set(all_barcodes)) == 25

    # Test 3: Cursor tamper rejection
    with pytest.raises(InvalidCursorError):
        # Pass page1 cursor from "chocolate" to "vanilla" query
        query_vanilla = parse_and_validate_query("vanilla")
        service.execute(query_vanilla, cursor=page1.next_cursor)
