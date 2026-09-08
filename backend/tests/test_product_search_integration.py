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


def test_search_prefix_retrieval_and_execution_plan_on_real_mongodb(
    writer_client: MongoClient[dict[str, Any]],
    reader_client: MongoClient[dict[str, Any]],
    settings: Settings,
    test_dataset: tuple[str, str, str],
) -> None:
    version_id, source_col_name, search_col_name = test_dataset
    writer_db = writer_client[settings.off_mongodb_database]
    reader_db = reader_client[settings.off_mongodb_database]

    code_exact_brand = _make_valid_code(300)
    code_exact_name = _make_valid_code(301)
    code_complete_token = _make_valid_code(302)
    code_prefix_match = _make_valid_code(303)
    code_khmer = _make_valid_code(304)

    docs: list[dict[str, Any]] = [
        # Rank 0: exact brand "coca col"
        {
            "code": code_exact_brand,
            "product_name": "Sparkling Water",
            "brands": "Coca Col",
        },
        # Rank 1: exact name "coca col"
        {
            "code": code_exact_name,
            "product_name": "Coca Col",
            "brands": "Other Beverage",
        },
        # Rank 2: complete tokens "coca", "col"
        {
            "code": code_complete_token,
            "product_name": "Coca Col Soda",
            "brands": "Other Beverage",
        },
        # Rank 3: prefix match on "col" ("cold")
        {
            "code": code_prefix_match,
            "product_name": "Coca Cold Brew",
            "brands": "Other Beverage",
        },
        # Khmer product for prefix test
        {
            "code": code_khmer,
            "product_name": "តែបៃតង ទឹកដោះគោ",
            "brands": "Khmer Brand",
        },
    ]
    # Add 25 prefix matching products for prefix pagination
    for i in range(25):
        docs.append(
            {
                "code": _make_valid_code(400 + i),
                "product_name": f"Vanilla Cold Drink {i:02d}",
                "brands": "Drink Factory",
            }
        )

    writer_db[source_col_name].insert_many(docs)
    build_search_index(writer_db, version_id=version_id)

    # Verify execution plan uses IXSCAN on the token indexes rather than COLLSCAN
    prefix_pipeline = [
        {
            "$match": {
                "$or": [
                    {"name_tokens": {"$regex": "^col"}},
                    {"brand_tokens": {"$regex": "^col"}},
                ]
            }
        }
    ]
    explain_output = reader_db.command(
        "explain",
        {"aggregate": search_col_name, "pipeline": prefix_pipeline, "cursor": {}},
        verbosity="queryPlanner",
    )
    stages_or_planner = explain_output.get("stages", explain_output.get("queryPlanner", {}))
    explain_str = str(stages_or_planner)
    assert "IXSCAN" in explain_str
    assert "COLLSCAN" not in explain_str
    assert "ix_search_name_tokens" in explain_str or "ix_search_brand_tokens" in explain_str

    source = OpenFoodFactsDatasetSource(reader_db)
    service = SearchProducts(source)

    # 1. Test ranking tiers: 0 (exact brand) -> 1 (exact name) -> 2 (complete token) -> 3 (prefix)
    query_prefix = parse_and_validate_query("coca col")
    result = service.execute(query_prefix)
    barcodes = [p.barcode for p in result.products]
    assert barcodes == [
        code_exact_brand,
        code_exact_name,
        code_complete_token,
        code_prefix_match,
    ]
    # Verify selected summary name on prefix match uses complete-match preference
    assert result.products[2].name is not None
    assert result.products[2].name.value == "Coca Col Soda"
    assert result.products[3].name is not None
    assert result.products[3].name.value == "Coca Cold Brew"

    # 2. Test Khmer prefix matching
    query_khmer = parse_and_validate_query("តែបៃ")
    result_khmer = service.execute(query_khmer)
    assert len(result_khmer.products) == 1
    assert result_khmer.products[0].barcode == code_khmer

    # 3. Test pagination across 25 prefix matches for "vanilla col"
    query_paged = parse_and_validate_query("vanilla col")
    p1 = service.execute(query_paged)
    assert len(p1.products) == 20
    assert p1.next_cursor is not None

    p2 = service.execute(query_paged, cursor=p1.next_cursor)
    assert len(p2.products) == 5
    assert p2.next_cursor is None

    p1_codes = [p.barcode for p in p1.products]
    p2_codes = [p.barcode for p in p2.products]
    combined_codes = p1_codes + p2_codes
    assert len(combined_codes) == 25
    assert len(set(combined_codes)) == 25

