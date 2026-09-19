from datetime import UTC, datetime

import mongomock
import pytest
from pymongo.errors import ExecutionTimeout

from lifegoods.open_food_facts import (
    CONTROL_COLLECTION,
    SEARCH_SCHEMA_VERSION,
    VERSIONS_COLLECTION,
    OpenFoodFactsDatasetSource,
)
from lifegoods.product_lookup.contracts import OriginalText
from lifegoods.product_search.query import (
    InvalidCursorError,
    parse_and_validate_query,
)
from lifegoods.product_search.service import (
    ProductSearchResult,
    SearchProducts,
    SearchTimeoutError,
    SearchUnavailableError,
    select_matching_name,
)


def test_select_matching_name_logic() -> None:
    names = [
        {"value": "Chocolat noir", "language": "fr", "source_field": "product_name"},
        {"value": "Dark Chocolate", "language": "en", "source_field": "product_name_en"},
        {"value": "សូកូឡាខ្មៅ", "language": "km", "source_field": "product_name_km"},
    ]

    # Query matches English name
    selected = select_matching_name(names, ("dark", "chocolate"), record_language="fr")
    assert selected == OriginalText(
        value="Dark Chocolate", language="en", source_field="product_name_en"
    )

    # Query matches Khmer name
    selected_kh = select_matching_name(names, ("សូកូឡាខ្មៅ",), record_language="fr")
    assert selected_kh == OriginalText(
        value="សូកូឡាខ្មៅ", language="km", source_field="product_name_km"
    )

    # Query matches none (brand search): falls back to record_language (fr)
    fallback_fr = select_matching_name(names, ("acme",), record_language="fr")
    assert fallback_fr == OriginalText(
        value="Chocolat noir", language="fr", source_field="product_name"
    )

    # Fallback when record_language is None: prefers "en"
    fallback_en = select_matching_name(names, ("acme",), record_language=None)
    assert fallback_en == OriginalText(
        value="Dark Chocolate", language="en", source_field="product_name_en"
    )

    # Empty names
    assert select_matching_name([], ("dark",)) is None


def test_select_matching_name_prefix_preferences() -> None:
    # 1. Prefers complete token match over prefix match when query-term count ties
    candidates = [
        {"value": "Coca Cola", "language": "en", "source_field": "product_name_en"},
        {"value": "Coca Col", "language": "en", "source_field": "product_name"},
    ]
    # Query: ("coca", "col") - both candidates match 2 terms,
    # but "Coca Col" has 2 complete token matches
    selected = select_matching_name(candidates, ("coca", "col"))
    assert selected == OriginalText(value="Coca Col", language="en", source_field="product_name")

    # 2. More query-term matches beats fewer complete matches
    candidates_more_matches = [
        {"value": "Coca Cold Drink", "language": "en", "source_field": "product_name_en"},
        {"value": "Coca", "language": "en", "source_field": "product_name"},
    ]
    # Query: ("coca", "col") - "Coca Cold Drink" matches 2 terms (1 complete + 1 prefix),
    # while "Coca" matches 1 term (1 complete)
    selected_more = select_matching_name(candidates_more_matches, ("coca", "col"))
    assert selected_more == OriginalText(
        value="Coca Cold Drink", language="en", source_field="product_name_en"
    )

    # 3. Single term: complete beats prefix
    single_term_candidates = [
        {"value": "Cola Drink", "language": "en", "source_field": "product_name_en"},
        {"value": "Col Drink", "language": "en", "source_field": "product_name"},
    ]
    selected_single = select_matching_name(single_term_candidates, ("col",))
    assert selected_single == OriginalText(
        value="Col Drink", language="en", source_field="product_name"
    )

    # 4. Khmer prefix matching
    khmer_candidates = [
        {"value": "សូកូឡាខ្មៅ", "language": "km", "source_field": "product_name_km"},
        {"value": "Chocolat", "language": "fr", "source_field": "product_name_fr"},
    ]
    selected_kh_prefix = select_matching_name(khmer_candidates, ("សូកូ",), record_language="fr")
    assert selected_kh_prefix == OriginalText(
        value="សូកូឡាខ្មៅ", language="km", source_field="product_name_km"
    )

    # 5. Earlier terms require complete tokens, only final term supports prefix
    earlier_prefix_candidates = [
        {"value": "Dark Chocolate", "language": "en", "source_field": "product_name_en"},
        {"value": "Dar Chocolate", "language": "en", "source_field": "product_name"},
    ]
    # Query: ("dar", "chocolate") -> "dar" is an earlier term. "Dar" is complete match for "dar".
    # "Dark" does NOT match "dar" because "dar" is not the final term.
    selected_earlier = select_matching_name(earlier_prefix_candidates, ("dar", "chocolate"))
    assert selected_earlier == OriginalText(
        value="Dar Chocolate", language="en", source_field="product_name"
    )


def _setup_search_database():
    database = mongomock.MongoClient().lifegoods_off
    version_id = "dataset-service-test"
    col_name = "off_products_dataset_service_test"
    search_col_name = "off_product_search_dataset_service_test"

    now = datetime.now(UTC)
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": version_id,
            "collection_name": col_name,
            "status": "READY",
            "retrieval_completed_at": now,
            "activated_at": now,
            "source_url": "https://example.com/products.jsonl.gz",
            "sha256": "0" * 64,
            "search_index": {
                "collection_name": search_col_name,
                "schema_version": SEARCH_SCHEMA_VERSION,
                "status": "READY",
                "document_count": 0,
                "excluded_count": 0,
            },
        }
    )
    database[CONTROL_COLLECTION].insert_one({"_id": "active", "active_version_id": version_id})
    database[col_name].create_index("code")

    # Create required indexes
    search_col = database[search_col_name]
    search_col.create_index([("name_tokens", 1)], name="ix_search_name_tokens")
    search_col.create_index([("brand_tokens", 1)], name="ix_search_brand_tokens")
    search_col.create_index([("country_tokens", 1)], name="ix_search_country_tokens")
    search_col.create_index(
        [("information_score", -1), ("name_sort", 1), ("code", 1)],
        name="ix_search_sort",
    )

    from lifegoods.open_food_facts.search_index import ensure_collection_search_indexes

    ensure_collection_search_indexes(search_col)
    return database, version_id, search_col_name


def test_search_service_ranking_exact_brand_before_exact_name_before_token() -> None:
    database, version_id, search_col_name = _setup_search_database()
    search_col = database[search_col_name]

    # Insert 3 products:
    # 1. Exact full-query brand match: brand="coca cola", name="classic beverage" -> rank 0
    # 2. Exact full-query name match: brand="soda co", name="coca cola" -> rank 1
    # 3. Partial/other token match: brand="coca cola", name="diet soda cherry" -> rank 2
    search_col.insert_many(
        [
            {
                "_id": "5449000000996",
                "code": "5449000000996",
                "name_values": ["coca cola"],
                "name_tokens": ["coca", "cola"],
                "brand_values": ["soda co"],
                "brand_tokens": ["soda", "co"],
                "names": [{"value": "Coca Cola", "language": "en", "source_field": "product_name"}],
                "name_sort": "coca cola",
                "brands": ["Soda Co"],
            },
            {
                "_id": "5449000000286",
                "code": "5449000000286",
                "name_values": ["classic beverage"],
                "name_tokens": ["beverage", "classic"],
                "brand_values": ["coca cola"],
                "brand_tokens": ["coca", "cola"],
                "names": [
                    {"value": "Classic Beverage", "language": "en", "source_field": "product_name"}
                ],
                "name_sort": "classic beverage",
                "brands": ["Coca Cola"],
            },
            {
                "_id": "5449000000118",
                "code": "5449000000118",
                "name_values": ["diet soda cherry"],
                "name_tokens": ["cherry", "diet", "soda"],
                "brand_values": ["coca cola company"],
                "brand_tokens": ["coca", "cola", "company"],
                "names": [
                    {"value": "Diet Soda Cherry", "language": "en", "source_field": "product_name"}
                ],
                "name_sort": "diet soda cherry",
                "brands": ["Coca Cola Company"],
            },
        ]
    )

    source = OpenFoodFactsDatasetSource(database)
    service = SearchProducts(source)
    query = parse_and_validate_query("coca cola")

    result = service.execute(query)
    assert isinstance(result, ProductSearchResult)
    barcodes = [p.barcode for p in result.products]

    # Exact brand (5449000000286) -> Exact name (5449000000996) -> Token match (5449000000118)
    assert barcodes == ["5449000000286", "5449000000996", "5449000000118"]
    assert result.next_cursor is None


def test_search_service_pagination_and_cursor_continuation() -> None:
    database, version_id, search_col_name = _setup_search_database()
    search_col = database[search_col_name]

    # Insert 25 products with the same query match
    docs = [
        {
            "_id": f"40063813339{i:02d}",
            "code": f"40063813339{i:02d}",
            "name_values": [f"chocolate bar {i:02d}"],
            "name_tokens": ["bar", "chocolate"],
            "brand_values": ["sweet co"],
            "brand_tokens": ["co", "sweet"],
            "names": [
                {
                    "value": f"Chocolate Bar {i:02d}",
                    "language": "en",
                    "source_field": "product_name",
                }
            ],
            "name_sort": f"chocolate bar {i:02d}",
            "brands": ["Sweet Co"],
        }
        for i in range(25)
    ]
    search_col.insert_many(docs)

    source = OpenFoodFactsDatasetSource(database)
    service = SearchProducts(source)
    query = parse_and_validate_query("chocolate")

    # Page 1
    page1 = service.execute(query)
    assert len(page1.products) == 5
    assert page1.next_cursor is not None
    page1_codes = [p.barcode for p in page1.products]

    # Page 2
    page2 = service.execute(query, cursor=page1.next_cursor)
    assert len(page2.products) == 5
    assert page2.next_cursor is not None
    page2_codes = [p.barcode for p in page2.products]

    # Page 3
    page3 = service.execute(query, cursor=page2.next_cursor)
    assert len(page3.products) == 5
    assert page3.next_cursor is not None
    page3_codes = [p.barcode for p in page3.products]
    page4 = service.execute(query, cursor=page3.next_cursor)
    assert len(page4.products) == 5
    assert page4.next_cursor is not None
    page4_codes = [p.barcode for p in page4.products]
    page5 = service.execute(query, cursor=page4.next_cursor)
    assert len(page5.products) == 5
    assert page5.next_cursor is None
    page5_codes = [p.barcode for p in page5.products]

    # No duplicates, no omissions, strict coverage of all 25 items
    all_codes = page1_codes + page2_codes + page3_codes + page4_codes + page5_codes
    assert len(all_codes) == 25
    assert len(set(all_codes)) == 25


def test_search_service_maps_indexed_comparison_fields() -> None:
    database, version_id, search_col_name = _setup_search_database()
    database[search_col_name].insert_one(
        {
            "_id": "4006381333931",
            "code": "4006381333931",
            "name_values": ["dark chocolate"],
            "name_tokens": ["chocolate", "dark"],
            "brand_values": ["example brand"],
            "brand_tokens": ["brand", "example"],
            "names": [
                {
                    "value": "Dark Chocolate",
                    "language": "en",
                    "source_field": "product_name",
                }
            ],
            "name_sort": "dark chocolate",
            "generic_name": {
                "value": "Dark chocolate bar",
                "language": "en",
                "source_field": "generic_name_en",
            },
            "brands": ["Example Brand"],
            "quantity": "100 g",
            "packaging": "paper box",
            "labels": ["organic", "vegetarian"],
        }
    )

    result = SearchProducts(OpenFoodFactsDatasetSource(database)).execute(
        parse_and_validate_query("chocolate")
    )

    assert len(result.products) == 1
    product = result.products[0]
    assert product.generic_name == OriginalText(
        value="Dark chocolate bar",
        language="en",
        source_field="generic_name_en",
    )
    assert product.packaging == "paper box"
    assert product.labels == ["organic", "vegetarian"]

def test_search_service_rejects_mismatched_cursor() -> None:
    database, version_id, search_col_name = _setup_search_database()
    source = OpenFoodFactsDatasetSource(database)
    service = SearchProducts(source)

    query_milk = parse_and_validate_query("milk")
    query_tea = parse_and_validate_query("tea")

    # Generate cursor for "milk"
    from lifegoods.product_search.query import encode_cursor

    cursor_milk = encode_cursor(terms=query_milk.terms, rank=0, name_sort="", code="123")

    with pytest.raises(InvalidCursorError):
        service.execute(query_tea, cursor=cursor_milk)


def test_search_service_outage_raises_search_unavailable() -> None:
    database, version_id, search_col_name = _setup_search_database()
    # Mark search index as not ready
    database[VERSIONS_COLLECTION].update_one(
        {"_id": version_id},
        {"$set": {"search_index.status": "BUILDING"}},
    )
    source = OpenFoodFactsDatasetSource(database)
    service = SearchProducts(source)
    query = parse_and_validate_query("tea")

    with pytest.raises(SearchUnavailableError, match="temporarily unavailable"):
        service.execute(query)


def test_search_service_timeout_raises_search_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    database, version_id, search_col_name = _setup_search_database()
    source = OpenFoodFactsDatasetSource(database)
    service = SearchProducts(source)
    query = parse_and_validate_query("tea")

    def mock_aggregate(*args, **kwargs):
        raise ExecutionTimeout("operation exceeded time limit")

    monkeypatch.setattr(database[search_col_name], "aggregate", mock_aggregate)

    with pytest.raises(SearchTimeoutError, match="timed out"):
        service.execute(query)


def test_search_service_ranking_four_tiers_with_prefix() -> None:
    database, version_id, search_col_name = _setup_search_database()
    search_col = database[search_col_name]

    # For query: "coca col"
    # Rank 0: Exact full-query brand match ("coca col")
    # Rank 1: Exact full-query name match ("coca col")
    # Rank 2: Complete-token match (all terms "coca", "col" present as complete tokens)
    # Rank 3: Prefix match (earlier term "coca" complete, final term "col" matches "cold" prefix)
    search_col.insert_many(
        [
            {
                "_id": "5449000000003",
                "code": "5449000000003",
                "name_values": ["coca cold"],
                "name_tokens": ["coca", "cold"],
                "brand_values": ["other beverage"],
                "brand_tokens": ["beverage", "other"],
                "names": [{"value": "Coca Cold", "language": "en", "source_field": "product_name"}],
                "name_sort": "coca cold",
                "brands": ["Other Beverage"],
            },
            {
                "_id": "5449000000001",
                "code": "5449000000001",
                "name_values": ["coca col"],
                "name_tokens": ["coca", "col"],
                "brand_values": ["some brand"],
                "brand_tokens": ["brand", "some"],
                "names": [{"value": "Coca Col", "language": "en", "source_field": "product_name"}],
                "name_sort": "coca col",
                "brands": ["Some Brand"],
            },
            {
                "_id": "5449000000000",
                "code": "5449000000000",
                "name_values": ["classic can"],
                "name_tokens": ["can", "classic"],
                "brand_values": ["coca col"],
                "brand_tokens": ["coca", "col"],
                "names": [
                    {
                        "value": "Classic Can",
                        "language": "en",
                        "source_field": "product_name",
                    }
                ],
                "name_sort": "classic can",
                "brands": ["Coca Col"],
            },
            {
                "_id": "5449000000002",
                "code": "5449000000002",
                "name_values": ["coca col soda"],
                "name_tokens": ["coca", "col", "soda"],
                "brand_values": ["soda brand"],
                "brand_tokens": ["brand", "soda"],
                "names": [
                    {
                        "value": "Coca Col Soda",
                        "language": "en",
                        "source_field": "product_name",
                    }
                ],
                "name_sort": "coca col soda",
                "brands": ["Soda Brand"],
            },
        ]
    )

    source = OpenFoodFactsDatasetSource(database)
    service = SearchProducts(source)
    query = parse_and_validate_query("coca col")

    result = service.execute(query)
    barcodes = [p.barcode for p in result.products]

    # Rank 0 -> Rank 1 -> Rank 2 -> Rank 3
    assert barcodes == [
        "5449000000000",
        "5449000000001",
        "5449000000002",
        "5449000000003",
    ]


def test_search_service_earlier_terms_require_complete_tokens() -> None:
    database, version_id, search_col_name = _setup_search_database()
    search_col = database[search_col_name]

    search_col.insert_many(
        [
            # Match: "coca" complete token, "cold" prefix match on "col"
            {
                "_id": "5449000000010",
                "code": "5449000000010",
                "name_values": ["coca cold"],
                "name_tokens": ["coca", "cold"],
                "brand_values": ["drink"],
                "brand_tokens": ["drink"],
                "names": [{"value": "Coca Cold", "language": "en", "source_field": "product_name"}],
                "name_sort": "coca cold",
                "brands": ["Drink"],
            },
            # Non-match: "cocacola" has "coca" only as a prefix, not a complete token!
            {
                "_id": "5449000000011",
                "code": "5449000000011",
                "name_values": ["cocacola cold"],
                "name_tokens": ["cocacola", "cold"],
                "brand_values": ["drink"],
                "brand_tokens": ["drink"],
                "names": [
                    {
                        "value": "Cocacola Cold",
                        "language": "en",
                        "source_field": "product_name",
                    }
                ],
                "name_sort": "cocacola cold",
                "brands": ["Drink"],
            },
        ]
    )

    source = OpenFoodFactsDatasetSource(database)
    service = SearchProducts(source)
    query = parse_and_validate_query("coca col")

    result = service.execute(query)
    barcodes = [p.barcode for p in result.products]
    assert barcodes == ["5449000000010"]


def test_search_service_prefix_pagination_continuation() -> None:
    database, version_id, search_col_name = _setup_search_database()
    search_col = database[search_col_name]

    # Insert 25 prefix-only matching products (rank 3)
    # Query "choc" -> all match prefix "^choc" on "chocolate"
    docs = [
        {
            "_id": f"40063813339{i:02d}",
            "code": f"40063813339{i:02d}",
            "name_values": [f"chocolate bar {i:02d}"],
            "name_tokens": ["bar", "chocolate"],
            "brand_values": ["sweet co"],
            "brand_tokens": ["co", "sweet"],
            "names": [
                {
                    "value": f"Chocolate Bar {i:02d}",
                    "language": "en",
                    "source_field": "product_name",
                }
            ],
            "name_sort": f"chocolate bar {i:02d}",
            "brands": ["Sweet Co"],
        }
        for i in range(25)
    ]
    search_col.insert_many(docs)

    source = OpenFoodFactsDatasetSource(database)
    service = SearchProducts(source)
    query = parse_and_validate_query("choc")

    page1 = service.execute(query)
    assert len(page1.products) == 5
    assert page1.next_cursor is not None
    page1_codes = [p.barcode for p in page1.products]

    page2 = service.execute(query, cursor=page1.next_cursor)
    assert len(page2.products) == 5
    assert page2.next_cursor is not None
    page2_codes = [p.barcode for p in page2.products]

    page3 = service.execute(query, cursor=page2.next_cursor)
    assert len(page3.products) == 5
    assert page3.next_cursor is not None
    page3_codes = [p.barcode for p in page3.products]
    page4 = service.execute(query, cursor=page3.next_cursor)
    assert len(page4.products) == 5
    assert page4.next_cursor is not None
    page4_codes = [p.barcode for p in page4.products]
    page5 = service.execute(query, cursor=page4.next_cursor)
    assert len(page5.products) == 5
    assert page5.next_cursor is None
    page5_codes = [p.barcode for p in page5.products]

    all_codes = page1_codes + page2_codes + page3_codes + page4_codes + page5_codes
    assert len(all_codes) == 25
    assert len(set(all_codes)) == 25
