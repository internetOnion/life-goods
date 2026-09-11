import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

import fakeredis
import httpx2 as httpx
import mongomock
import pytest
from fastapi.testclient import TestClient
from pymongo.errors import AutoReconnect, PyMongoError

from lifegoods.generated_data.budget import InMemoryTranslationBudgetLimiter
from lifegoods.generated_data.cache import InMemoryTranslationHotCache
from lifegoods.generated_data.coordinator import (
    TranslationCoordinator,
    result_to_stored_artifact,
)
from lifegoods.generated_data.repository import InMemoryGeneratedDataRepository
from lifegoods.identifiers import normalize_identifier
from lifegoods.ingredient_matching.importer import import_ingredient_taxonomy
from lifegoods.ingredient_matching.models import IngredientMatcher
from lifegoods.main import create_app
from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
    OpenFoodFactsDatasetSource,
)
from lifegoods.product_lookup import (
    InMemoryProductLookupCache,
    RedisProductLookupCache,
    RedisProductLookupRateLimiter,
    product_lookup_cache_key,
)
from lifegoods.product_lookup.contracts import (
    EnvironmentProjection,
    NutritionProjection,
    OriginalText,
    PackagingProjection,
    ProductIdentityProjection,
    ProductProjection,
    SourceAssessmentsProjection,
    SourceRecordMetadataProjection,
)
from lifegoods.translation.module import KhmerTranslationModule
from lifegoods.translation.provider import FakeTranslationProvider

FIXTURES = Path(__file__).parent / "fixtures" / "open_food_facts"
VERSION_ID = "dataset-2026-08-27"
COLLECTION_NAME = "off_products_dataset_2026_08_27"
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
    return database


def _make_test_coordinator(
    provider: FakeTranslationProvider | None = None,
    repository: InMemoryGeneratedDataRepository | None = None,
    cache: InMemoryTranslationHotCache | None = None,
    budget: InMemoryTranslationBudgetLimiter | None = None,
) -> TranslationCoordinator:
    p = provider or FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
            "category_0": "សូកូឡា",
            "category_1": "អាហារសម្រន់",
        }
    )
    m = KhmerTranslationModule(p)
    repo = repository or InMemoryGeneratedDataRepository()
    c = cache or InMemoryTranslationHotCache(ttl_seconds=3600)
    b = budget or InMemoryTranslationBudgetLimiter(requests_per_minute=60)
    return TranslationCoordinator(m, repo, c, b)


def _client(
    database,
    *,
    requests_per_minute: int = 60,
    redis_client=None,
    metrics=None,
    limiter=None,
    coordinator: TranslationCoordinator | None = None,
    client_address: tuple[str, int] = ("testclient", 50000),
    ingredient_matcher=None,
) -> TestClient:
    redis_client = redis_client or fakeredis.FakeRedis(decode_responses=True)
    source = OpenFoodFactsDatasetSource(database)
    coord = coordinator if coordinator is not None else _make_test_coordinator()
    app = create_app(
        product_lookup_source=source,
        product_lookup_cache=RedisProductLookupCache(redis_client, ttl_seconds=3600),
        product_lookup_limiter=(
            limiter
            if limiter is not None
            else RedisProductLookupRateLimiter(redis_client, requests_per_minute)
        ),
        product_lookup_metrics=metrics,
        ingredient_matcher=ingredient_matcher,
        translation_coordinator=coord,
    )
    return TestClient(app, client=client_address)


def test_product_lookup_returns_complete_raw_source_record_with_provenance() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    payload["product"]["ecoscore_data"] = {
        "adjustments": [{"name": "origins_of_ingredients", "value": None}]
    }
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        response = client.get("/api/experimental/products/4006-3813-3393-1")

    assert response.status_code == 200
    expected_source_record = {
        key: value for key, value in payload["product"].items() if key != "_id"
    }
    assert response.json() == {
        "data": {
            "source_record": expected_source_record,
            "allergen_analysis": {
                "off": {"state": "available", "tags": ["en:milk"]},
                "ingredient_matching": {
                    "state": "unavailable",
                    "reason": "matcher_unavailable",
                    "quality": None,
                    "tags": [],
                    "evidence": [],
                    "qualifications": [],
                    "limitations": [],
                    "unmatched_texts": [],
                    "unmatched_spans": [],
                    "input": {
                        "source_field": "ingredients_text_en",
                        "language": "en",
                    },
                    "taxonomy_sha256": None,
                    "allergen_taxonomy_sha256": None,
                },
                "comparison": {
                    "state": "unavailable",
                    "in_both": [],
                    "off_only": [],
                    "ingredient_matching_only": [],
                    "sets_equal": None,
                },
            },
        },
        "meta": {
            "lookup": {"barcode": "4006381333931"},
            "source": {
                "name": "Open Food Facts",
                "product_url": ("https://world.openfoodfacts.org/product/4006381333931"),
            },
            "dataset": {
                "version": VERSION_ID,
                "retrieved_at": "2026-08-27T08:00:00Z",
            },
        },
    }
    assert "_id" not in response.json()["data"]["source_record"]


def test_product_lookup_compares_off_and_ingredient_allergens_when_off_is_empty() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "ingredients_text_en": "wheat flour, peanuts",
            "allergens_tags": [],
        }
    )
    import_ingredient_taxonomy(database)
    matcher = IngredientMatcher(database, enabled=True)

    with _client(database, ingredient_matcher=matcher) as client:
        response = client.get("/api/experimental/products/4006381333931")
        cached_response = client.get("/api/experimental/products/4006381333931")

    analysis = response.json()["data"]["allergen_analysis"]
    assert analysis["off"] == {"state": "empty", "tags": []}
    assert analysis["ingredient_matching"]["state"] == "completed"
    assert analysis["ingredient_matching"]["tags"] == ["en:gluten", "en:peanuts"]
    assert analysis["comparison"] == {
        "state": "available",
        "in_both": [],
        "off_only": [],
        "ingredient_matching_only": ["en:gluten", "en:peanuts"],
        "sets_equal": False,
    }
    assert cached_response.json()["data"]["allergen_analysis"] == analysis


def test_product_lookup_excludes_qualified_matches_from_positive_comparison() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "ingredients_text_en": "wheat flour, may contain peanuts",
            "allergens_tags": ["en:gluten"],
        }
    )
    import_ingredient_taxonomy(database)
    matcher = IngredientMatcher(database, enabled=True)

    with _client(database, ingredient_matcher=matcher) as client:
        response = client.get("/api/experimental/products/4006381333931")
        cached_response = client.get("/api/experimental/products/4006381333931")

    analysis = response.json()["data"]["allergen_analysis"]
    assert analysis["ingredient_matching"]["tags"] == ["en:gluten"]
    assert [
        item["qualification"] for item in analysis["ingredient_matching"]["qualifications"]
    ] == ["precautionary_statement"]
    assert analysis["comparison"] == {
        "state": "available",
        "in_both": ["en:gluten"],
        "off_only": [],
        "ingredient_matching_only": [],
        "sets_equal": True,
    }
    assert cached_response.json()["data"]["allergen_analysis"] == analysis


def test_product_lookup_keeps_invalid_off_tags_separate_from_matching() -> None:
    database = _dataset_database()
    source_record = {
        "code": "4006381333931",
        "ingredients_text_en": "milk",
        "allergens_tags": ["en:milk", 42],
    }
    expected_source_record = dict(source_record)
    database[COLLECTION_NAME].insert_one(source_record)
    import_ingredient_taxonomy(database)
    matcher = IngredientMatcher(database, enabled=True)

    with _client(database, ingredient_matcher=matcher) as client:
        response = client.get("/api/experimental/products/4006381333931")

    body = response.json()
    assert body["data"]["source_record"] == expected_source_record
    assert body["data"]["allergen_analysis"]["off"] == {
        "state": "invalid",
        "tags": ["en:milk"],
    }
    assert body["data"]["allergen_analysis"]["comparison"]["state"] == "unavailable"


@pytest.mark.parametrize(
    ("source_record", "reason"),
    [
        ({"allergens_tags": []}, "ingredient_text_unavailable"),
        (
            {"ingredients_text": "lait", "lang": "fr", "allergens_tags": []},
            "ingredient_language_unsupported",
        ),
        (
            {
                "ingredients_text_en": "x" * 2001,
                "allergens_tags": [],
            },
            "ingredient_text_too_long",
        ),
    ],
    ids=["missing-text", "unsupported-language", "text-too-long"],
)
def test_product_lookup_reports_ingredient_matching_unavailable_reasons(
    source_record: dict[str, object], reason: str
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {"code": "4006381333931", **source_record}
    )
    import_ingredient_taxonomy(database)
    matcher = IngredientMatcher(database, enabled=True)

    with _client(database, ingredient_matcher=matcher) as client:
        response = client.get("/api/experimental/products/4006381333931")

    analysis = response.json()["data"]["allergen_analysis"]["ingredient_matching"]
    assert analysis["state"] == "unavailable"
    assert analysis["reason"] == reason


def test_product_lookup_remains_available_when_matcher_is_disabled() -> None:
    database = _dataset_database()
    source_record = {
        "code": "4006381333931",
        "ingredients_text_en": "milk",
        "allergens_tags": [],
    }
    expected_source_record = dict(source_record)
    database[COLLECTION_NAME].insert_one(source_record)
    matcher = IngredientMatcher(database, enabled=False)

    with _client(database, ingredient_matcher=matcher) as client:
        response = client.get("/api/experimental/products/4006381333931")

    body = response.json()
    assert response.status_code == 200
    assert body["data"]["source_record"] == expected_source_record
    assert body["data"]["allergen_analysis"]["ingredient_matching"]["reason"] == (
        "matcher_unavailable"
    )


def test_ingredient_match_post_allows_configured_origin_cors_preflight() -> None:
    database = _dataset_database()
    import_ingredient_taxonomy(database)
    matcher = IngredientMatcher(database, enabled=True)

    with _client(database, ingredient_matcher=matcher) as client:
        response = client.options(
            "/api/experimental/ingredient-matches",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_ingredient_match_post_rejects_unconfigured_origin_cors_preflight() -> None:
    database = _dataset_database()

    with _client(database) as client:
        response = client.options(
            "/api/experimental/ingredient-matches",
            headers={
                "Origin": "https://unconfigured.example",
                "Access-Control-Request-Method": "POST",
            },
        )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize(
    "payload",
    [
        None,
        {},
        {"ingredient_text": ""},
        {"ingredient_text": "   "},
        {"ingredient_text": "x" * 2001},
    ],
    ids=["missing-body", "missing-field", "blank", "whitespace", "too-long"],
)
def test_ingredient_match_validation_uses_one_stable_error_envelope(payload) -> None:
    database = _dataset_database()

    with _client(database) as client:
        response = (
            client.post("/api/experimental/ingredient-matches")
            if payload is None
            else client.post("/api/experimental/ingredient-matches", json=payload)
        )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "invalid_ingredient_text",
            "message": "Enter ingredient text from 1 to 2000 characters.",
        }
    }


def test_ingredient_match_malformed_json_uses_the_same_error_envelope() -> None:
    database = _dataset_database()

    with _client(database) as client:
        response = client.post(
            "/api/experimental/ingredient-matches",
            content="{not-json",
            headers={"content-type": "application/json"},
        )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "invalid_ingredient_text",
            "message": "Enter ingredient text from 1 to 2000 characters.",
        }
    }


def test_product_lookup_preserves_sparse_source_record_without_inference() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "sparse.json").read_text(encoding="utf-8"))
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        response = client.get("/api/experimental/products/8850000000003")

    expected = {key: value for key, value in payload["product"].items() if key != "_id"}
    assert response.status_code == 200
    assert response.json()["data"]["source_record"] == expected
    assert response.json()["data"]["source_record"]["quantity"] is None


@pytest.mark.parametrize(
    ("entered", "normalized"),
    [
        ("9638 5074", "96385074"),
        ("0-12345-67890-5", "012345678905"),
        ("4006 381 333931", "4006381333931"),
        ("1 0012345 000017", "10012345000017"),
    ],
)
def test_product_lookup_supports_each_barcode_length_at_the_http_boundary(
    entered: str,
    normalized: str,
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": normalized, "product_name": "Known Product"})

    with _client(database) as client:
        response = client.get("/api/experimental/products/" + quote(entered, safe="-"))

    assert response.status_code == 200
    assert response.json()["meta"]["lookup"]["barcode"] == normalized


@pytest.mark.parametrize(
    "invalid_input",
    [
        "1234",  # unsupported length
        "4006381333932",  # invalid check digit
        "400638133393A",  # invalid characters
    ],
    ids=["unsupported-length", "invalid-check-digit", "invalid-characters"],
)
def test_invalid_barcode_uses_stable_error_and_never_enters_lookup_cache(
    invalid_input: str,
) -> None:
    database = _dataset_database()
    redis_client = fakeredis.FakeRedis(decode_responses=True)

    with _client(database, redis_client=redis_client) as client:
        response = client.get("/api/experimental/products/" + quote(invalid_input, safe=""))

    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "invalid_barcode", "message": "Barcode is invalid"}
    }
    assert list(redis_client.scan_iter(match="product-lookup:cache:*")) == []


def test_unknown_product_identifies_the_dataset_snapshot_that_was_checked() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].create_index("code")

    with _client(database) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "product_not_found", "message": "Product not found"},
        "meta": {
            "dataset": {
                "version": VERSION_ID,
                "retrieved_at": "2026-08-27T08:00:00Z",
            }
        },
    }


@pytest.mark.parametrize(
    "break_dataset",
    [
        lambda database: database[CONTROL_COLLECTION].delete_many({}),
        lambda database: database[VERSIONS_COLLECTION].delete_many({}),
        lambda database: database[VERSIONS_COLLECTION].update_one(
            {"_id": VERSION_ID}, {"$set": {"status": "FAILED"}}
        ),
        lambda database: None,
    ],
    ids=["missing-pointer", "missing-manifest", "invalid-manifest", "missing-collection"],
)
def test_dataset_snapshot_faults_are_unavailable_instead_of_not_found(
    break_dataset,
) -> None:
    database = _dataset_database()
    break_dataset(database)

    with _client(database) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "dataset_unavailable",
            "message": "Dataset Snapshot is temporarily unavailable",
        }
    }


def test_mongodb_failure_is_reported_as_dataset_unavailable(monkeypatch) -> None:
    database = _dataset_database()

    def fail_lookup(*_args, **_kwargs):
        raise AutoReconnect("private database detail")

    monkeypatch.setattr(database[CONTROL_COLLECTION], "find_one", fail_lookup)
    with _client(database) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 503
    assert "private database detail" not in response.text


class RecordingMetrics:
    def __init__(self) -> None:
        self.events: list[dict[str, object]] = []

    def observe(self, **event: object) -> None:
        self.events.append(event)


def test_non_json_source_value_fails_with_a_sanitized_internal_error() -> None:
    database = _dataset_database()
    metrics = RecordingMetrics()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931", "storage_date": RETRIEVED_AT})

    with _client(database, metrics=metrics) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "Product Lookup failed unexpectedly",
        }
    }
    assert metrics.events[0]["outcome"] == "internal_error"


class ExplodingLimiter:
    def try_acquire(self, _key: str) -> tuple[bool, int]:
        raise RuntimeError("private limiter detail")


class ExplodingMetrics:
    def observe(self, **_event: object) -> None:
        raise RuntimeError("private metrics detail")


@pytest.mark.parametrize(
    ("limiter", "metrics"),
    [
        (ExplodingLimiter(), None),
        (None, ExplodingMetrics()),
    ],
    ids=["limiter-failure", "metrics-failure"],
)
def test_unexpected_dependency_failure_uses_sanitized_internal_error(
    limiter,
    metrics,
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931"})

    with _client(database, limiter=limiter, metrics=metrics) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "Product Lookup failed unexpectedly",
        }
    }
    assert "private" not in response.text


def test_found_outcome_is_served_from_cache_after_source_record_changes() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931", "product_name": "Original"})
    redis_client = fakeredis.FakeRedis(decode_responses=True)

    with _client(database, redis_client=redis_client) as client:
        first = client.get("/api/experimental/products/4006381333931")
        database[COLLECTION_NAME].update_one(
            {"code": "4006381333931"}, {"$set": {"product_name": "Changed"}}
        )
        second = client.get("/api/experimental/products/4006381333931")

    assert first.json()["data"]["source_record"]["product_name"] == "Original"
    assert second.json() == first.json()


def test_not_found_outcome_is_served_from_cache_after_source_record_is_added() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].create_index("code")
    redis_client = fakeredis.FakeRedis(decode_responses=True)

    with _client(database, redis_client=redis_client) as client:
        first = client.get("/api/experimental/products/4006381333931")
        database[COLLECTION_NAME].insert_one(
            {"code": "4006381333931", "product_name": "Added later"}
        )
        second = client.get("/api/experimental/products/4006381333931")

    assert first.status_code == 404
    assert second.status_code == 404
    assert second.json() == first.json()


def test_cache_is_isolated_by_dataset_snapshot_version() -> None:
    database = _dataset_database()
    second_version = "dataset-2026-08-28"
    second_collection = "off_products_dataset_2026_08_28"
    database[COLLECTION_NAME].insert_one(
        {"code": "4006381333931", "product_name": "First snapshot"}
    )
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": second_version,
            "collection_name": second_collection,
            "source_url": "https://static.openfoodfacts.org/data/export.jsonl.gz",
            "retrieval_completed_at": datetime(2026, 8, 28, 8, 0, tzinfo=UTC),
            "activated_at": datetime(2026, 8, 28, 9, 0, tzinfo=UTC),
            "sha256": "b" * 64,
            "status": "ACTIVE",
        }
    )
    database[second_collection].insert_one(
        {"code": "4006381333931", "product_name": "Second snapshot"}
    )

    with _client(database) as client:
        first = client.get("/api/experimental/products/4006381333931")
        database[CONTROL_COLLECTION].update_one(
            {"_id": ACTIVE_POINTER_ID},
            {"$set": {"active_version_id": second_version}},
        )
        second = client.get("/api/experimental/products/4006381333931")

    assert first.json()["data"]["source_record"]["product_name"] == "First snapshot"
    assert second.json()["data"]["source_record"]["product_name"] == "Second snapshot"
    assert second.json()["meta"]["dataset"]["version"] == second_version


def test_malformed_cache_entry_is_repaired_from_dataset_snapshot() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931", "product_name": "Authoritative"})
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    key = product_lookup_cache_key(VERSION_ID, normalize_identifier("4006381333931"))
    redis_client.set(key, "not-json")

    with _client(database, redis_client=redis_client) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 200
    assert response.json()["data"]["source_record"]["product_name"] == "Authoritative"
    repaired_cache_value = redis_client.get(key)
    assert isinstance(repaired_cache_value, str)
    assert json.loads(repaired_cache_value)["outcome"] == "found"


def test_redis_cache_outage_falls_through_without_logging_shopper_data(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Do not log this Source Record",
        }
    )
    server = fakeredis.FakeServer()
    redis_client = fakeredis.FakeRedis(server=server, decode_responses=True)
    server.connected = False
    for logger_name in (
        "lifegoods.product_lookup.cache",
        "lifegoods.product_lookup.rate_limit",
        "lifegoods.product_lookup.router",
    ):
        monkeypatch.setattr(logging.getLogger(logger_name), "disabled", False)

    with (
        caplog.at_level("INFO"),
        _client(database, redis_client=redis_client) as client,
    ):
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 200
    product_lookup_records = [
        record for record in caplog.records if record.name.startswith("lifegoods.product_lookup")
    ]
    messages = " ".join(record.getMessage() for record in product_lookup_records)
    extras = " ".join(
        str(
            {
                key: value
                for key, value in record.__dict__.items()
                if key
                in {
                    "event",
                    "outcome",
                    "cache_status",
                    "dataset_version",
                    "failure_category",
                }
            }
        )
        for record in product_lookup_records
    )
    logged = messages + extras
    assert "4006381333931" not in logged
    assert "Do not log this Source Record" not in logged
    assert "testclient" not in logged
    assert "product_lookup_cache_failure" in logged
    assert "product_lookup_completed" in logged


def test_in_memory_cache_expires_at_the_http_seam() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931", "product_name": "Before expiry"})
    clock = 10.0
    cache = InMemoryProductLookupCache(ttl_seconds=5, monotonic=lambda: clock)
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    source = OpenFoodFactsDatasetSource(database)
    app = create_app(
        product_lookup_source=source,
        product_lookup_cache=cache,
        product_lookup_limiter=RedisProductLookupRateLimiter(redis_client, 60),
    )

    with TestClient(app) as client:
        first = client.get("/api/experimental/products/4006381333931")
        database[COLLECTION_NAME].update_one(
            {"code": "4006381333931"},
            {"$set": {"product_name": "After expiry"}},
        )
        cached = client.get("/api/experimental/products/4006381333931")
        clock = 15.0
        refreshed = client.get("/api/experimental/products/4006381333931")

    assert first.json()["data"]["source_record"]["product_name"] == "Before expiry"
    assert cached.json()["data"]["source_record"]["product_name"] == "Before expiry"
    assert refreshed.json()["data"]["source_record"]["product_name"] == "After expiry"


def test_rate_limit_applies_before_validation_and_returns_retry_after() -> None:
    database = _dataset_database()
    redis_client = fakeredis.FakeRedis(decode_responses=True)

    with _client(database, redis_client=redis_client, requests_per_minute=1) as client:
        invalid = client.get("/api/experimental/products/1234")
        limited = client.get("/api/experimental/products/4006381333931")

    assert invalid.status_code == 422
    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "60"
    assert limited.json() == {
        "error": {
            "code": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
        }
    }
    assert list(redis_client.scan_iter(match="product-lookup:cache:*")) == []


def test_rate_limit_isolated_by_client_and_ignores_forwarded_headers() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].create_index("code")
    server = fakeredis.FakeServer()
    first_redis = fakeredis.FakeRedis(server=server, decode_responses=True)
    second_redis = fakeredis.FakeRedis(server=server, decode_responses=True)

    with _client(
        database,
        redis_client=first_redis,
        requests_per_minute=1,
        client_address=("203.0.113.10", 50000),
    ) as first_client:
        first = first_client.get(
            "/api/experimental/products/4006381333931",
            headers={"x-forwarded-for": "10.0.0.1"},
        )
        spoofed = first_client.get(
            "/api/experimental/products/4006381333931",
            headers={"x-forwarded-for": "10.0.0.2"},
        )
    with _client(
        database,
        redis_client=second_redis,
        requests_per_minute=1,
        client_address=("203.0.113.11", 50000),
    ) as second_client:
        isolated = second_client.get("/api/experimental/products/4006381333931")

    assert first.status_code == 404
    assert spoofed.status_code == 429
    assert isolated.status_code == 404
    rate_limit_keys = [
        str(key) for key in first_redis.scan_iter(match="product-lookup:rate-limit:*")
    ]
    assert len(rate_limit_keys) == 2
    assert all("203.0.113" not in key for key in rate_limit_keys)


def test_metrics_are_aggregate_and_exclude_barcode_and_client_address() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931"})
    metrics = RecordingMetrics()

    with _client(database, metrics=metrics) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == 200
    assert metrics.events == [
        {
            "outcome": "found",
            "latency_ms": metrics.events[0]["latency_ms"],
            "cache_status": "miss",
            "dataset_version": VERSION_ID,
        }
    ]
    assert "4006381333931" not in str(metrics.events)
    assert "testclient" not in str(metrics.events)


def test_uvicorn_access_log_redacts_product_lookup_path_and_client_address(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = _dataset_database()
    access_logger = logging.getLogger("uvicorn.access")
    monkeypatch.setattr(access_logger, "disabled", False)

    with (
        caplog.at_level("INFO", logger=access_logger.name),
        _client(database),
    ):
        access_logger.info(
            '%s - "%s %s HTTP/%s" %d',
            "203.0.113.42:50000",
            "GET",
            "/api/experimental/products/4006381333931",
            "1.1",
            200,
        )

    message = caplog.records[-1].getMessage()
    assert "4006381333931" not in message
    assert "203.0.113.42" not in message
    assert "/api/experimental/products/[redacted]" in message

    with (
        caplog.at_level("INFO", logger=access_logger.name),
        _client(database),
    ):
        access_logger.info(
            '%s - "%s %s HTTP/%s" %d',
            "203.0.113.42:50000",
            "GET",
            "/api/v1/products/4006381333931",
            "1.1",
            200,
        )

    message_v1 = caplog.records[-1].getMessage()
    assert "4006381333931" not in message_v1
    assert "203.0.113.42" not in message_v1
    assert "/api/v1/products/[redacted]" in message_v1

    with (
        caplog.at_level("INFO", logger=access_logger.name),
        _client(database),
    ):
        access_logger.info(
            '%s - "%s %s HTTP/%s" %d',
            "203.0.113.42:50000",
            "GET",
            "/api/v1/products/4006381333931?language=kh",
            "1.1",
            200,
        )

    message_kh = caplog.records[-1].getMessage()
    assert "4006381333931" not in message_kh
    assert "203.0.113.42" not in message_kh
    assert "/api/v1/products/[redacted]" in message_kh
    assert "language=kh" not in message_kh


def test_v1_product_lookup_returns_stable_product_projection_with_provenance() -> None:
    database = _dataset_database()
    payload = json.loads((FIXTURES / "complete.json").read_text(encoding="utf-8"))
    payload["product"]["ecoscore_data"] = {
        "adjustments": [{"name": "origins_of_ingredients", "value": None}]
    }
    database[COLLECTION_NAME].insert_one(payload["product"])

    with _client(database) as client:
        response = client.get("/api/v1/products/4006381333931")

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["product"]["identity"]["barcode"] == "4006381333931"
    assert body["data"]["product"]["identity"]["preferred_name"]["value"] == "Dark Chocolate"
    assert body["meta"]["lookup"]["barcode"] == "4006381333931"
    assert body["meta"]["source"]["name"] == "Open Food Facts"
    assert (
        body["meta"]["source"]["product_url"]
        == "https://world.openfoodfacts.org/product/4006381333931"
    )
    assert body["meta"]["dataset"]["version"] == VERSION_ID


def test_v1_product_lookup_unknown_product_returns_404_error_envelope() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].create_index("code")

    with _client(database) as client:
        response = client.get("/api/v1/products/4006381333931")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "product_not_found"
    assert response.json()["meta"]["dataset"]["version"] == VERSION_ID


def test_v1_product_lookup_unsupported_language_returns_422() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "4006381333931"})

    with _client(database) as client:
        response = client.get("/api/v1/products/4006381333931?language=fr")
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "unsupported_language"
        assert "not supported" in response.json()["error"]["message"]

        response_km = client.get("/api/v1/products/4006381333931?language=km")
        assert response_km.status_code == 422
        assert response_km.json()["error"]["code"] == "unsupported_language"


def test_v1_product_lookup_untranslated_includes_not_requested_meta() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
            "generic_name_en": "Chocolate",
            "ingredients_text_en": "Cocoa mass, sugar",
            "categories": "Chocolate, Snacks",
        }
    )

    with _client(database) as client:
        response = client.get("/api/v1/products/4006381333931")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "not_requested"
    assert body["meta"]["translation"]["metadata"] is None

    product = body["data"]["product"]
    assert product["identity"]["name"]["translation_status"] == "not_requested"
    assert product["identity"]["name"]["khmer_translation"] is None
    assert product["identity"]["name"]["selected_original_text"]["value"] == "Dark Chocolate"

    assert product["identity"]["generic_name"]["translation_status"] == "not_requested"
    assert product["ingredients_text"]["translation_status"] == "not_requested"
    assert product["categories_text"]["translation_status"] == "not_requested"


def test_v1_product_lookup_with_language_kh_generates_translation() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
            "generic_name_en": "Chocolate",
            "ingredients_text_en": "Cocoa mass, sugar",
            "categories": "Chocolate, Snacks",
        }
    )

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
            "category_0": "សូកូឡា",
            "category_1": "អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "complete"
    assert body["meta"]["translation"]["metadata"]["machine_generated"] is True
    assert body["meta"]["translation"]["metadata"]["provider"] == "test-fake"
    assert body["meta"]["translation"]["metadata"]["model"] == "canned-translations"
    assert body["meta"]["translation"]["metadata"]["configuration_version"] == "v1"
    assert body["meta"]["translation"]["metadata"]["generated_at"] is not None

    # Source attribution remains unchanged
    assert body["meta"]["source"]["name"] == "Open Food Facts"
    assert (
        body["meta"]["source"]["product_url"]
        == "https://world.openfoodfacts.org/product/4006381333931"
    )
    assert body["meta"]["dataset"]["version"] == VERSION_ID

    product = body["data"]["product"]
    assert product["identity"]["name"]["translation_status"] == "generated"
    assert product["identity"]["name"]["khmer_translation"] is not None
    assert product["identity"]["name"]["selected_original_text"]["value"] == "Dark Chocolate"

    assert product["identity"]["generic_name"]["translation_status"] == "generated"
    assert product["ingredients_text"]["translation_status"] == "generated"
    assert product["categories_text"]["translation_status"] == "generated"
    assert product["categories_text"]["khmer_translation"] == "សូកូឡា, អាហារសម្រន់"
    assert len(product["category_items"]) == 2
    assert product["category_items"][0]["key"] == "category_0"
    assert product["category_items"][0]["translation_status"] == "generated"
    assert product["category_items"][0]["khmer_translation"] == "សូកូឡា"
    assert product["category_items"][1]["key"] == "category_1"
    assert product["category_items"][1]["translation_status"] == "generated"
    assert product["category_items"][1]["khmer_translation"] == "អាហារសម្រន់"
    assert provider.call_count == 1


def test_v1_product_lookup_source_khmer_not_needed() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_km": "សូកូឡាខ្មៅ",
        }
    )

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "not_needed"
    assert body["meta"]["translation"]["metadata"] is None

    product = body["data"]["product"]
    assert product["identity"]["name"]["translation_status"] == "source_khmer_available"
    assert product["identity"]["name"]["khmer_translation"] is None
    assert product["identity"]["name"]["selected_original_text"]["value"] == "សូកូឡាខ្មៅ"
    assert provider.call_count == 0


def test_v1_product_lookup_preserves_brand_only_name_without_translation_call() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Coca-Cola 330ml",
            "brands": "Coca-Cola",
        }
    )

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "not_needed"
    name = body["data"]["product"]["identity"]["name"]
    assert name["translation_status"] == "original_text_preserved"
    assert name["khmer_translation"] is None
    assert name["selected_original_text"]["value"] == "Coca-Cola 330ml"
    assert provider.call_count == 0


def test_v1_product_lookup_cache_hit() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        res1 = client.get("/api/v1/products/4006381333931?language=kh")
        assert res1.status_code == 200
        assert res1.json()["meta"]["translation"]["status"] == "complete"
        assert provider.call_count == 1

        res2 = client.get("/api/v1/products/4006381333931?language=kh")
        assert res2.status_code == 200
        assert res2.json()["meta"]["translation"]["status"] == "complete"
        assert provider.call_count == 1


def test_v1_product_lookup_store_hit() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )

    repo = InMemoryGeneratedDataRepository()
    provider1 = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    coord1 = _make_test_coordinator(provider=provider1, repository=repo)

    with _client(database, coordinator=coord1) as client1:
        res1 = client1.get("/api/v1/products/4006381333931?language=kh")
        assert res1.status_code == 200
        assert provider1.call_count == 1

    # Second coordinator shares the same repo, but has its own empty cache and new provider
    provider2 = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    cache2 = InMemoryTranslationHotCache(ttl_seconds=3600)
    coord2 = _make_test_coordinator(provider=provider2, repository=repo, cache=cache2)

    with _client(database, coordinator=coord2) as client2:
        res2 = client2.get("/api/v1/products/4006381333931?language=kh")
        assert res2.status_code == 200
        assert res2.json()["meta"]["translation"]["status"] == "complete"
        assert provider2.call_count == 0


def test_v1_product_lookup_cooldown_returns_200_with_original_text_and_unavailable_status() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )

    provider = FakeTranslationProvider(should_fail=True)
    repo = InMemoryGeneratedDataRepository()
    coord = _make_test_coordinator(provider=provider, repository=repo)

    with _client(database, coordinator=coord) as client:
        # First request triggers failure and enters cooldown
        res1 = client.get("/api/v1/products/4006381333931?language=kh")
        assert res1.status_code == 200
        body1 = res1.json()
        assert body1["meta"]["translation"]["status"] == "unavailable"
        assert body1["meta"]["translation"]["metadata"] is None
        assert (
            body1["data"]["product"]["identity"]["name"]["translation_status"]
            == "translation_unavailable"
        )
        assert (
            body1["data"]["product"]["identity"]["name"]["selected_original_text"]["value"]
            == "Dark Chocolate"
        )
        assert body1["data"]["product"]["identity"]["name"]["khmer_translation"] is None

        # Second request encounters active cooldown, provider is not called again
        provider.should_fail = False
        res2 = client.get("/api/v1/products/4006381333931?language=kh")
        assert res2.status_code == 200
        body2 = res2.json()
        assert body2["meta"]["translation"]["status"] == "unavailable"
        assert provider.call_count == 1


def test_v1_product_lookup_store_degraded_returns_original_text() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )

    class FailingRepo(InMemoryGeneratedDataRepository):
        def is_quarantined(self, content_hash: str, config_fingerprint: str) -> bool:
            raise PyMongoError("MongoDB connection failure")

    coord = _make_test_coordinator(repository=FailingRepo())

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "unavailable"
    assert body["meta"]["translation"]["metadata"] is None
    assert (
        body["data"]["product"]["identity"]["name"]["translation_status"]
        == "translation_unavailable"
    )
    assert (
        body["data"]["product"]["identity"]["name"]["selected_original_text"]["value"]
        == "Dark Chocolate"
    )


def test_v1_product_lookup_budget_exhausted_returns_original_text() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )

    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=1)
    acquired, _ = budget.try_acquire()
    assert acquired is True
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider, budget=budget)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "unavailable"
    assert body["meta"]["translation"]["metadata"] is None
    assert (
        body["data"]["product"]["identity"]["name"]["translation_status"]
        == "translation_unavailable"
    )
    assert (
        body["data"]["product"]["identity"]["name"]["selected_original_text"]["value"]
        == "Dark Chocolate"
    )
    assert provider.call_count == 0


def test_v1_product_lookup_competing_lease_timeout_returns_200_unavailable() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )

    class CompetitorLeaseRepo(InMemoryGeneratedDataRepository):
        def acquire_lease(
            self,
            content_hash: str,
            config_fingerprint: str,
            owner_token: str,
            ttl_seconds: float,
        ) -> bool:
            return False

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = CompetitorLeaseRepo()
    cache = InMemoryTranslationHotCache(ttl_seconds=3600)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=60)

    clock = [0.0]

    def advancing_clock() -> float:
        clock[0] += 10.0
        return clock[0]

    coord = TranslationCoordinator(
        module,
        repo,
        cache,
        budget,
        monotonic=advancing_clock,
    )

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "unavailable"
    assert (
        body["data"]["product"]["identity"]["name"]["translation_status"]
        == "translation_unavailable"
    )
    assert (
        body["data"]["product"]["identity"]["name"]["selected_original_text"]["value"]
        == "Dark Chocolate"
    )
    assert provider.call_count == 0


def test_v1_product_lookup_partial_failure_returns_200_with_partial_status() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
            "ingredients_text_en": "Cocoa mass, sugar",
        }
    )

    provider = FakeTranslationProvider(
        canned_translations={"product_name": "សូកូឡាខ្មៅ", "ingredients_text": ""}
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "partial"
    assert body["meta"]["translation"]["metadata"] is not None
    assert body["meta"]["translation"]["metadata"]["machine_generated"] is True

    product = body["data"]["product"]
    assert product["identity"]["name"]["translation_status"] == "generated"
    assert product["identity"]["name"]["khmer_translation"] is not None

    assert product["ingredients_text"]["translation_status"] == "translation_unavailable"
    assert product["ingredients_text"]["khmer_translation"] is None


def test_v1_product_lookup_privacy_metrics_exclude_identifying_data() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Secret Chocolate",
        }
    )

    metrics = RecordingMetrics()
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, metrics=metrics, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    metrics_str = str(metrics.events)
    assert "4006381333931" not in metrics_str
    assert "Secret Chocolate" not in metrics_str
    assert "testclient" not in metrics_str
    assert "ការបកប្រែ" not in metrics_str


def test_v1_product_lookup_competing_lease_wait_success() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )

    sample_prod = ProductProjection(
        identity=ProductIdentityProjection(
            names=[
                OriginalText(
                    value="Dark Chocolate",
                    source_field="product_name_en",
                    language="en",
                )
            ]
        ),
        nutrition=NutritionProjection(),
        assessments=SourceAssessmentsProjection(),
        packaging=PackagingProjection(),
        environment=EnvironmentProjection(),
        source=SourceRecordMetadataProjection(),
    )
    competitor_provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    comp_result = KhmerTranslationModule(competitor_provider).translate_product(
        sample_prod, target_language="kh"
    )
    stored_artifact = result_to_stored_artifact(comp_result)

    class CompetitorYieldingRepo(InMemoryGeneratedDataRepository):
        def acquire_lease(
            self,
            content_hash: str,
            config_fingerprint: str,
            owner_token: str,
            ttl_seconds: float,
        ) -> bool:
            self.save_artifact(stored_artifact)
            return False

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    module = KhmerTranslationModule(provider)
    cache = InMemoryTranslationHotCache(ttl_seconds=3600)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=60)
    coord = TranslationCoordinator(
        module,
        CompetitorYieldingRepo(),
        cache,
        budget,
        poll_interval_seconds=0.01,
        fallback_seconds=1.0,
    )

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "complete"
    assert body["data"]["product"]["identity"]["name"]["translation_status"] == "generated"
    assert provider.call_count == 0


def test_v1_product_lookup_empty_fields_source_data_unavailable() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
        }
    )

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "not_needed"
    product = body["data"]["product"]
    assert product["identity"]["name"]["translation_status"] == "source_data_unavailable"
    assert product["identity"]["generic_name"]["translation_status"] == "source_data_unavailable"
    assert product["ingredients_text"]["translation_status"] == "source_data_unavailable"
    assert product["categories_text"]["translation_status"] == "source_data_unavailable"
    assert provider.call_count == 0


def test_v1_product_lookup_coordinator_failure_marks_fields_unavailable() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )

    class CrashingCoordinator:
        def get_or_generate_translation(self, *args, **kwargs):
            raise RuntimeError("Unexpected coordinator crash")

    with _client(database, coordinator=CrashingCoordinator()) as client:  # type: ignore
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "unavailable"
    product = body["data"]["product"]
    assert product["identity"]["name"]["translation_status"] == "translation_unavailable"
    assert product["identity"]["name"]["selected_original_text"]["value"] == "Dark Chocolate"


def test_v1_product_lookup_khmer_categories_detected_as_source_khmer() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "categories": "នំស្រួយ, អាហារសម្រន់",
            "lang": "en",
        }
    )

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "សូកូឡាខ្មៅ",
            "generic_name": "សូកូឡា",
            "ingredients_text": "កាកាវ, ស្ករ",
            "categories": "សូកូឡា, អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    product = body["data"]["product"]
    assert product["categories_text"]["translation_status"] == "source_khmer_available"
    assert product["categories_text"]["selected_original_text"]["language"] == "en"
    assert product["categories_text"]["khmer_translation"] is None


@pytest.mark.parametrize(
    ("scenario", "expected_status"),
    [
        ("success-cache-miss", 200),
        ("not-found", 404),
        ("dataset-unavailable", 503),
    ],
)
def test_product_lookup_never_sends_an_outbound_http_request(
    scenario: str,
    expected_status: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database = _dataset_database()
    if scenario == "success-cache-miss":
        database[COLLECTION_NAME].insert_one({"code": "4006381333931"})
    elif scenario == "not-found":
        database[COLLECTION_NAME].create_index("code")
    else:
        database[CONTROL_COLLECTION].delete_many({})

    original_send = httpx.Client.send

    def guard_outbound(client, request, *args, **kwargs):
        if isinstance(client, TestClient):
            return original_send(client, request, *args, **kwargs)
        raise AssertionError("Product Lookup attempted an outbound HTTP request")

    monkeypatch.setattr(httpx.Client, "send", guard_outbound)
    with _client(database) as client:
        response = client.get("/api/experimental/products/4006381333931")

    assert response.status_code == expected_status


def test_startup_without_credentials_does_not_generate(monkeypatch) -> None:
    from lifegoods.core.settings import Settings

    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
        }
    )
    generated_client = mongomock.MongoClient()
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr("lifegoods.main.MongoClient", lambda *a, **kw: generated_client)
    monkeypatch.setattr("lifegoods.main.redis.Redis.from_url", lambda *a, **kw: redis_client)
    app = create_app(
        settings=Settings(gemini_api_key=None),
        product_lookup_source=OpenFoodFactsDatasetSource(database),
        product_lookup_cache=InMemoryProductLookupCache(ttl_seconds=3600),
        product_lookup_limiter=RedisProductLookupRateLimiter(redis_client, 60),
    )
    with TestClient(app) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"] == {"status": "unavailable", "metadata": None}
    name = body["data"]["product"]["identity"]["name"]
    assert name["selected_original_text"]["value"] == "Dark Chocolate"
    assert name["khmer_translation"] is None
    assert generated_client.lifegoods_generated.list_collection_names() == []


@pytest.mark.parametrize("failure", ["provider", "coordinator"])
def test_translation_failure_preserves_brand_and_source_khmer(failure) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "brands": "Coca-Cola",
            "product_name_en": "Coca-Cola 330ml",
            "lang": "en",
            "generic_name_km-KH": "ភេសជ្ជៈ",
            "ingredients_text_en": "Sugar, water",
        }
    )
    coord = _make_test_coordinator(provider=FakeTranslationProvider(should_fail=True))
    if failure == "coordinator":

        class BrokenCoordinator(TranslationCoordinator):
            def get_or_generate_translation(self, *args, **kwargs):
                raise RuntimeError("coordination failed")

        coord.__class__ = BrokenCoordinator
    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")
    body = response.json()
    assert response.status_code == 200
    assert body["meta"]["translation"] == {"status": "unavailable", "metadata": None}
    product = body["data"]["product"]
    assert product["identity"]["name"]["translation_status"] == "original_text_preserved"
    generic = product["identity"]["generic_name"]
    assert generic["translation_status"] == "source_khmer_available"
    assert generic["selected_original_text"]["language"] == "km-KH"
    assert product["ingredients_text"]["translation_status"] == "translation_unavailable"


@pytest.mark.parametrize("invalid", ["ការបកប្រែ: Dark Chocolate", 42, ["សូកូឡា"], None])
def test_invalid_field_output_retains_independent_translation(invalid) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark Chocolate",
            "generic_name_en": "Chocolate",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": invalid,
            "generic_name": "សូកូឡា",
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider)) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")
    body = response.json()
    assert body["meta"]["translation"]["status"] == "partial"
    assert (
        body["data"]["product"]["identity"]["name"]["translation_status"]
        == "translation_unavailable"
    )
    assert body["data"]["product"]["identity"]["generic_name"]["khmer_translation"] == "សូកូឡា"


@pytest.mark.parametrize("language", ["kh", "km", "km-KH", "KH_kh"])
@pytest.mark.parametrize("broken_coordinator", [False, True])
def test_source_khmer_metadata_and_not_needed_survive_fallback(
    language, broken_coordinator
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "lang": language,
            f"product_name_{language}": "ទឹកដូង",
        }
    )
    coord = _make_test_coordinator()
    if broken_coordinator:

        class BrokenCoordinator(TranslationCoordinator):
            def get_or_generate_translation(self, *args, **kwargs):
                raise RuntimeError("coordination failed")

        coord.__class__ = BrokenCoordinator
    with _client(database, coordinator=coord) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert body["meta"]["translation"] == {"status": "not_needed", "metadata": None}
    product = body["data"]["product"]
    assert product["source"]["record_language"] == language
    name = product["identity"]["name"]
    assert name["translation_status"] == "source_khmer_available"
    assert name["selected_original_text"] == {
        "value": "ទឹកដូង",
        "language": language,
        "source_field": f"product_name_{language}",
    }


@pytest.mark.parametrize("artifact_kind", ["compatible", "old", "fake"])
def test_startup_without_credentials_only_reuses_compatible_generated_artifacts(
    monkeypatch,
    artifact_kind,
) -> None:
    from lifegoods.core.settings import Settings
    from lifegoods.generated_data.repository import MongoGeneratedDataRepository
    from lifegoods.product_lookup.projection import project_source_record
    from lifegoods.translation.gemini import GeminiTranslationAdapter

    database = _dataset_database()
    record = {"code": "4006381333931", "product_name_en": "Dark Chocolate"}
    database[COLLECTION_NAME].insert_one(record)
    generated_client = mongomock.MongoClient()
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "translations": {"product_name": "សូកូឡាខ្មៅ"},
                                        }
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )

    with httpx.Client(transport=httpx.MockTransport(respond)) as transport:
        provider = GeminiTranslationAdapter("offline-key", http_client=transport)
        if artifact_kind == "fake":
            module = KhmerTranslationModule(
                FakeTranslationProvider(
                    canned_translations={"product_name": "សូកូឡាខ្មៅ"},
                )
            )
        else:
            module = KhmerTranslationModule(
                provider,
                config_version="v0" if artifact_kind == "old" else "v1",
            )
        artifact = result_to_stored_artifact(
            module.translate_product(project_source_record(record))
        )
        repository = MongoGeneratedDataRepository(generated_client.lifegoods_generated)
        repository.save_artifact(artifact)
    initial_requests = len(requests)
    monkeypatch.setattr("lifegoods.main.MongoClient", lambda *a, **kw: generated_client)
    monkeypatch.setattr("lifegoods.main.redis.Redis.from_url", lambda *a, **kw: redis_client)
    app = create_app(
        settings=Settings(gemini_api_key=None),
        product_lookup_source=OpenFoodFactsDatasetSource(database),
        product_lookup_cache=InMemoryProductLookupCache(ttl_seconds=3600),
        product_lookup_limiter=RedisProductLookupRateLimiter(redis_client, 60),
    )
    with TestClient(app) as client:
        for _ in range(2):
            body = client.get("/api/v1/products/4006381333931?language=kh").json()
            if artifact_kind == "compatible":
                assert body["meta"]["translation"]["status"] == "complete"
                assert body["meta"]["translation"]["metadata"] == artifact.provenance
            else:
                assert body["meta"]["translation"] == {"status": "unavailable", "metadata": None}
    assert len(requests) == initial_requests
    assert repository.get_aggregate_stats().artifacts_count == 1


@pytest.mark.parametrize(
    "source_text,language",
    [
        ("Oishi Green Tea 500ml", "en"),
        ("Oishi ชาเขียว 500ml", "th"),
        ("Oishi Trà xanh 500ml", "vi"),
        ("Oishi 绿茶 500ml", "zh"),
        ("Oishi Thé vert 500ml", "fr"),
        ("Oishi Green Tea 茶 500ml", None),
    ],
)
def test_multilingual_translation_retains_original_text_and_protected_values(source_text, language):
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": source_text,
            "lang": language,
            "brands": "Oishi",
            "ingredients_text": "Sugar 5%, E322, INS 330",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "__LG_TOK_0__ តែបៃតង __LG_TOK_1__",
            "ingredients_text": "ស្ករ __LG_TOK_0__, __LG_TOK_1__, __LG_TOK_2__",
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert body["meta"]["translation"]["status"] == "complete"
    name = body["data"]["product"]["identity"]["name"]
    assert name["selected_original_text"] == {
        "value": source_text,
        "language": language,
        "source_field": "product_name",
    }
    assert name["khmer_translation"] == "Oishi តែបៃតង 500ml"
    assert (
        body["data"]["product"]["ingredients_text"]["khmer_translation"] == "ស្ករ 5%, E322, INS 330"
    )
    assert provider.last_request is not None
    assert "4006381333931" not in str(provider.last_request)
    assert VERSION_ID not in str(provider.last_request)


@pytest.mark.parametrize(
    "output",
    [
        "ស្ករ 6%, __LG_TOK_1__, __LG_TOK_2__",
        "ស្ករ __LG_TOK_0__, __LG_TOK_1__, __LG_TOK_2__, 6%",
        "ស្ករ __LG_TOK_0__, __LG_TOK_0__, __LG_TOK_1__, __LG_TOK_2__",
        "ស្ករ __LG_TOK_0__, __LG_TOK_1__, __LG_TOK_99__",
    ],
)
def test_altered_protected_values_do_not_discard_valid_product_name(output):
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Tea",
            "ingredients_text_en": "Sugar 5%, E322, INS 330",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែ",
            "ingredients_text": output,
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert body["meta"]["translation"]["status"] == "partial"
    assert body["data"]["product"]["identity"]["name"]["khmer_translation"] == "តែ"
    assert body["data"]["product"]["ingredients_text"]["khmer_translation"] is None


@pytest.mark.parametrize(
    "output",
    [
        "ទឹកដោះគោ __LG_TOK_0__allons",
        "ទឹកដោះគោ 1__LG_TOK_0__",
    ],
)
def test_protected_unit_boundaries_cannot_change_package_quantities(output):
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Milk",
            "ingredients_text_en": "Milk 5 g",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "ទឹកដោះគោ",
            "ingredients_text": output,
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert body["meta"]["translation"]["status"] == "partial"
    assert body["data"]["product"]["identity"]["name"]["khmer_translation"] == "ទឹកដោះគោ"
    assert body["data"]["product"]["ingredients_text"]["khmer_translation"] is None


@pytest.mark.parametrize(
    "output,expected",
    [
        ("ដប__LG_TOK_0__", "ដប5 g"),
        ("__LG_TOK_0__ដប", "5 gដប"),
    ],
)
def test_unchanged_protected_quantity_can_touch_khmer_text(output, expected):
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Bottle 5 g",
        }
    )
    provider = FakeTranslationProvider(canned_translations={"product_name": output})
    with _client(database, coordinator=_make_test_coordinator(provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert body["meta"]["translation"]["status"] == "complete"
    assert body["data"]["product"]["identity"]["name"]["khmer_translation"] == expected


def test_translation_deadline_discards_late_provider_output() -> None:
    import httpx2 as httpx

    from lifegoods.translation.gemini import GeminiTranslationAdapter

    clock = [0.0]
    attempts = []

    def respond(request):
        attempts.append(request)
        clock[0] += 12.1
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {"text": json.dumps({"translations": {"product_name": "សូកូឡា"}})}
                            ]
                        },
                    }
                ]
            },
        )

    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "3017620422003", "product_name": "Chocolate"})
    with httpx.Client(transport=httpx.MockTransport(respond)) as transport:
        coordinator = TranslationCoordinator(
            KhmerTranslationModule(GeminiTranslationAdapter("offline", http_client=transport)),
            InMemoryGeneratedDataRepository(),
            InMemoryTranslationHotCache(ttl_seconds=3600),
            InMemoryTranslationBudgetLimiter(requests_per_minute=60),
            monotonic=lambda: clock[0],
        )
        with _client(database, coordinator=coordinator) as client:
            body = client.get("/api/v1/products/3017620422003?language=kh").json()
    assert body["meta"]["translation"] == {"status": "unavailable", "metadata": None}
    name = body["data"]["product"]["identity"]["name"]
    assert name["selected_original_text"]["value"] == "Chocolate"
    assert name["khmer_translation"] is None
    assert len(attempts) == 1


@pytest.mark.parametrize(
    "budget,elapsed,expected",
    [
        (12, 11.99, "complete"),
        (0.5, 0.49, "complete"),
        (0.5, 0.5, "unavailable"),
    ],
)
def test_translation_stage_budget_and_fast_cache_reuse(budget, elapsed, expected) -> None:
    from datetime import timedelta

    import httpx2 as httpx

    from lifegoods.translation.gemini import GeminiTranslationAdapter

    clock = [0.0]
    attempts = []

    def respond(request):
        attempts.append(request)
        clock[0] += elapsed
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {"text": json.dumps({"translations": {"product_name": "សូកូឡា"}})}
                            ]
                        },
                    }
                ]
            },
        )

    def sleep(seconds):
        clock[0] += seconds

    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "3017620422003", "product_name": "Chocolate"})
    with httpx.Client(transport=httpx.MockTransport(respond)) as transport:
        coordinator = TranslationCoordinator(
            KhmerTranslationModule(GeminiTranslationAdapter("offline", http_client=transport)),
            InMemoryGeneratedDataRepository(
                datetime_provider=lambda: RETRIEVED_AT + timedelta(seconds=clock[0]),
            ),
            InMemoryTranslationHotCache(ttl_seconds=3600),
            InMemoryTranslationBudgetLimiter(requests_per_minute=60),
            deadline_seconds=budget,
            lease_ttl_seconds=budget,
            monotonic=lambda: clock[0],
            sleep_func=sleep,
        )
        with _client(database, coordinator=coordinator) as client:
            for _ in range(2):
                response = client.get("/api/v1/products/3017620422003?language=kh")
                assert response.status_code == 200
                body = response.json()
                assert body["meta"]["translation"]["status"] == expected
                assert (
                    body["data"]["product"]["identity"]["name"]["selected_original_text"]["value"]
                    == "Chocolate"
                )
    # Successful output is cached; expired output cannot become a successful cache hit.
    assert len(attempts) == 1


@pytest.mark.parametrize("slow_operation", ["cache", "store", "lease", "budget"])
def test_translation_storage_waits_share_deadline(slow_operation) -> None:
    clock = [0.0]
    provider = FakeTranslationProvider(canned_translations={"product_name": "សូកូឡា"})

    class SlowCache(InMemoryTranslationHotCache):
        def get(self, content_hash, config_fingerprint):
            if slow_operation == "cache":
                clock[0] += 1
            return super().get(content_hash, config_fingerprint)

    class SlowRepository(InMemoryGeneratedDataRepository):
        def get_artifact(self, content_hash, config_fingerprint):
            if slow_operation == "store":
                clock[0] += 1
            return super().get_artifact(content_hash, config_fingerprint)

        def acquire_lease(self, content_hash, config_fingerprint, owner_token, ttl_seconds):
            if slow_operation == "lease":
                clock[0] += 0.8
                return False
            return super().acquire_lease(content_hash, config_fingerprint, owner_token, ttl_seconds)

    class SlowBudget(InMemoryTranslationBudgetLimiter):
        def try_acquire(self):
            if slow_operation == "budget":
                clock[0] += 1
            return super().try_acquire()

    def sleep(seconds):
        clock[0] += seconds

    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "3017620422003", "product_name": "Chocolate"})
    coordinator = TranslationCoordinator(
        KhmerTranslationModule(provider),
        SlowRepository(),
        SlowCache(ttl_seconds=3600),
        SlowBudget(requests_per_minute=60),
        deadline_seconds=1,
        monotonic=lambda: clock[0],
        sleep_func=sleep,
    )
    with _client(database, coordinator=coordinator) as client:
        response = client.get("/api/v1/products/3017620422003?language=kh")
    assert response.status_code == 200
    assert response.json()["meta"]["translation"] == {"status": "unavailable", "metadata": None}
    assert clock[0] == pytest.approx(1)
    assert provider.call_count == 0


def test_translation_deadline_bounds_blocked_storage_without_late_generation() -> None:
    from threading import Event

    release = Event()
    completed = Event()
    provider = FakeTranslationProvider(canned_translations={"product_name": "សូកូឡា"})

    class BlockedRepository(InMemoryGeneratedDataRepository):
        def is_quarantined(self, content_hash, config_fingerprint):
            try:
                assert release.wait(2), "Test did not release storage"
                return False
            finally:
                completed.set()

    database = _dataset_database()
    database[COLLECTION_NAME].insert_one({"code": "3017620422003", "product_name": "Chocolate"})
    coordinator = TranslationCoordinator(
        KhmerTranslationModule(provider),
        BlockedRepository(),
        InMemoryTranslationHotCache(ttl_seconds=3600),
        InMemoryTranslationBudgetLimiter(requests_per_minute=60),
        deadline_seconds=0.1,
    )
    with _client(database, coordinator=coordinator) as client:
        try:
            response = client.get("/api/v1/products/3017620422003?language=kh")
            assert not release.is_set()
            assert response.status_code == 200
            assert response.json()["meta"]["translation"]["status"] == "unavailable"
        finally:
            release.set()
            assert completed.wait(2)
    assert provider.call_count == 0


def test_product_lookup_translates_multiple_distinct_storage_instructions() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Iced Tea",
            "conservation_conditions": "Keep in a cool, dry place",
            "storage_conditions": "Refrigerate after opening",
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែទឹកកក",
            "storage_instruction_0": "រក្សាទុកនៅកន្លែងត្រជាក់ និងស្ងួត",
            "storage_instruction_1": "រក្សាទុកក្នុងទូរទឹកកកបន្ទាប់ពីបើក",
        }
    )
    coord = _make_test_coordinator(provider=provider)
    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "complete"
    assert body["meta"]["translation"]["metadata"]["provider"] == "test-fake"

    product = body["data"]["product"]
    assert len(product["storage_instruction_items"]) == 2

    item0 = product["storage_instruction_items"][0]
    assert item0["key"] == "storage_instruction_0"
    assert item0["translation_status"] == "generated"
    assert item0["khmer_translation"] == "រក្សាទុកនៅកន្លែងត្រជាក់ និងស្ងួត"
    assert item0["selected_original_text"]["value"] == "Keep in a cool, dry place"

    item1 = product["storage_instruction_items"][1]
    assert item1["key"] == "storage_instruction_1"
    assert item1["translation_status"] == "generated"
    assert item1["khmer_translation"] == "រក្សាទុកក្នុងទូរទឹកកកបន្ទាប់ពីបើក"
    assert item1["selected_original_text"]["value"] == "Refrigerate after opening"

    # Legacy field preserved
    assert len(product["storage_instructions"]) == 2


def test_product_lookup_groups_localized_alternatives_and_collapses_exact_duplicates() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Orange Juice",
            "conservation_conditions": "Keep cool",
            "conservation_conditions_fr": "Conserver au frais",
            "storage_conditions": "Keep cool",
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "ទឹកក្រូច",
            "storage_instruction_0": "រក្សាទុកនៅកន្លែងត្រជាក់",
        }
    )
    coord = _make_test_coordinator(provider=provider)
    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    product = body["data"]["product"]

    # Collapsed into single item
    assert len(product["storage_instruction_items"]) == 1
    item0 = product["storage_instruction_items"][0]
    assert item0["key"] == "storage_instruction_0"
    assert item0["translation_status"] == "generated"
    assert item0["khmer_translation"] == "រក្សាទុកនៅកន្លែងត្រជាក់"

    # Retains provenance from both conservation_conditions and storage_conditions
    source_fields = {t["source_field"] for t in item0["original_texts"]}
    assert "conservation_conditions" in source_fields
    assert "storage_conditions" in source_fields
    assert "conservation_conditions_fr" in source_fields


def test_product_lookup_storage_instructions_source_khmer_and_unknown_language() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Mineral Water",
            "conservation_conditions_km": "រក្សាទុកនៅកន្លែងត្រជាក់",
            "storage_conditions": "សូមរក្សាទុកក្នុងម្លប់",  # Khmer script without explicit language tag
        }
    )
    provider = FakeTranslationProvider(canned_translations={"product_name": "ទឹកបរិសុទ្ធ"})
    coord = _make_test_coordinator(provider=provider)
    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    product = body["data"]["product"]

    assert len(product["storage_instruction_items"]) == 2
    for item in product["storage_instruction_items"]:
        assert item["translation_status"] == "source_khmer_available"
        assert item["khmer_translation"] is None
        assert item["selected_original_text"] is not None


def test_product_lookup_missing_storage_instructions() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Simple Biscuits",
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(canned_translations={"product_name": "នំប្រៃ"})
    coord = _make_test_coordinator(provider=provider)
    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    product = body["data"]["product"]

    assert product["storage_instruction_items"] == []
    assert product["storage_instructions"] == []
    assert body["meta"]["translation"]["status"] == "complete"


def test_product_lookup_storage_instructions_preserves_protected_values() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Ice Cream",
            "conservation_conditions": (
                "Keep frozen at -18°C. Once defrosted, keep at 4°C and consume within 3 days."
            ),
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "ការ៉េម",
            "storage_instruction_0": (
                "រក្សាទុកឱ្យកកនៅ __LG_TOK_0__។ នៅពេលរលាយរួច រក្សាទុកនៅ __LG_TOK_1__ "
                "ហើយទទួលទានក្នុងរយៈពេល __LG_TOK_2__។"
            ),
        }
    )
    coord = _make_test_coordinator(provider=provider)
    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    product = body["data"]["product"]
    item = product["storage_instruction_items"][0]

    assert item["translation_status"] == "generated"
    assert "-18°C" in item["khmer_translation"]
    assert "4°C" in item["khmer_translation"]
    assert "3 days" in item["khmer_translation"]


def test_product_lookup_storage_instructions_partial_failure_survives() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Yogurt",
            "conservation_conditions": "Keep at 4°C",
            "storage_conditions": "Consume quickly after opening",
            "lang": "en",
        }
    )
    # storage_instruction_1 returns English only (invalid script)
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "យ៉ាអួ",
            "storage_instruction_0": "រក្សាទុកនៅ __LG_TOK_0__",
            "storage_instruction_1": "Consume quickly English Only",
        }
    )
    coord = _make_test_coordinator(provider=provider)
    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "partial"

    product = body["data"]["product"]
    item0 = product["storage_instruction_items"][0]
    assert item0["translation_status"] == "generated"
    assert item0["khmer_translation"] == "រក្សាទុកនៅ 4°C"

    item1 = product["storage_instruction_items"][1]
    assert item1["translation_status"] == "translation_unavailable"
    assert item1["khmer_translation"] is None
    assert item1["selected_original_text"]["value"] == "Consume quickly after opening"


def test_product_lookup_storage_instructions_cache_reuse_and_identity() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Milk",
            "conservation_conditions": "Keep cool at 4°C",
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "ទឹកដោះគោ",
            "storage_instruction_0": "រក្សាទុកនៅកន្លែងត្រជាក់នៅ __LG_TOK_0__",
        }
    )
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=3600)
    coord = _make_test_coordinator(provider=provider, repository=repo, cache=cache)

    with _client(database, coordinator=coord) as client:
        # First request: generates and caches
        res1 = client.get("/api/v1/products/4006381333931?language=kh")
        assert res1.status_code == 200
        assert provider.call_count == 1

        # Second request: cache hit, no provider call
        res2 = client.get("/api/v1/products/4006381333931?language=kh")
        assert res2.status_code == 200
        assert provider.call_count == 1

        p1 = res1.json()["data"]["product"]
        p2 = res2.json()["data"]["product"]
        assert p1["storage_instruction_items"] == p2["storage_instruction_items"]


def test_product_lookup_storage_instructions_provider_and_store_failure() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Milk",
            "conservation_conditions": "Keep cool at 4°C",
            "lang": "en",
        }
    )

    # 1. Provider failure
    provider_fail = FakeTranslationProvider(should_fail=True)
    coord_fail = _make_test_coordinator(provider=provider_fail)
    with _client(database, coordinator=coord_fail) as client:
        res = client.get("/api/v1/products/4006381333931?language=kh")
        assert res.status_code == 200
        data = res.json()
        assert data["meta"]["translation"]["status"] == "unavailable"
        item = data["data"]["product"]["storage_instruction_items"][0]
        assert item["translation_status"] == "translation_unavailable"
        assert item["selected_original_text"]["value"] == "Keep cool at 4°C"

    # 2. Store failure (repository fails)
    class BrokenRepo(InMemoryGeneratedDataRepository):
        def find_artifact(self, content_hash, config_fingerprint):
            raise RuntimeError("storage unreachable")

    coord_store_fail = _make_test_coordinator(
        provider=FakeTranslationProvider(canned_translations={"storage_instruction_0": "រក្សាទុក"}),
        repository=BrokenRepo(),
    )
    with _client(database, coordinator=coord_store_fail) as client:
        res = client.get("/api/v1/products/4006381333931?language=kh")
        assert res.status_code == 200
        data = res.json()
        assert data["meta"]["translation"]["status"] == "unavailable"
        item = data["data"]["product"]["storage_instruction_items"][0]
        assert item["translation_status"] == "translation_unavailable"
        assert item["selected_original_text"]["value"] == "Keep cool at 4°C"


def test_product_lookup_storage_instructions_long_statements() -> None:
    database = _dataset_database()
    long_instruction = (
        "Store in a dry, cool and well-ventilated area away from direct sunlight, "
        "heat, and moisture. Maintain temperature strictly at -18°C or lower before opening. "
        "Once opened, seal packaging tightly, store in the refrigerator at 4°C, and consume "
        "entirely within 5 days for optimal freshness and safety. Do not refreeze once thawed. "
        "Dispose of packaging responsibly according to local recycling regulations."
    )
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name": "Premium Frozen Pastry",
            "conservation_conditions": long_instruction,
            "lang": "en",
        }
    )
    canned_khmer = (
        "រក្សាទុកនៅកន្លែងស្ងួត ត្រជាក់ និងមានខ្យល់ចេញចូលល្អ ឆ្ងាយពីពន្លឺព្រះអាទិត្យផ្ទាល់ កម្តៅ និងសំណើម។ "
        "រក្សាសីតុណ្ហភាពឱ្យនៅ __LG_TOK_0__ ឬទាបជាងនេះមុនពេលបើក។ នៅពេលបើកហើយ សូមបិទកញ្ចប់ឱ្យជិត "
        "រក្សាទុកក្នុងទូរទឹកកកនៅ __LG_TOK_1__ ហើយទទួលទានឱ្យអស់ក្នុងរយៈពេល __LG_TOK_2__ "
        "ដើម្បីភាពស្រស់ និងសុវត្ថិភាពល្អបំផុត។ "
        "កុំបង្កកម្តងទៀតបន្ទាប់ពីរលាយ។ បោះចោលវេចខ្ចប់ដោយការទទួលខុសត្រូវស្របតាមបទប្បញ្ញត្តិការកែច្នៃក្នុងស្រុក។"
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "នំក្លាសេពិសេស",
            "storage_instruction_0": canned_khmer,
        }
    )
    coord = _make_test_coordinator(provider=provider)
    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "complete"
    item = body["data"]["product"]["storage_instruction_items"][0]
    assert item["translation_status"] == "generated"
    assert item["selected_original_text"]["value"] == long_instruction
    assert "-18°C" in item["khmer_translation"]
    assert "4°C" in item["khmer_translation"]
    assert "5 days" in item["khmer_translation"]


def test_product_lookup_translates_packaging_items_and_preserves_legacy_fields() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "lang": "en",
            "packaging": "Glass bottle",
            "packaging_text": "Paper sleeve",
            "recycling_instructions_to_discard": "Remove the lid",
            "recycling_instructions": "Flatten the sleeve",
            "packaging_materials_tags": ["en:glass"],
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "packaging_description_0": "ដបកែវ",
            "packaging_description_1": "ស្រោមក្រដាស",
            "recycling_instruction_0": "ដោះគម្របចេញ",
            "recycling_instruction_1": "បត់ស្រោមឱ្យរាបស្មើ",
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        original = client.get("/api/v1/products/4006381333931").json()
        response = client.get("/api/v1/products/4006381333931?language=kh")
    assert response.status_code == 200
    body = response.json()
    packaging = body["data"]["product"]["packaging"]
    before = original["data"]["product"]["packaging"]
    assert [i["selected_original_text"]["value"] for i in packaging["description_items"]] == [
        "Glass bottle",
        "Paper sleeve",
    ]
    assert [
        i["selected_original_text"]["value"] for i in packaging["recycling_instruction_items"]
    ] == [
        "Remove the lid",
        "Flatten the sleeve",
    ]
    for collection in ("description_items", "recycling_instruction_items"):
        for item in packaging[collection]:
            assert item["translation_status"] == "generated"
            assert item["khmer_translation"] == provider.canned_translations[item["key"]]
        assert all(i["translation_status"] == "not_requested" for i in before[collection])
    for field in (
        "texts",
        "recycling_instructions",
        "components",
        "materials",
        "shapes",
        "recycling",
    ):
        assert packaging[field] == before[field]
    assert body["meta"]["source"] == original["meta"]["source"]
    assert body["meta"]["dataset"] == original["meta"]["dataset"]
    assert body["meta"]["translation"]["status"] == "complete"
    assert provider.call_count == 1


@pytest.mark.parametrize(
    "family,alternate,collection",
    [
        ("packaging", "packaging_text", "description_items"),
        (
            "recycling_instructions_to_discard",
            "recycling_instructions",
            "recycling_instruction_items",
        ),
    ],
)
def test_packaging_language_alternatives_keep_exact_duplicate_provenance(
    family: str,
    alternate: str,
    collection: str,
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "lang": "en",
            family: "Glass bottle",
            f"{family}_en": "Glass bottle",
            f"{family}_fr": "Bouteille en verre",
            alternate: "Glass bottle",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "packaging_description_0": "ដបកែវ",
            "recycling_instruction_0": "ដបកែវ",
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    items = body["data"]["product"]["packaging"][collection]
    assert len(items) == 1
    assert {t["source_field"] for t in items[0]["original_texts"]} == {
        family,
        f"{family}_en",
        f"{family}_fr",
        alternate,
    }
    assert items[0]["selected_original_text"]["value"] == "Glass bottle"
    assert items[0]["translation_status"] == "generated"


@pytest.mark.parametrize("language", ["km", "kh", "und"])
def test_packaging_source_khmer_bypasses_generation(language: str) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "lang": "en",
            "packaging_text_en": "Glass bottle",
            f"packaging_text_{language}": "ដបកែវ",
            f"recycling_instructions_{language}": "ដោះគម្របចេញ",
        }
    )
    provider = FakeTranslationProvider(should_fail=True)
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    packaging = body["data"]["product"]["packaging"]
    for collection in ("description_items", "recycling_instruction_items"):
        item = packaging[collection][0]
        assert item["translation_status"] == "source_khmer_available"
        assert item["selected_original_text"]["language"] == language
        assert item["khmer_translation"] is None
    assert body["meta"]["translation"]["status"] == "not_needed"
    assert provider.call_count == 0


def test_packaging_taxonomy_only_record_has_no_translation_items() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "packaging_tags": ["en:bottle"],
            "packaging_materials_tags": ["en:glass"],
            "packagings": [{"shape": {"id": "en:bottle"}, "recycling": {"id": "en:recycle"}}],
        }
    )
    provider = FakeTranslationProvider(should_fail=True)
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    packaging = body["data"]["product"]["packaging"]
    assert packaging["description_items"] == []
    assert packaging["recycling_instruction_items"] == []
    assert packaging["texts"] == []
    assert packaging["recycling_instructions"] == []
    assert provider.call_count == 0


def test_packaging_preserves_brands_recycling_codes_and_quantities() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "lang": "en",
            "brands": "Acme",
            "packaging_text": "Acme bottle 500 ml with 30% recycled material",
            "recycling_instructions": "Sort sleeve marked PAP 21 separately",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "packaging_description_0": (
                "ដប __LG_TOK_0__ ចំណុះ __LG_TOK_1__ មានវត្ថុធាតុកែច្នៃ __LG_TOK_2__"
            ),
            "recycling_instruction_0": "បែងចែកស្រោមដែលមានសញ្ញា __LG_TOK_0__ ដោយឡែក",
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    packaging = body["data"]["product"]["packaging"]
    assert packaging["description_items"][0]["khmer_translation"] == (
        "ដប Acme ចំណុះ 500 ml មានវត្ថុធាតុកែច្នៃ 30%"
    )
    assert packaging["recycling_instruction_items"][0]["khmer_translation"] == (
        "បែងចែកស្រោមដែលមានសញ្ញា PAP 21 ដោយឡែក"
    )
    assert body["meta"]["translation"]["status"] == "complete"


def test_packaging_combined_payload_limit_preserves_whole_instructions_and_valid_siblings() -> None:
    database = _dataset_database()
    first = "Fold the outer carton carefully. " * 220
    second = "Remove all packaging before use. " * 300
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "lang": "en",
            "packaging": first,
            "packaging_text": second,
            "recycling_instructions": "Remove the lid",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "packaging_description_0": "បត់ប្រអប់ខាងក្រៅដោយប្រុងប្រយ័ត្ន។ " * 30,
            "packaging_description_1": "យកវេចខ្ចប់ចេញមុនប្រើ",
            "recycling_instruction_0": "ដោះគម្របចេញ",
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    packaging = body["data"]["product"]["packaging"]
    assert provider.last_request is not None
    assert provider.last_request.fields == {
        "packaging_description_0": first.strip(),
        "recycling_instruction_0": "Remove the lid",
    }
    assert packaging["description_items"][0]["translation_status"] == "generated"
    omitted = packaging["description_items"][1]
    assert omitted["translation_status"] == "translation_unavailable"
    assert omitted["selected_original_text"]["value"] == second.strip()
    assert omitted["khmer_translation"] is None
    assert packaging["recycling_instruction_items"][0]["translation_status"] == "generated"
    assert body["meta"]["translation"]["status"] == "partial"


@pytest.mark.parametrize("invalid", [None, 42, ["កែវ"], "Glass bottle", "__LG_TOK_9__ កែវ"])
def test_packaging_invalid_item_keeps_valid_siblings_and_partial_cache_is_not_durable(
    invalid,
) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "lang": "en",
            "packaging": "Glass bottle",
            "recycling_instructions": "Remove the lid",
        }
    )
    translations = {"recycling_instruction_0": "ដោះគម្របចេញ"}
    if invalid is not None:
        translations["packaging_description_0"] = invalid
    provider = FakeTranslationProvider(canned_translations=translations)
    repo = InMemoryGeneratedDataRepository()
    coord = _make_test_coordinator(provider=provider, repository=repo)
    with _client(database, coordinator=coord) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
        cached = client.get("/api/v1/products/4006381333931?language=kh").json()
    packaging = body["data"]["product"]["packaging"]
    assert body["meta"]["translation"]["status"] == "partial"
    assert packaging["description_items"][0]["translation_status"] == "translation_unavailable"
    assert packaging["description_items"][0]["selected_original_text"]["value"] == "Glass bottle"
    assert packaging["recycling_instruction_items"][0]["khmer_translation"] == "ដោះគម្របចេញ"
    assert cached["data"]["product"]["packaging"] == packaging
    assert provider.call_count == 1
    provider.canned_translations["packaging_description_0"] = "ដបកែវ"
    with _client(
        database, coordinator=_make_test_coordinator(provider=provider, repository=repo)
    ) as client:
        recovered = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert recovered["meta"]["translation"]["status"] == "complete"
    assert provider.call_count == 2


def test_packaging_long_prose_is_translated_whole_and_oversized_text_falls_back_whole() -> None:
    database = _dataset_database()
    long_text = "Remove the outer paper sleeve before washing the glass bottle. " * 35
    translated = "ដោះស្រោមក្រដាសខាងក្រៅចេញមុនពេលលាងដបកែវ។ " * 35
    oversized = "Remove the outer sleeve. " * 800
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "recycling_instructions_en": long_text,
        }
    )
    provider = FakeTranslationProvider(canned_translations={"recycling_instruction_0": translated})
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    item = body["data"]["product"]["packaging"]["recycling_instruction_items"][0]
    assert item["selected_original_text"]["value"] == long_text.strip()
    assert item["khmer_translation"] == translated
    assert provider.last_request is not None
    assert provider.last_request.fields == {"recycling_instruction_0": long_text.strip()}
    database[COLLECTION_NAME].update_one(
        {"code": "4006381333931"},
        {
            "$set": {"recycling_instructions_en": oversized},
        },
    )
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    item = body["data"]["product"]["packaging"]["recycling_instruction_items"][0]
    assert item["selected_original_text"]["value"] == oversized.strip()
    assert item["translation_status"] == "translation_unavailable"
    assert item["khmer_translation"] is None
    assert body["meta"]["translation"] == {"status": "unavailable", "metadata": None}
    assert provider.call_count == 1


@pytest.mark.parametrize("changed_family", ["packaging_text", "recycling_instructions"])
def test_packaging_durable_reuse_across_snapshots_and_changed_item_identity(
    changed_family: str,
) -> None:
    database = _dataset_database()
    record = {
        "code": "4006381333931",
        "lang": "en",
        "packaging_text": "Glass bottle",
        "recycling_instructions": "Remove the lid",
    }
    database[COLLECTION_NAME].insert_one(record)
    provider = FakeTranslationProvider(
        canned_translations={
            "packaging_description_0": "ដបកែវ",
            "recycling_instruction_0": "ដោះគម្របចេញ",
        }
    )
    repo = InMemoryGeneratedDataRepository()
    with _client(
        database, coordinator=_make_test_coordinator(provider=provider, repository=repo)
    ) as client:
        first = client.get("/api/v1/products/4006381333931?language=kh").json()
        hot = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert first["data"]["product"]["packaging"] == hot["data"]["product"]["packaging"]
    assert provider.call_count == 1
    database[VERSIONS_COLLECTION].update_one({"_id": VERSION_ID}, {"$set": {"status": "READY"}})
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": "next-snapshot",
            "collection_name": "next_products",
            "status": "ACTIVE",
            "source_url": "https://static.openfoodfacts.org/data/export.jsonl.gz",
            "sha256": "b" * 64,
            "retrieval_completed_at": RETRIEVED_AT,
            "activated_at": ACTIVATED_AT,
        }
    )
    database[CONTROL_COLLECTION].update_one(
        {"_id": ACTIVE_POINTER_ID},
        {
            "$set": {"active_version_id": "next-snapshot"},
        },
    )
    database.next_products.insert_one({**record, "packaging_text_fr": "Bouteille en verre"})
    provider.should_fail = True
    with _client(
        database, coordinator=_make_test_coordinator(provider=provider, repository=repo)
    ) as client:
        reused = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert reused["meta"]["dataset"]["version"] == "next-snapshot"
    assert reused["meta"]["translation"]["status"] == "complete"
    texts = reused["data"]["product"]["packaging"]["description_items"][0]["original_texts"]
    assert any(t["value"] == "Bouteille en verre" for t in texts)
    assert provider.call_count == 1
    database.next_products.update_one(
        {"code": record["code"]}, {"$set": {changed_family: "New wording"}}
    )
    with _client(
        database, coordinator=_make_test_coordinator(provider=provider, repository=repo)
    ) as client:
        changed = client.get("/api/v1/products/4006381333931?language=kh").json()
    assert changed["meta"]["translation"]["status"] == "unavailable"
    assert provider.call_count == 2


@pytest.mark.parametrize("drops_code", [False, True])
def test_packaging_preserves_material_codes_without_numbers(drops_code: bool) -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "packaging_text_en": "PET bottle with HDPE cap",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "packaging_description_0": (
                "ដបប្លាស្ទិក" if drops_code else "ដប __LG_TOK_0__ មានគម្រប __LG_TOK_1__"
            ),
        }
    )
    with _client(database, coordinator=_make_test_coordinator(provider=provider)) as client:
        body = client.get("/api/v1/products/4006381333931?language=kh").json()
    item = body["data"]["product"]["packaging"]["description_items"][0]
    assert item["translation_status"] == ("translation_unavailable" if drops_code else "generated")
    assert item["khmer_translation"] == (None if drops_code else "ដប PET មានគម្រប HDPE")


def test_v1_product_lookup_multiple_ordered_categories() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "categories": "Dark Chocolate, Sweet Snacks, Confectionery",
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "category_0": "សូកូឡាខ្មៅ",
            "category_1": "អាហារសម្រន់ផ្អែម",
            "category_2": "បង្អែម",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "complete"

    product = body["data"]["product"]
    items = product["category_items"]
    assert len(items) == 3

    assert items[0]["key"] == "category_0"
    assert items[0]["selected_original_text"]["value"] == "Dark Chocolate"
    assert items[0]["translation_status"] == "generated"
    assert items[0]["khmer_translation"] == "សូកូឡាខ្មៅ"

    assert items[1]["key"] == "category_1"
    assert items[1]["selected_original_text"]["value"] == "Sweet Snacks"
    assert items[1]["translation_status"] == "generated"
    assert items[1]["khmer_translation"] == "អាហារសម្រន់ផ្អែម"

    assert items[2]["key"] == "category_2"
    assert items[2]["selected_original_text"]["value"] == "Confectionery"
    assert items[2]["translation_status"] == "generated"
    assert items[2]["khmer_translation"] == "បង្អែម"

    # Legacy fields
    assert product["categories"] == ["Dark Chocolate", "Sweet Snacks", "Confectionery"]
    assert product["categories_text"]["translation_status"] == "generated"
    assert product["categories_text"]["khmer_translation"] == "សូកូឡាខ្មៅ, អាហារសម្រន់ផ្អែម, បង្អែម"


def test_v1_product_lookup_punctuation_bearing_category_items() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "categories": "Dark Chocolate (70%), Snacks & Confectionery, Ready-to-eat / canned",
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "category_0": "សូកូឡាខ្មៅ (__LG_TOK_0__)",
            "category_1": "អាហារសម្រន់ & បង្អែម",
            "category_2": "រួចជាស្រេចដើម្បីបរិភោគ / កំប៉ុង",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "complete"

    product = body["data"]["product"]
    items = product["category_items"]
    assert len(items) == 3

    assert items[0]["selected_original_text"]["value"] == "Dark Chocolate (70%)"
    assert items[0]["translation_status"] == "generated"
    assert items[0]["khmer_translation"] == "សូកូឡាខ្មៅ (70%)"

    assert items[1]["selected_original_text"]["value"] == "Snacks & Confectionery"
    assert items[1]["translation_status"] == "generated"
    assert items[1]["khmer_translation"] == "អាហារសម្រន់ & បង្អែម"

    assert items[2]["selected_original_text"]["value"] == "Ready-to-eat / canned"
    assert items[2]["translation_status"] == "generated"
    assert items[2]["khmer_translation"] == "រួចជាស្រេចដើម្បីបរិភោគ / កំប៉ុង"

    assert (
        product["categories_text"]["khmer_translation"]
        == "សូកូឡាខ្មៅ (70%), អាហារសម្រន់ & បង្អែម, រួចជាស្រេចដើម្បីបរិភោគ / កំប៉ុង"
    )


def test_v1_product_lookup_partial_category_translation_survives() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "categories": "Chocolate, Snacks",
            "lang": "en",
        }
    )
    # Provider returns translation for category_0, but category_1 is missing
    provider = FakeTranslationProvider(
        canned_translations={
            "category_0": "សូកូឡា",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "partial"

    product = body["data"]["product"]
    items = product["category_items"]
    assert len(items) == 2

    # Successful item survives
    assert items[0]["key"] == "category_0"
    assert items[0]["translation_status"] == "generated"
    assert items[0]["khmer_translation"] == "សូកូឡា"

    # Failed item retains unavailable status
    assert items[1]["key"] == "category_1"
    assert items[1]["translation_status"] == "translation_unavailable"
    assert items[1]["khmer_translation"] is None

    # Legacy field is unavailable because not every required item has usable Khmer text
    assert product["categories_text"]["translation_status"] == "translation_unavailable"
    assert product["categories_text"]["khmer_translation"] is None


def test_v1_product_lookup_source_khmer_categories() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "categories": "សូកូឡា, អាហារសម្រន់",
            "lang": "km",
        }
    )
    provider = FakeTranslationProvider()
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["translation"]["status"] == "not_needed"
    assert provider.call_count == 0

    product = body["data"]["product"]
    items = product["category_items"]
    assert len(items) == 2

    assert items[0]["translation_status"] == "source_khmer_available"
    assert items[0]["selected_original_text"]["value"] == "សូកូឡា"
    assert items[0]["khmer_translation"] is None

    assert items[1]["translation_status"] == "source_khmer_available"
    assert items[1]["selected_original_text"]["value"] == "អាហារសម្រន់"
    assert items[1]["khmer_translation"] is None

    assert product["categories_text"]["translation_status"] == "source_khmer_available"
    assert product["categories_text"]["khmer_translation"] is None


def test_v1_product_lookup_missing_human_readable_categories() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Plain Water",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "ទឹកបរិសុទ្ធ",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    product = body["data"]["product"]
    assert product["category_items"] == []
    assert product["categories"] == []
    assert product["categories_text"]["translation_status"] == "source_data_unavailable"
    assert product["categories_text"]["khmer_translation"] is None


def test_v1_product_lookup_taxonomy_only_categories_produces_no_fabricated_translations() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "categories_tags": ["en:chocolate", "en:snacks"],
        }
    )
    provider = FakeTranslationProvider()
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")

    assert response.status_code == 200
    body = response.json()
    product = body["data"]["product"]
    # No human-readable category translations fabricated from slugs
    assert product["category_items"] == []
    assert product["categories_text"]["translation_status"] == "source_data_unavailable"
    assert product["categories_text"]["khmer_translation"] is None
    # Legacy categories list retains display labels
    assert product["categories"] == ["chocolate", "snacks"]
    assert provider.call_count == 0


def test_v1_product_lookup_category_items_cache_reuse() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "categories": "Chocolate, Snacks",
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(
        canned_translations={
            "category_0": "សូកូឡា",
            "category_1": "អាហារសម្រន់",
        }
    )
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        resp1 = client.get("/api/v1/products/4006381333931?language=kh")
        assert resp1.status_code == 200
        assert provider.call_count == 1
        body1 = resp1.json()
        assert body1["meta"]["translation"]["status"] == "complete"
        assert body1["data"]["product"]["categories_text"]["translation_status"] == "generated"
        assert body1["data"]["product"]["categories_text"]["khmer_translation"] == "សូកូឡា, អាហារសម្រន់"
        assert body1["data"]["product"]["category_items"][0]["khmer_translation"] == "សូកូឡា"

        # Second request should be a cache hit without invoking the provider
        resp2 = client.get("/api/v1/products/4006381333931?language=kh")
        assert resp2.status_code == 200
        assert provider.call_count == 1
        body2 = resp2.json()
        assert body2["meta"]["translation"]["status"] == "complete"
        assert body2["data"]["product"]["categories_text"]["translation_status"] == "generated"
        assert body2["data"]["product"]["categories_text"]["khmer_translation"] == "សូកូឡា, អាហារសម្រន់"
        assert body2["data"]["product"]["category_items"][0]["khmer_translation"] == "សូកូឡា"
        assert body2["data"]["product"]["category_items"][1]["khmer_translation"] == "អាហារសម្រន់"


def test_v1_product_lookup_taxonomy_references_all_groups_and_sources() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Chocolate Bar",
            "categories_tags": ["en:chocolates"],
            "categories_hierarchy": ["en:snacks", "en:chocolates"],
            "additives_tags": ["en:e330"],
            "additives_hierarchy": ["en:e330", "en:e322"],
            "labels_tags": ["en:organic", "fr:agriculture-biologique"],
            "countries_tags": ["en:cambodia", "en:france"],
            "packaging_materials_tags": ["en:paperboard"],
            "packagings_materials": {"en:plastic": 1, "all": 2},
            "packaging_shapes_tags": ["en:box"],
            "packaging_recycling_tags": ["en:recycle"],
            "packagings": [
                {
                    "material": "en:glass",
                    "shape": "en:bottle",
                    "recycling": "en:recycle-glass",
                }
            ],
            "lang": "en",
        }
    )
    provider = FakeTranslationProvider(canned_translations={"product_name": "ដុំសូកូឡា"})
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")
        assert response.status_code == 200
        body = response.json()

        # Source attribution preserved
        assert body["meta"]["source"]["name"] == "Open Food Facts"
        assert body["meta"]["source"]["product_url"] == "https://world.openfoodfacts.org/product/4006381333931"

        tax = body["data"]["product"]["taxonomy_references"]

        # Categories
        assert tax["categories"] == [
            {"id": "en:chocolates", "source_field": "categories_tags"},
            {"id": "en:snacks", "source_field": "categories_hierarchy"},
        ]

        # Additives
        assert tax["additives"] == [
            {"id": "en:e330", "source_field": "additives_tags"},
            {"id": "en:e322", "source_field": "additives_hierarchy"},
        ]

        # Labels
        assert tax["labels"] == [
            {"id": "en:organic", "source_field": "labels_tags"},
            {"id": "fr:agriculture-biologique", "source_field": "labels_tags"},
        ]

        # Countries
        assert tax["countries"] == [
            {"id": "en:cambodia", "source_field": "countries_tags"},
            {"id": "en:france", "source_field": "countries_tags"},
        ]

        # Packaging materials
        assert tax["packaging_materials"] == [
            {"id": "en:paperboard", "source_field": "packaging_materials_tags"},
            {"id": "en:plastic", "source_field": "packagings_materials"},
            {"id": "en:glass", "source_field": "packagings.material"},
        ]

        # Packaging shapes
        assert tax["packaging_shapes"] == [
            {"id": "en:box", "source_field": "packaging_shapes_tags"},
            {"id": "en:bottle", "source_field": "packagings.shape"},
        ]

        # Packaging recycling terms
        assert tax["packaging_recycling_terms"] == [
            {"id": "en:recycle", "source_field": "packaging_recycling_tags"},
            {"id": "en:recycle-glass", "source_field": "packagings.recycling"},
        ]

        # No provider translation was requested or called for taxonomy references
        if provider.last_request is not None:
            assert "categories" not in provider.last_request.fields
            assert "additives" not in provider.last_request.fields
            assert "labels" not in provider.last_request.fields
            assert "countries" not in provider.last_request.fields


def test_v1_product_lookup_taxonomy_only_record() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "categories_tags": ["en:chocolate", "en:snacks"],
            "labels_tags": ["en:organic"],
        }
    )
    provider = FakeTranslationProvider()
    coord = _make_test_coordinator(provider=provider)

    with _client(database, coordinator=coord) as client:
        response = client.get("/api/v1/products/4006381333931?language=kh")
        assert response.status_code == 200
        body = response.json()
        product = body["data"]["product"]

        # Taxonomy references populated
        assert product["taxonomy_references"]["categories"] == [
            {"id": "en:chocolate", "source_field": "categories_tags"},
            {"id": "en:snacks", "source_field": "categories_tags"},
        ]
        assert product["taxonomy_references"]["labels"] == [
            {"id": "en:organic", "source_field": "labels_tags"},
        ]

        # Category items remain empty; translation is source_data_unavailable;
        # legacy list retains display labels
        assert product["category_items"] == []
        assert product["categories_text"]["translation_status"] == "source_data_unavailable"
        assert product["categories"] == ["chocolate", "snacks"]
        assert provider.call_count == 0


def test_v1_product_lookup_sparse_and_no_slugification() -> None:
    database = _dataset_database()
    database[COLLECTION_NAME].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Organic Milk",
            "categories": "Dairy, Milk",
            "labels": "Organic, Local",
            "countries": "Cambodia",
            "additives": "E330",
            "lang": "en",
        }
    )
    with _client(database) as client:
        response = client.get("/api/v1/products/4006381333931")
        assert response.status_code == 200
        body = response.json()
        product = body["data"]["product"]

        # Presentation fields are populated from human-readable text
        assert product["categories"] == ["Dairy", "Milk"]
        assert product["labels"] == ["Organic", "Local"]
        assert product["countries"] == ["Cambodia"]
        assert product["additives"] == ["E330"]

        # Taxonomy references are empty because no taxonomy tags exist in source
        tax = product["taxonomy_references"]
        assert tax["categories"] == []
        assert tax["additives"] == []
        assert tax["labels"] == []
        assert tax["countries"] == []
        assert tax["packaging_materials"] == []
        assert tax["packaging_shapes"] == []
        assert tax["packaging_recycling_terms"] == []
