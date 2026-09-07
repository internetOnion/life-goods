from __future__ import annotations

import threading
import time
from collections.abc import Iterator
from typing import Any, cast

import pytest
import redis
from pymongo import MongoClient

from lifegoods.core.settings import Settings
from lifegoods.generated_data.budget import RedisTranslationBudgetLimiter
from lifegoods.generated_data.cache import RedisTranslationHotCache
from lifegoods.generated_data.coordinator import TranslationCoordinator
from lifegoods.generated_data.repository import (
    MongoGeneratedDataRepository,
)
from lifegoods.generated_data.schema import (
    TRANSLATION_ARTIFACTS_COLLECTION,
    TRANSLATION_COOLDOWNS_COLLECTION,
    TRANSLATION_LEASES_COLLECTION,
    TRANSLATION_QUARANTINES_COLLECTION,
    ensure_generated_data_schema,
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
from lifegoods.translation.contracts import TranslationOverallStatus
from lifegoods.translation.module import KhmerTranslationModule
from lifegoods.translation.provider import (
    ProviderTranslationRequest,
    ProviderTranslationResponse,
)

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def settings() -> Settings:
    import os

    mongo_uri = os.getenv("LIFEGOODS_TEST_GENERATED_MONGODB_URI")
    redis_url = os.getenv("LIFEGOODS_TEST_REDIS_URL")
    if not mongo_uri or not redis_url:
        pytest.skip(
            "Set dedicated LIFEGOODS_TEST_GENERATED_MONGODB_URI and LIFEGOODS_TEST_REDIS_URL"
        )
    return Settings(
        generated_mongodb_uri=mongo_uri,
        generated_mongodb_database="lifegoods_generated_test",
        redis_url=redis_url,
    )


@pytest.fixture(scope="module")
def mongo_client(settings: Settings) -> Iterator[MongoClient[dict[str, Any]]]:
    client: MongoClient[dict[str, Any]] = MongoClient(
        settings.generated_mongodb_uri,
        serverSelectionTimeoutMS=settings.generated_mongodb_timeout_ms,
    )
    yield client
    client.close()


@pytest.fixture(scope="module")
def redis_client(settings: Settings) -> Iterator[redis.Redis]:
    client = redis.Redis.from_url(settings.redis_url)
    yield client
    client.close()


@pytest.fixture(autouse=True)
def clean_db(
    mongo_client: MongoClient[dict[str, Any]],
    settings: Settings,
    redis_client: redis.Redis,
) -> None:
    db = mongo_client[settings.generated_mongodb_database]
    ensure_generated_data_schema(db)
    # Clean up generated collections before each integration test
    db[TRANSLATION_ARTIFACTS_COLLECTION].delete_many({})
    db[TRANSLATION_LEASES_COLLECTION].delete_many({})
    db[TRANSLATION_COOLDOWNS_COLLECTION].delete_many({})
    db[TRANSLATION_QUARANTINES_COLLECTION].delete_many({})
    # Flush redis test db
    redis_client.flushdb()


def _make_integration_product(
    barcode: str = "8850123456789",
    name: str = "Organic Coconut Water",
) -> ProductProjection:
    return ProductProjection(
        identity=ProductIdentityProjection(
            barcode=barcode,
            brands=["CocoFresh"],
            names=[OriginalText(value=name, source_field="product_name_en", language="en")],
            generic_names=[
                OriginalText(value="Coconut Water", source_field="generic_name_en", language="en")
            ],
        ),
        front_image=None,
        ingredients=[
            OriginalText(
                value="Coconut water 100%",
                source_field="ingredients_text_en",
                language="en",
            )
        ],
        additives=[],
        storage_instructions=[],
        nutrition=NutritionProjection(),
        assessments=SourceAssessmentsProjection(),
        categories=[],
        labels=[],
        countries=[],
        packaging=PackagingProjection(),
        environment=EnvironmentProjection(),
        source=SourceRecordMetadataProjection(dataset_version="v1"),
    )


class SlowFakeProvider:
    provider_name = "test-fake"
    model = "canned-translations"

    def __init__(self, delay_seconds: float = 0.1) -> None:
        self.delay_seconds = delay_seconds
        self.call_count = 0
        self._lock = threading.Lock()

    def translate(self, request: ProviderTranslationRequest) -> ProviderTranslationResponse:
        with self._lock:
            self.call_count += 1
        time.sleep(self.delay_seconds)
        translations = {
            "product_name": "ទឹកដូងសរីរាង្គ",
            "generic_name": "ទឹកដូង",
            "ingredients_text": "ទឹកដូង __LG_TOK_0__",
        }
        return ProviderTranslationResponse(
            translations=translations,
            status="success",
        )


def test_atomic_lease_races_on_real_mongodb(
    mongo_client: MongoClient[dict[str, Any]], settings: Settings
) -> None:
    db = mongo_client[settings.generated_mongodb_database]
    repo = MongoGeneratedDataRepository(db)

    content_hash = "race_content_hash"
    config_fp = "race_config_fp"

    winners: list[str] = []
    lock = threading.Lock()

    def try_acquire(worker_id: str) -> None:
        if repo.acquire_lease(content_hash, config_fp, worker_id, ttl_seconds=5.0):
            with lock:
                winners.append(worker_id)

    threads = [threading.Thread(target=try_acquire, args=(f"worker_{i}",)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Exactly ONE worker won the race
    assert len(winners) == 1

    # Lease document exists with winner
    lease_doc = db[TRANSLATION_LEASES_COLLECTION].find_one(
        {"content_hash": content_hash, "translation_config_fingerprint": config_fp}
    )
    assert lease_doc is not None
    assert lease_doc["owner_token"] == winners[0]


def test_concurrent_single_flight_on_real_services(
    mongo_client: MongoClient[dict[str, Any]],
    redis_client: redis.Redis,
    settings: Settings,
) -> None:
    db = mongo_client[settings.generated_mongodb_database]
    repo = MongoGeneratedDataRepository(db)
    cache = RedisTranslationHotCache(redis_client, ttl_seconds=3600)  # type: ignore[arg-type]
    budget = RedisTranslationBudgetLimiter(redis_client, requests_per_minute=100)

    slow_provider = SlowFakeProvider(delay_seconds=0.15)
    module = KhmerTranslationModule(slow_provider)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
        poll_interval_seconds=0.03,
    )

    product = _make_integration_product()
    results: list[Any] = [None] * 5

    def run_worker(index: int) -> None:
        results[index] = coordinator.get_or_generate_translation(product, deadline_seconds=3.0)

    threads = [threading.Thread(target=run_worker, args=(i,)) for i in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Exactly ONE provider call across all 5 concurrent threads
    assert slow_provider.call_count == 1

    # All 5 threads received COMPLETE translation
    for res in results:
        assert res is not None
        assert res.overall_status == TranslationOverallStatus.COMPLETE
        assert "ទឹកដូង" in res.fields["product_name"].khmer_translation


def test_privacy_no_barcode_or_shopper_id_stored(
    mongo_client: MongoClient[dict[str, Any]],
    redis_client: redis.Redis,
    settings: Settings,
) -> None:
    db = mongo_client[settings.generated_mongodb_database]
    repo = MongoGeneratedDataRepository(db)
    cache = RedisTranslationHotCache(redis_client, ttl_seconds=3600)  # type: ignore[arg-type]
    budget = RedisTranslationBudgetLimiter(redis_client, requests_per_minute=100)

    provider = SlowFakeProvider(delay_seconds=0.01)
    module = KhmerTranslationModule(provider)
    coordinator = TranslationCoordinator(module=module, repository=repo, cache=cache, budget=budget)

    test_barcode = "8850987654321"
    product = _make_integration_product(barcode=test_barcode, name="Privacy Test Drink")

    res = coordinator.get_or_generate_translation(product)
    assert res.overall_status == TranslationOverallStatus.COMPLETE

    # Verify MongoDB: translation_artifacts document contains NO barcode
    art_doc = db[TRANSLATION_ARTIFACTS_COLLECTION].find_one({})
    assert art_doc is not None
    assert test_barcode not in str(art_doc)
    assert "barcode" not in art_doc

    # Verify Redis: keys and values contain NO barcode
    redis_keys = cast(list[bytes], redis_client.keys("translation:*"))
    assert len(redis_keys) > 0
    for r_key in redis_keys:
        assert test_barcode.encode() not in r_key
        k_type = cast(bytes, redis_client.type(r_key))
        if k_type == b"string":
            val = cast(bytes | None, redis_client.get(r_key))
            if val:
                assert test_barcode.encode() not in val
        elif k_type == b"zset":
            members = cast(list[bytes], redis_client.zrange(r_key, 0, -1))
            for m in members:
                assert test_barcode.encode() not in m


def test_quarantine_withdrawal_on_real_mongodb(
    mongo_client: MongoClient[dict[str, Any]],
    redis_client: redis.Redis,
    settings: Settings,
) -> None:
    db = mongo_client[settings.generated_mongodb_database]
    repo = MongoGeneratedDataRepository(db)
    cache = RedisTranslationHotCache(redis_client, ttl_seconds=3600)  # type: ignore[arg-type]
    budget = RedisTranslationBudgetLimiter(redis_client, requests_per_minute=100)

    provider = SlowFakeProvider(delay_seconds=0.01)
    module = KhmerTranslationModule(provider)
    coordinator = TranslationCoordinator(module=module, repository=repo, cache=cache, budget=budget)

    product = _make_integration_product()
    res1 = coordinator.get_or_generate_translation(product)
    assert res1.overall_status == TranslationOverallStatus.COMPLETE

    # Admin quarantines artifact in real MongoDB and invalidates cache
    content_hash, config_fp, _ = module.compute_translation_identity(product)
    repo.quarantine_artifact(content_hash, config_fp, reason="Administrative audit failure")
    cache.delete(content_hash, config_fp)

    # Subsequent request returns UNAVAILABLE and no translation
    res2 = coordinator.get_or_generate_translation(product)
    assert res2.overall_status == TranslationOverallStatus.UNAVAILABLE
    for f in res2.fields.values():
        assert f.khmer_translation is None


def test_expired_lease_recovery_on_real_mongodb(
    mongo_client: MongoClient[dict[str, Any]],
    redis_client: redis.Redis,
    settings: Settings,
) -> None:
    db = mongo_client[settings.generated_mongodb_database]
    repo = MongoGeneratedDataRepository(db)
    cache = RedisTranslationHotCache(redis_client, ttl_seconds=3600)  # type: ignore[arg-type]
    budget = RedisTranslationBudgetLimiter(redis_client, requests_per_minute=100)

    content_hash = "expire_test_hash"
    config_fp = "expire_test_fp"

    # Worker 1 acquires lease with a short TTL (0.15 seconds)
    assert repo.acquire_lease(content_hash, config_fp, "worker_1", ttl_seconds=0.15) is True

    # Worker 2 immediately attempts to acquire: should fail
    assert repo.acquire_lease(content_hash, config_fp, "worker_2", ttl_seconds=5.0) is False

    # Wait for lease to expire
    time.sleep(0.2)

    # Worker 2 attempts again: takes over the expired lease atomically
    assert repo.acquire_lease(content_hash, config_fp, "worker_2", ttl_seconds=5.0) is True

    lease_doc = db[TRANSLATION_LEASES_COLLECTION].find_one(
        {"content_hash": content_hash, "translation_config_fingerprint": config_fp}
    )
    assert lease_doc is not None
    assert lease_doc["owner_token"] == "worker_2"

    # Coordinator recovery: when lease expires, coordinator generates successfully
    slow_provider = SlowFakeProvider(delay_seconds=0.01)
    module = KhmerTranslationModule(slow_provider)
    coordinator = TranslationCoordinator(module=module, repository=repo, cache=cache, budget=budget)

    product = _make_integration_product(name="Expired Lease Recovery Product")
    c_hash, c_fp, _ = module.compute_translation_identity(product)

    # Simulate crashed worker holding a lease with short TTL
    repo.acquire_lease(c_hash, c_fp, "crashed_worker", ttl_seconds=0.15)
    time.sleep(0.2)

    # Coordinator takes over the expired lease and completes generation
    result = coordinator.get_or_generate_translation(product)
    assert result.overall_status == TranslationOverallStatus.COMPLETE
    assert slow_provider.call_count == 1
