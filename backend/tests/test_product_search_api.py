import json
from datetime import UTC, datetime
from pathlib import Path

import fakeredis
import mongomock
import pytest
from fastapi.testclient import TestClient

from lifegoods.main import create_app
from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    SEARCH_SCHEMA_VERSION,
    VERSIONS_COLLECTION,
    OpenFoodFactsDatasetSource,
)
from lifegoods.product_lookup import (
    RedisProductLookupCache,
    RedisProductLookupRateLimiter,
)
from lifegoods.product_search import (
    RedisProductSearchRateLimiter,
    SearchTimeoutError,
    extract_terms,
)

FIXTURES = Path(__file__).parent / "fixtures" / "open_food_facts"
VERSION_ID = "dataset-2026-08-27"
COLLECTION_NAME = "off_products_dataset_2026_08_27"
SEARCH_COLLECTION_NAME = f"{COLLECTION_NAME}_search"
RETRIEVED_AT = datetime(2026, 8, 27, 8, 0, tzinfo=UTC)
ACTIVATED_AT = datetime(2026, 8, 27, 9, 0, tzinfo=UTC)


def _dataset_database():
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
    database[COLLECTION_NAME].create_index("code")
    return database


def _dataset_database_with_search_index():
    database = _dataset_database()
    database[VERSIONS_COLLECTION].update_one(
        {"_id": VERSION_ID},
        {
            "$set": {
                "search_index": {
                    "collection_name": SEARCH_COLLECTION_NAME,
                    "status": "READY",
                    "schema_version": SEARCH_SCHEMA_VERSION,
                }
            }
        },
    )
    search_col = database[SEARCH_COLLECTION_NAME]
    search_col.create_index([("name_tokens", 1)], name="ix_search_name_tokens")
    search_col.create_index([("brand_tokens", 1)], name="ix_search_brand_tokens")
    search_col.create_index([("country_tokens", 1)], name="ix_search_country_tokens")
    search_col.create_index([("name_sort", 1), ("code", 1)], name="ix_search_sort")
    from lifegoods.open_food_facts.search_index import ensure_collection_search_indexes

    ensure_collection_search_indexes(search_col)
    return database


def _client(
    database,
    *,
    search_requests_per_minute: int = 60,
    redis_client=None,
    limiter=None,
    client_address: tuple[str, int] = ("testclient", 50000),
) -> TestClient:
    redis_client = redis_client or fakeredis.FakeRedis(decode_responses=True)
    source = OpenFoodFactsDatasetSource(database)
    app = create_app(
        product_lookup_source=source,
        product_lookup_cache=RedisProductLookupCache(redis_client, ttl_seconds=3600),
        product_lookup_limiter=RedisProductLookupRateLimiter(redis_client, 60),
        product_search_limiter=(
            limiter
            if limiter is not None
            else RedisProductSearchRateLimiter(redis_client, search_requests_per_minute)
        ),
    )
    return TestClient(app, client=client_address)


def test_search_valid_barcode_returns_attributed_product_summary() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    payload["product"].update(
        {
            "generic_name_en": "Dark chocolate bar",
            "packaging_tags": ["en:paper-box"],
            "labels_tags": ["en:halal", "en:organic"],
        }
    )
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=4006381333931")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "products" in data["data"]
    assert len(data["data"]["products"]) == 1

    product = data["data"]["products"][0]
    assert product["barcode"] == "4006381333931"
    assert product["name"] == {
        "value": "Dark Chocolate",
        "language": "en",
        "source_field": "product_name",
    }
    assert product["brands"] == ["Example Foods", "Example Brand"]
    assert product["manufacturing_places"] == ["Cambodia"]
    assert product["quantity"] == "100 g"
    assert product["generic_name"] == {
        "value": "Dark chocolate bar",
        "language": "en",
        "source_field": "generic_name_en",
    }
    assert product["packaging"] == "paper box"
    assert product["labels"] == ["halal", "organic"]
    assert product["thumbnail"] == {
        "url": "https://images.openfoodfacts.org/images/products/400/front_en.jpg",
        "language": "en",
        "source_field": "selected_images.front.display.en",
    }
    assert product["source"] == {
        "name": "Open Food Facts",
        "product_url": "https://world.openfoodfacts.org/product/4006381333931",
    }

    assert data["meta"] == {
        "source": {
            "name": "Open Food Facts",
            "product_url": "https://world.openfoodfacts.org",
        },
        "dataset": {
            "version": VERSION_ID,
            "retrieved_at": "2026-08-27T08:00:00Z",
        },
        "pagination": {
            "next_cursor": None,
        },
    }


def test_search_unknown_valid_barcode_returns_empty_list() -> None:
    database = _dataset_database()

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=3017620422003")

    assert response.status_code == 200
    assert response.json() == {
        "data": {
            "products": [],
        },
        "meta": {
            "source": {
                "name": "Open Food Facts",
                "product_url": "https://world.openfoodfacts.org",
            },
            "dataset": {
                "version": VERSION_ID,
                "retrieved_at": "2026-08-27T08:00:00Z",
            },
            "pagination": {
                "next_cursor": None,
            },
        },
    }


def test_search_formatted_and_spaced_barcode_is_accepted() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        # Hyphen-separated
        res1 = client.get("/api/v1/products/search?q=4006-3813-3393-1")
        assert res1.status_code == 200
        assert len(res1.json()["data"]["products"]) == 1
        assert res1.json()["data"]["products"][0]["barcode"] == "4006381333931"

        # Space-separated
        res2 = client.get("/api/v1/products/search?q=4006%203813%203393%201")
        assert res2.status_code == 200
        assert len(res2.json()["data"]["products"]) == 1
        assert res2.json()["data"]["products"][0]["barcode"] == "4006381333931"

        # Outer whitespace
        res3 = client.get("/api/v1/products/search?q=%204006381333931%20")
        assert res3.status_code == 200
        assert len(res3.json()["data"]["products"]) == 1


def test_search_preserves_leading_zeros() -> None:
    database = _dataset_database()
    # 12-digit UPC-A with leading zero: 012345678905
    product_data = {
        "code": "012345678905",
        "product_name": "Zero Leading Product",
        "brands": "BrandZero",
    }
    database[COLLECTION_NAME].insert_one(product_data)

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=012345678905")

    assert response.status_code == 200
    products = response.json()["data"]["products"]
    assert len(products) == 1
    assert products[0]["barcode"] == "012345678905"
    assert products[0]["name"]["value"] == "Zero Leading Product"


def test_search_invalid_barcode_length_candidate_returns_422() -> None:
    database = _dataset_database()

    with _client(database) as client:
        # 13 digits with bad check digit (3017620422003 is valid, 3017620422004 is invalid)
        response = client.get("/api/v1/products/search?q=3017620422004")
        assert response.status_code == 422
        assert response.json() == {
            "error": {
                "code": "invalid_barcode",
                "message": "Barcode is invalid",
            }
        }

        # 8 digits with bad check digit
        response8 = client.get("/api/v1/products/search?q=12345678")
        assert response8.status_code == 422
        assert response8.json()["error"]["code"] == "invalid_barcode"

        # 12 digits formatted with bad check digit
        response12 = client.get("/api/v1/products/search?q=0123-4567-8900")
        assert response12.status_code == 422
        assert response12.json()["error"]["code"] == "invalid_barcode"


def test_search_short_numeric_text_classified_as_text() -> None:
    database = _dataset_database()

    with _client(database) as client:
        # Shorter numeric input like 1664 (4 digits)
        response = client.get("/api/v1/products/search?q=1664")
        assert response.status_code == 503
        data = response.json()
        assert data["error"]["code"] == "search_unavailable"
        assert data["error"]["message"] == "Text search is temporarily unavailable"
        assert data["meta"]["dataset"]["version"] == VERSION_ID

        # 3 digits
        response3 = client.get("/api/v1/products/search?q=777")
        assert response3.status_code == 503
        assert response3.json()["error"]["code"] == "search_unavailable"


def test_search_valid_text_queries_return_search_unavailable() -> None:
    database = _dataset_database()

    with _client(database) as client:
        for query in ("coca cola", "tea", "តែបៃតង", "Kaoka 70%"):
            response = client.get(f"/api/v1/products/search?q={query}")
            assert response.status_code == 503
            data = response.json()
            assert data["error"]["code"] == "search_unavailable"
            assert data["error"]["message"] == "Text search is temporarily unavailable"
            assert data["meta"]["dataset"]["version"] == VERSION_ID


def test_search_query_limits_and_validation() -> None:
    database = _dataset_database()

    with _client(database) as client:
        # Empty string
        res_empty = client.get("/api/v1/products/search?q=")
        assert res_empty.status_code == 422
        assert res_empty.json()["error"]["code"] == "invalid_query"

        # Single character
        res_single = client.get("/api/v1/products/search?q=a")
        assert res_single.status_code == 422
        assert res_single.json()["error"]["code"] == "invalid_query"

        # Whitespace only
        res_spaces = client.get("/api/v1/products/search?q=%20%20")
        assert res_spaces.status_code == 422
        assert res_spaces.json()["error"]["code"] == "invalid_query"

        # Punctuation only
        res_punct = client.get("/api/v1/products/search?q=---")
        assert res_punct.status_code == 422
        assert res_punct.json()["error"]["code"] == "invalid_query"

        res_dots = client.get("/api/v1/products/search?q=...%20!%3F")
        assert res_dots.status_code == 422
        assert res_dots.json()["error"]["code"] == "invalid_query"

        # More than 200 chars
        long_query = "a" * 201
        res_long = client.get(f"/api/v1/products/search?q={long_query}")
        assert res_long.status_code == 422
        assert res_long.json()["error"]["code"] == "invalid_query"

        # More than 10 terms
        too_many_terms = "one two three four five six seven eight nine ten eleven"
        res_terms = client.get(f"/api/v1/products/search?q={too_many_terms}")
        assert res_terms.status_code == 422
        assert res_terms.json()["error"]["code"] == "invalid_query"


def test_search_rejects_cursor_parameter() -> None:
    database = _dataset_database()

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=4006381333931&cursor=some_token")
        assert response.status_code == 422
        assert response.json() == {
            "error": {
                "code": "invalid_cursor",
                "message": "Pagination cursor is invalid",
            }
        }


def test_search_missing_summary_fields() -> None:
    database = _dataset_database()
    # Sparse product with missing image, brands, quantity, product_name
    database[COLLECTION_NAME].insert_one({"code": "4006381333931"})

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=4006381333931")

    assert response.status_code == 200
    product = response.json()["data"]["products"][0]
    assert product["barcode"] == "4006381333931"
    assert product["name"] is None
    assert product["brands"] == []
    assert product["quantity"] is None
    assert product["generic_name"] is None
    assert product["packaging"] is None
    assert product["labels"] == []
    assert product["thumbnail"] is None
    assert product["source"] == {
        "name": "Open Food Facts",
        "product_url": "https://world.openfoodfacts.org/product/4006381333931",
    }


def test_search_rate_limiting() -> None:
    database = _dataset_database()

    with _client(database, search_requests_per_minute=2) as client:
        res1 = client.get("/api/v1/products/search?q=4006381333931")
        assert res1.status_code == 200

        res2 = client.get("/api/v1/products/search?q=4006381333931")
        assert res2.status_code == 200

        res3 = client.get("/api/v1/products/search?q=4006381333931")
        assert res3.status_code == 429
        assert res3.headers.get("Retry-After") is not None
        assert res3.json() == {
            "error": {
                "code": "rate_limit_exceeded",
                "message": "Too many requests. Please try again later.",
            }
        }


def test_search_dataset_unavailable() -> None:
    # Database with missing control pointer
    database = mongomock.MongoClient().lifegoods_off

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=4006381333931")
        assert response.status_code == 503
        assert response.json() == {
            "error": {
                "code": "dataset_unavailable",
                "message": "Dataset Snapshot is temporarily unavailable",
            }
        }


def test_search_does_not_invoke_translation() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=4006381333931")

    assert response.status_code == 200
    # Response contains no translation fields, only OriginalText name
    product = response.json()["data"]["products"][0]
    assert "khmer_translation" not in product
    assert "translation_status" not in product


def test_product_lookup_behavior_remains_unchanged() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        # Existing Product Lookup route still returns full projection
        response = client.get("/api/v1/products/4006-3813-3393-1")
        assert response.status_code == 200
        data = response.json()
        assert "product" in data["data"]
        assert "ingredients" in data["data"]["product"]
        assert "nutrition" in data["data"]["product"]
        assert data["meta"]["lookup"]["barcode"] == "4006381333931"


def test_unicode_combining_marks_preserved_in_term_extraction() -> None:
    # Khmer text with combining vowels and diacritics
    khmer_terms = extract_terms("តែបៃតង ទឹកដោះគោ")
    assert khmer_terms == ("តែបៃតង", "ទឹកដោះគោ")

    # Accented Latin characters
    french_terms = extract_terms("Café Crème Chocolat Équateur")
    assert french_terms == ("café", "crème", "chocolat", "équateur")

    # Mixed with punctuation
    mixed_terms = extract_terms("L'Oréal, Ben & Jerry's (1664)")
    assert mixed_terms == ("l", "oréal", "ben", "jerry", "s", "1664")

    # Punctuation only
    assert extract_terms("!@#$%^&*()_+-=[]{}|;':\",./<>?") == ()

    # Standalone combining marks are dropped
    assert extract_terms("\u0300\u0301 \u0302") == ()
    assert extract_terms("café \u0300") == ("café",)


def test_search_standalone_marks_only_returns_422() -> None:
    database = _dataset_database()
    with _client(database) as client:
        response = client.get("/api/v1/products/search", params={"q": "\u0300\u0301 \u0302"})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_query"


def test_search_text_ranking_order() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

    # Insert 3 products with different ranking tiers for query "sweet co"
    # 1. Exact brand match: brand_values has "sweet co" -> rank 0
    # 2. Exact name match: name_values has "sweet co" -> rank 1
    # 3. Token match: both tokens present across fields -> rank 2
    search_col.insert_many(
        [
            {
                "_id": "4006381333901",
                "code": "4006381333901",
                "name_values": ["caramel crunch"],
                "name_tokens": ["caramel", "crunch"],
                "brand_values": ["sweet co"],
                "brand_tokens": ["co", "sweet"],
                "names": [
                    {
                        "value": "Caramel Crunch",
                        "language": "en",
                        "source_field": "product_name",
                    }
                ],
                "name_sort": "caramel crunch",
                "brands": ["Sweet Co"],
            },
            {
                "_id": "4006381333902",
                "code": "4006381333902",
                "name_values": ["sweet co"],
                "name_tokens": ["co", "sweet"],
                "brand_values": ["other brand"],
                "brand_tokens": ["brand", "other"],
                "names": [
                    {
                        "value": "Sweet Co",
                        "language": "en",
                        "source_field": "product_name",
                    }
                ],
                "name_sort": "sweet co",
                "brands": ["Other Brand"],
            },
            {
                "_id": "4006381333903",
                "code": "4006381333903",
                "name_values": ["co drink"],
                "name_tokens": ["co", "drink"],
                "brand_values": ["sweet"],
                "brand_tokens": ["sweet"],
                "names": [
                    {
                        "value": "Co Drink",
                        "language": "en",
                        "source_field": "product_name",
                    }
                ],
                "name_sort": "co drink",
                "brands": ["Sweet"],
            },
        ]
    )

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=sweet co")

    assert response.status_code == 200
    data = response.json()
    products = data["data"]["products"]
    assert len(products) == 3

    # Rank 0 (exact brand) comes first
    assert products[0]["barcode"] == "4006381333901"
    assert products[0]["brands"] == ["Sweet Co"]

    # Rank 1 (exact name) comes second
    assert products[1]["barcode"] == "4006381333902"
    assert products[1]["name"]["value"] == "Sweet Co"

    # Rank 2 (token match) comes third
    assert products[2]["barcode"] == "4006381333903"

    assert data["meta"]["pagination"]["next_cursor"] is None
    assert data["meta"]["dataset"]["version"] == VERSION_ID


def test_search_text_localized_name_matching() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

    search_col.insert_one(
        {
            "_id": "4006381333931",
            "code": "4006381333931",
            "name_values": ["green tea", "thé vert", "តែបៃតង"],
            "name_tokens": ["green", "tea", "thé", "vert", "តែបៃតង"],
            "brand_values": ["zen brand"],
            "brand_tokens": ["brand", "zen"],
            "names": [
                {
                    "value": "Green Tea",
                    "language": "en",
                    "source_field": "product_name_en",
                },
                {
                    "value": "Thé Vert",
                    "language": "fr",
                    "source_field": "product_name_fr",
                },
                {
                    "value": "តែបៃតង",
                    "language": "km",
                    "source_field": "product_name_km",
                },
            ],
            "name_sort": "green tea",
            "brands": ["Zen Brand"],
        }
    )

    with _client(database) as client:
        # Search for Khmer word
        res_km = client.get("/api/v1/products/search?q=តែបៃតង")
        assert res_km.status_code == 200
        p_km = res_km.json()["data"]["products"][0]
        assert p_km["name"]["value"] == "តែបៃតង"
        assert p_km["name"]["language"] == "km"

        # Search for English word
        res_en = client.get("/api/v1/products/search?q=tea")
        assert res_en.status_code == 200
        p_en = res_en.json()["data"]["products"][0]
        assert p_en["name"]["value"] == "Green Tea"
        assert p_en["name"]["language"] == "en"

        # Search for brand with 0 name term matches falls back to standard preference (en)
        res_brand = client.get("/api/v1/products/search?q=zen brand")
        assert res_brand.status_code == 200
        p_brand = res_brand.json()["data"]["products"][0]
        assert p_brand["name"]["value"] == "Green Tea"


def test_search_text_manufacturing_place_matching_returns_place_summary() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]
    search_col.insert_one(
        {
            "_id": "4006381333931",
            "code": "4006381333931",
            "name_values": ["green tea"],
            "name_tokens": ["green", "tea"],
            "brand_values": ["zen brand"],
            "brand_tokens": ["brand", "zen"],
            "country_values": ["cambodia", "thailand"],
            "country_tokens": ["cambodia", "thailand"],
            "manufacturing_places": ["Cambodia", "Thailand"],
            "names": [
                {
                    "value": "Green Tea",
                    "language": "en",
                    "source_field": "product_name",
                }
            ],
            "name_sort": "green tea",
            "brands": ["Zen Brand"],
        }
    )

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=cambodia")

    assert response.status_code == 200
    products = response.json()["data"]["products"]
    assert len(products) == 1
    assert products[0]["name"]["value"] == "Green Tea"
    assert products[0]["manufacturing_places"] == ["Cambodia", "Thailand"]


def test_search_text_keyset_pagination() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

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

    with _client(database) as client:
        # Page 1
        page1 = client.get("/api/v1/products/search?q=chocolate")
        assert page1.status_code == 200
        data1 = page1.json()
        assert len(data1["data"]["products"]) == 20
        next_cursor = data1["meta"]["pagination"]["next_cursor"]
        assert next_cursor is not None

        # Page 2
        page2 = client.get(f"/api/v1/products/search?q=chocolate&cursor={next_cursor}")
        assert page2.status_code == 200
        data2 = page2.json()
        assert len(data2["data"]["products"]) == 5
        assert data2["meta"]["pagination"]["next_cursor"] is None

        # Check all 25 barcodes received uniquely in order
        codes1 = [p["barcode"] for p in data1["data"]["products"]]
        codes2 = [p["barcode"] for p in data2["data"]["products"]]
        all_codes = codes1 + codes2
        assert len(all_codes) == 25
        assert len(set(all_codes)) == 25
        assert all_codes == [f"40063813339{i:02d}" for i in range(25)]


def test_search_text_cursor_validation() -> None:
    database = _dataset_database_with_search_index()

    with _client(database) as client:
        # Malformed base64 cursor
        res_malformed = client.get("/api/v1/products/search?q=chocolate&cursor=invalid_base64!!!")
        assert res_malformed.status_code == 422
        assert res_malformed.json()["error"]["code"] == "invalid_cursor"

        # Cursor from different query
        # Insert a document to get a valid cursor
        search_col = database[SEARCH_COLLECTION_NAME]
        search_col.insert_many(
            [
                {
                    "_id": f"40063813339{i:02d}",
                    "code": f"40063813339{i:02d}",
                    "name_values": ["chocolate"],
                    "name_tokens": ["chocolate"],
                    "brand_values": ["brand"],
                    "brand_tokens": ["brand"],
                    "names": [{"value": "Choc", "language": "en", "source_field": "product_name"}],
                    "name_sort": f"choc {i:02d}",
                    "brands": ["Brand"],
                }
                for i in range(22)
            ]
        )
        res_valid = client.get("/api/v1/products/search?q=chocolate")
        valid_cursor = res_valid.json()["meta"]["pagination"]["next_cursor"]
        assert valid_cursor is not None

        # Pass chocolate cursor to vanilla query
        res_mismatch = client.get(f"/api/v1/products/search?q=vanilla&cursor={valid_cursor}")
        assert res_mismatch.status_code == 422
        assert res_mismatch.json()["error"]["code"] == "invalid_cursor"


def test_search_text_timeout_returns_503(monkeypatch) -> None:
    database = _dataset_database_with_search_index()

    def mock_search_text(*args, **kwargs):
        raise SearchTimeoutError("Search request timed out. Please try again.")

    monkeypatch.setattr(OpenFoodFactsDatasetSource, "search_text", mock_search_text)

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=chocolate")
        assert response.status_code == 503
        data = response.json()
        assert data["error"]["code"] == "search_timeout"
        assert data["error"]["message"] == "Search request timed out. Please try again."


def test_barcode_search_unaffected_by_search_index_state() -> None:
    database = _dataset_database()
    # Search index is absent in _dataset_database
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        # Text search fails because search index is absent
        res_text = client.get("/api/v1/products/search?q=chocolate")
        assert res_text.status_code == 503
        assert res_text.json()["error"]["code"] == "search_unavailable"

        # Barcode search succeeds completely
        res_barcode = client.get("/api/v1/products/search?q=4006381333931")
        assert res_barcode.status_code == 200
        assert len(res_barcode.json()["data"]["products"]) == 1


def test_search_http_prefix_matching_and_ranking_tiers() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

    # Insert 4 products for query "coca col":
    # 0. exact brand "coca col"
    # 1. exact name "coca col"
    # 2. complete tokens "coca", "col"
    # 3. prefix match on "col" ("cold")
    search_col.insert_many(
        [
            {
                "_id": "5449000000003",
                "code": "5449000000003",
                "name_values": ["coca cold"],
                "name_tokens": ["coca", "cold"],
                "brand_values": ["beverage co"],
                "brand_tokens": ["beverage", "co"],
                "names": [{"value": "Coca Cold", "language": "en", "source_field": "product_name"}],
                "name_sort": "coca cold",
                "brands": ["Beverage Co"],
            },
            {
                "_id": "5449000000001",
                "code": "5449000000001",
                "name_values": ["coca col"],
                "name_tokens": ["coca", "col"],
                "brand_values": ["other co"],
                "brand_tokens": ["co", "other"],
                "names": [{"value": "Coca Col", "language": "en", "source_field": "product_name"}],
                "name_sort": "coca col",
                "brands": ["Other Co"],
            },
            {
                "_id": "5449000000000",
                "code": "5449000000000",
                "name_values": ["classic drink"],
                "name_tokens": ["classic", "drink"],
                "brand_values": ["coca col"],
                "brand_tokens": ["coca", "col"],
                "names": [
                    {
                        "value": "Classic Drink",
                        "language": "en",
                        "source_field": "product_name",
                    }
                ],
                "name_sort": "classic drink",
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

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=coca col")
        assert response.status_code == 200
        data = response.json()
        products = data["data"]["products"]
        assert len(products) == 4
        # Exact brand (0) -> Exact name (1) -> Complete token (2) -> Prefix match (3)
        assert [p["barcode"] for p in products] == [
            "5449000000000",
            "5449000000001",
            "5449000000002",
            "5449000000003",
        ]
        # Metadata and attribution present
        assert data["meta"]["source"]["name"] == "Open Food Facts"
        assert data["meta"]["dataset"]["version"] == VERSION_ID


def test_search_http_earlier_terms_require_complete_tokens() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

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
            # Non-match: "cocacola" has "coca" only as prefix, not complete token!
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

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=coca col")
        assert response.status_code == 200
        products = response.json()["data"]["products"]
        assert len(products) == 1
        assert products[0]["barcode"] == "5449000000010"


def test_search_http_prefix_no_matches_returns_empty() -> None:
    database = _dataset_database_with_search_index()

    with _client(database) as client:
        response = client.get("/api/v1/products/search?q=nonexistentprefixxyz")
        assert response.status_code == 200
        assert response.json()["data"]["products"] == []


def test_search_http_punctuation_normalization_and_escaping() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

    search_col.insert_one(
        {
            "_id": "5449000000020",
            "code": "5449000000020",
            "name_values": ["coca cold"],
            "name_tokens": ["coca", "cold"],
            "brand_values": ["drink"],
            "brand_tokens": ["drink"],
            "names": [{"value": "Coca Cold", "language": "en", "source_field": "product_name"}],
            "name_sort": "coca cold",
            "brands": ["Drink"],
        }
    )

    with _client(database) as client:
        # Hyphenated query
        res_hyphen = client.get("/api/v1/products/search?q=coca-col")
        assert res_hyphen.status_code == 200
        assert len(res_hyphen.json()["data"]["products"]) == 1
        assert res_hyphen.json()["data"]["products"][0]["barcode"] == "5449000000020"

        # Punctuation with question mark / period
        res_punct = client.get("/api/v1/products/search?q=coca.%20col?")
        assert res_punct.status_code == 200
        assert len(res_punct.json()["data"]["products"]) == 1
        assert res_punct.json()["data"]["products"][0]["barcode"] == "5449000000020"


def test_search_http_prefix_localized_name_selection() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

    search_col.insert_one(
        {
            "_id": "5449000000030",
            "code": "5449000000030",
            "name_values": ["coca cold drink", "coca col"],
            "name_tokens": ["coca", "col", "cold", "drink"],
            "brand_values": ["beverage"],
            "brand_tokens": ["beverage"],
            "names": [
                {
                    "value": "Coca Cold Drink",
                    "language": "en",
                    "source_field": "product_name_en",
                },
                {
                    "value": "Coca Col",
                    "language": "fr",
                    "source_field": "product_name_fr",
                },
            ],
            "name_sort": "coca cold drink",
            "brands": ["Beverage"],
        }
    )

    with _client(database) as client:
        # Query "coca col": "Coca Col" (fr) has 2 complete token matches vs
        # "Coca Cold Drink" (en) which has 1 complete + 1 prefix.
        # Complete token matches tiebreaker prefers "Coca Col" despite "en" language!
        response = client.get("/api/v1/products/search?q=coca col")
        assert response.status_code == 200
        name = response.json()["data"]["products"][0]["name"]
        assert name["value"] == "Coca Col"
        assert name["language"] == "fr"


def test_search_http_khmer_prefix_matching() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

    search_col.insert_one(
        {
            "_id": "5449000000040",
            "code": "5449000000040",
            "name_values": ["តែបៃតង ទឹកដោះគោ"],
            "name_tokens": ["តែបៃតង", "ទឹកដោះគោ"],
            "brand_values": ["ម៉ាកខ្មែរ"],
            "brand_tokens": ["ម៉ាកខ្មែរ"],
            "names": [
                {
                    "value": "តែបៃតង ទឹកដោះគោ",
                    "language": "km",
                    "source_field": "product_name_km",
                }
            ],
            "name_sort": "តែបៃតង ទឹកដោះគោ",
            "brands": ["ម៉ាកខ្មែរ"],
        }
    )

    with _client(database) as client:
        # Search using Khmer prefix "តែបៃ"
        res_match = client.get("/api/v1/products/search?q=តែបៃ")
        assert res_match.status_code == 200
        assert len(res_match.json()["data"]["products"]) == 1
        assert res_match.json()["data"]["products"][0]["barcode"] == "5449000000040"

        # Search using different Khmer word "តែក្រ" -> no match
        res_no_match = client.get("/api/v1/products/search?q=តែក្រ")
        assert res_no_match.status_code == 200
        assert res_no_match.json()["data"]["products"] == []


def test_search_http_prefix_pagination_continuation() -> None:
    database = _dataset_database_with_search_index()
    search_col = database[SEARCH_COLLECTION_NAME]

    # Insert 25 prefix matching items
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

    with _client(database) as client:
        # Page 1 for prefix query "choc"
        page1 = client.get("/api/v1/products/search?q=choc")
        assert page1.status_code == 200
        p1_data = page1.json()
        assert len(p1_data["data"]["products"]) == 20
        cursor = p1_data["meta"]["pagination"]["next_cursor"]
        assert cursor is not None

        # Page 2
        page2 = client.get(f"/api/v1/products/search?q=choc&cursor={cursor}")
        assert page2.status_code == 200
        p2_data = page2.json()
        assert len(p2_data["data"]["products"]) == 5
        assert p2_data["meta"]["pagination"]["next_cursor"] is None

        # Ensure all 25 barcodes received without duplicates or omissions
        codes1 = [p["barcode"] for p in p1_data["data"]["products"]]
        codes2 = [p["barcode"] for p in p2_data["data"]["products"]]
        all_codes = codes1 + codes2
        assert len(all_codes) == 25
        assert len(set(all_codes)) == 25


@pytest.mark.parametrize(("field", "value"), [("f", "é"), ("n", "\ud800")])
def test_search_rejects_invalid_unicode_cursor_fields_with_422(field: str, value: str) -> None:
    import base64

    from lifegoods.product_search.query import query_fingerprint

    payload = {"f": query_fingerprint(("milk",)), "r": 0, "n": "milk", "c": "4006381333931"}
    payload[field] = value
    cursor = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    with _client(_dataset_database()) as client:
        response = client.get("/api/v1/products/search", params={"q": "milk", "cursor": cursor})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_cursor"


def test_search_pages_cross_tiers_without_duplicates_or_omissions() -> None:
    from lifegoods.identifiers import calculate_check_digit
    from lifegoods.open_food_facts import build_search_index

    # Literal tier order: exact brand, exact name, complete tokens, remaining prefixes.
    # Shared names exercise Barcode tie-breaking; overlapping tiers must appear once.
    for query, prefix_name in [("co", "cold"), ("sweet c", "sweet cold"), ("តែ ប", "តែ បៃតង")]:
        database = _dataset_database()
        records = []
        expected = []
        for tier, count in enumerate([7, 7, 13, 24]):
            for index in range(count):
                digits = f"400638{tier * 100 + index:06d}"
                code = digits + str(calculate_check_digit(digits))
                expected.append(code)
                name = [query, query, f"{query} drink", prefix_name][tier]
                records.append(
                    {
                        "code": code,
                        "product_name": name,
                        "lang": "en",
                        "brands": query if tier == 0 else "Other Brand",
                    }
                )
        # Earlier terms cannot themselves be prefixes.
        records.append({"code": "3017620422003", "product_name": "sweetened cold"})
        database[COLLECTION_NAME].insert_many(records)
        build_search_index(database, version_id=VERSION_ID)
        actual = []
        cursor = None
        with _client(database) as client:
            for _ in range(4):
                params = {"q": query}
                if cursor:
                    params["cursor"] = cursor
                response = client.get("/api/v1/products/search", params=params)
                assert response.status_code == 200
                payload = response.json()
                actual.extend(p["barcode"] for p in payload["data"]["products"])
                cursor = payload["meta"]["pagination"]["next_cursor"]
                if cursor is None:
                    break
        if query == "co":
            expected.append("3017620422003")
        assert cursor is None
        assert actual == expected


def test_search_shares_timeout_budget_across_ranking_tiers(monkeypatch) -> None:
    from lifegoods.open_food_facts import dataset as dataset_module

    clock = iter([0.0, 0.8, 1.6, 2.4])
    monkeypatch.setattr(dataset_module, "monotonic", lambda: next(clock))
    with _client(_dataset_database_with_search_index()) as client:
        response = client.get("/api/v1/products/search", params={"q": "absent"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "search_timeout"
    assert "data" not in response.json()


def test_complete_search_does_not_sort_computed_rank(monkeypatch) -> None:
    database = _dataset_database_with_search_index()
    collection = database[SEARCH_COLLECTION_NAME]
    original = collection.aggregate
    pipelines = []

    def capture(pipeline, **options):
        pipelines.append(pipeline)
        return original(pipeline, **options)

    monkeypatch.setattr(collection, "aggregate", capture)
    with _client(database) as client:
        assert client.get("/api/v1/products/search?q=milk").status_code == 200
    assert pipelines
    assert all("rank" not in stage.get("$sort", {}) for p in pipelines for stage in p)


def test_complete_stream_merge_deduplicates_all_fields_across_pages() -> None:
    from lifegoods.identifiers import calculate_check_digit
    from lifegoods.open_food_facts import build_search_index

    database = _dataset_database()
    codes = []
    for i in range(25):
        prefix = f"400638{i:06d}"
        code = prefix + str(calculate_check_digit(prefix))
        codes.append(code)
        database[COLLECTION_NAME].insert_one({
            "code": code, "product_name": "Rice Food", "brands": "Rice Farm",
            "manufacturing_places": "Rice Land",
        })
    build_search_index(database, VERSION_ID)
    with _client(database) as client:
        first = client.get("/api/v1/products/search", params={"q": "rice"}).json()
        cursor = first["meta"]["pagination"]["next_cursor"]
        assert cursor is not None
        second = client.get(
            "/api/v1/products/search", params={"q": "rice", "cursor": cursor},
        ).json()
    actual = [p["barcode"] for p in first["data"]["products"] + second["data"]["products"]]
    assert actual == sorted(codes)
    assert second["meta"]["pagination"]["next_cursor"] is None
