from __future__ import annotations

from datetime import UTC, datetime, timedelta

from lifegoods.generated_data.budget import InMemoryTranslationBudgetLimiter
from lifegoods.generated_data.cache import InMemoryTranslationHotCache
from lifegoods.generated_data.coordinator import TranslationCoordinator
from lifegoods.generated_data.repository import (
    InMemoryGeneratedDataRepository,
    StoredTranslationArtifact,
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
from lifegoods.translation.contracts import (
    TranslationFieldStatus,
    TranslationOverallStatus,
)
from lifegoods.translation.module import KhmerTranslationModule
from lifegoods.translation.provider import (
    FakeTranslationProvider,
)


def _empty_product() -> ProductProjection:
    return ProductProjection(
        identity=ProductIdentityProjection(),
        front_image=None,
        ingredients=[],
        additives=[],
        storage_instructions=[],
        nutrition=NutritionProjection(),
        assessments=SourceAssessmentsProjection(),
        categories=[],
        labels=[],
        countries=[],
        packaging=PackagingProjection(),
        environment=EnvironmentProjection(),
        source=SourceRecordMetadataProjection(),
    )


def _make_product(
    barcode: str = "8850123456789",
    name: str = "Green Tea",
    snapshot: str = "snapshot-v1",
) -> ProductProjection:
    p = _empty_product()
    p.identity.barcode = barcode
    p.identity.brands = ["Oishi"]
    p.identity.names = [OriginalText(value=name, source_field="product_name_en", language="en")]
    p.identity.generic_names = [
        OriginalText(value="Beverage", source_field="generic_name_en", language="en")
    ]
    p.ingredients = [
        OriginalText(value="Green tea, Water", source_field="ingredients_text_en", language="en")
    ]
    p.source.dataset_version = snapshot
    p.source.product_url = f"https://openfoodfacts.org/product/{barcode}"
    return p


def test_coordinator_fast_path_when_not_needed() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    # Product with source-provided Khmer
    km_product = _empty_product()
    km_product.identity.barcode = "1234567890123"
    km_product.identity.names = [
        OriginalText(value="តែបៃតង", source_field="product_name_km", language="km")
    ]

    result = coordinator.get_or_generate_translation(km_product)
    assert result.overall_status == TranslationOverallStatus.NOT_NEEDED
    assert result.fields["product_name"].status == TranslationFieldStatus.SOURCE_KHMER_AVAILABLE
    assert provider.call_count == 0
    assert repo.get_aggregate_stats().artifacts_count == 0


def test_coordinator_cache_hit_returns_without_calling_provider_or_store() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    product = _make_product()

    # 1st call: Misses cache and store -> generates via provider
    result1 = coordinator.get_or_generate_translation(product)
    assert result1.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 1
    assert result1.fields["product_name"].khmer_translation == "តែបៃតង"

    # 2nd call: Hits Redis hot cache -> provider NOT called again
    result2 = coordinator.get_or_generate_translation(product)
    assert result2.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 1
    assert result2.fields["product_name"].khmer_translation == "តែបៃតង"


def test_coordinator_store_hit_populates_hot_cache_and_returns() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    product = _make_product()

    # 1st call generates and persists to repo + cache
    coordinator.get_or_generate_translation(product)
    assert provider.call_count == 1

    # Simulate Redis restart / cache wipe
    content_hash, config_fp, _ = module.compute_translation_identity(product)
    cache.delete(content_hash, config_fp)
    assert cache.get(content_hash, config_fp) is None

    # 2nd call: Hits MongoDB store -> repopulates hot cache -> provider NOT called
    result = coordinator.get_or_generate_translation(product)
    assert result.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 1
    assert cache.get(content_hash, config_fp) is not None


def test_coordinator_single_flight_cross_instance_coordination() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
        poll_interval_seconds=0.01,
    )

    product = _make_product()
    content_hash, config_fp, _ = module.compute_translation_identity(product)

    # Worker 1 acquires lease
    assert repo.acquire_lease(content_hash, config_fp, "worker-1", ttl_seconds=5.0) is True

    # Worker 2 attempts translation; since Worker 1 holds the lease, Worker 2 enters polling loop.
    # While Worker 2 is polling, simulate Worker 1 finishing and saving the artifact.
    # We test this by using a helper or callback, or simply generating Worker 1's artifact
    worker1_res = module.translate_product(product)
    from lifegoods.generated_data.coordinator import result_to_stored_artifact

    repo.save_artifact(result_to_stored_artifact(worker1_res))
    repo.release_lease(content_hash, config_fp, "worker-1")

    # Worker 2 now runs get_or_generate_translation
    worker2_res = coordinator.get_or_generate_translation(product, deadline_seconds=1.0)
    assert worker2_res.overall_status == TranslationOverallStatus.COMPLETE
    assert worker2_res.fields["product_name"].khmer_translation == "តែបៃតង"
    # Provider was called only by Worker 1, not Worker 2
    assert provider.call_count == 1


def test_coordinator_expired_crashed_lease_recovery() -> None:
    now = datetime(2026, 9, 5, 12, 0, 0, tzinfo=UTC)
    current_time = [now]
    clock = [100.0]

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository(datetime_provider=lambda: current_time[0])
    cache = InMemoryTranslationHotCache(ttl_seconds=100, monotonic=lambda: clock[0])
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10, monotonic=lambda: clock[0])

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
        monotonic=lambda: clock[0],
        poll_interval_seconds=0.01,
    )

    product = _make_product()
    content_hash, config_fp, _ = module.compute_translation_identity(product)

    # Worker 1 acquired lease with 5s TTL and crashed
    repo.acquire_lease(content_hash, config_fp, "crashed-worker", ttl_seconds=5.0)

    # Advance time past 5s
    current_time[0] = now + timedelta(seconds=6)
    clock[0] = 106.0

    # Worker 2 comes in: recovers expired lease and completes translation
    result = coordinator.get_or_generate_translation(product)
    assert result.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 1


def test_coordinator_retries_partial_translation_after_short_cache() -> None:
    # Provider returns invalid translation for generic_name (no Khmer script)
    provider = FakeTranslationProvider(
        canned_translations={
            "generic_name": "invalid_english_only",
            "product_name": "តែបៃតង",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository()
    clock = [0.0]
    cache = InMemoryTranslationHotCache(ttl_seconds=100, monotonic=lambda: clock[0])
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    product = _make_product()
    result1 = coordinator.get_or_generate_translation(product)

    assert result1.overall_status == TranslationOverallStatus.PARTIAL
    # Partial results are useful to the current Shopper but are not durable.
    stats = repo.get_aggregate_stats()
    assert stats.artifacts_count == 0

    # The short-lived cache prevents duplicate calls during the retry interval.
    result2 = coordinator.get_or_generate_translation(product)
    assert result2.overall_status == TranslationOverallStatus.PARTIAL
    assert provider.call_count == 1

    # After the interval, the failed field is retried and can complete.
    provider.canned_translations["generic_name"] = "ភេសជ្ជៈ"
    clock[0] = 61.0
    result3 = coordinator.get_or_generate_translation(product)
    assert result3.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 2
    assert repo.get_aggregate_stats().artifacts_count == 1


def test_coordinator_stores_complete_failure_as_temporary_cooldown(
    caplog,
) -> None:
    now = datetime(2026, 9, 5, 12, 0, 0, tzinfo=UTC)
    current_time = [now]
    clock = [100.0]

    # Failing provider
    provider = FakeTranslationProvider(should_fail=True)
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository(datetime_provider=lambda: current_time[0])
    cache = InMemoryTranslationHotCache(ttl_seconds=100, monotonic=lambda: clock[0])
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10, monotonic=lambda: clock[0])

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
        cooldown_seconds=60.0,
        monotonic=lambda: clock[0],
    )

    product = _make_product()
    result1 = coordinator.get_or_generate_translation(product)
    assert result1.overall_status == TranslationOverallStatus.UNAVAILABLE
    assert provider.call_count == 1

    # Notice: NO artifact stored in translation_artifacts, but active cooldown recorded
    stats = repo.get_aggregate_stats()
    assert stats.artifacts_count == 0
    assert stats.active_cooldowns_count == 1

    # 2nd call: within cooldown period -> returns UNAVAILABLE without calling provider
    with caplog.at_level("INFO", logger="lifegoods.generated_data.coordinator"):
        result2 = coordinator.get_or_generate_translation(product)
    assert result2.overall_status == TranslationOverallStatus.UNAVAILABLE
    assert provider.call_count == 1
    cooldown_logs = [
        record
        for record in caplog.records
        if getattr(record, "event", None) == "translation_generation_skipped"
    ]
    assert cooldown_logs[-1].failure_category == "cooldown"

    # Advance time past cooldown (60s)
    current_time[0] = now + timedelta(seconds=61)
    clock[0] = 161.0

    # Provider is fixed now
    provider.should_fail = False
    provider.canned_translations = {
        "product_name": "តែបៃតង",
        "generic_name": "ភេសជ្ជៈ",
        "ingredients_text": "តែបៃតង, ទឹក",
    }
    result3 = coordinator.get_or_generate_translation(product)
    assert result3.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 2


def test_coordinator_quarantined_artifact_is_withdrawn() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    product = _make_product()
    result1 = coordinator.get_or_generate_translation(product)
    assert result1.overall_status == TranslationOverallStatus.COMPLETE

    # Quarantine the artifact administratively
    content_hash, config_fp, _ = module.compute_translation_identity(product)
    repo.quarantine_artifact(content_hash, config_fp, reason="Administrative withdrawal")
    cache.delete(content_hash, config_fp)

    # Next call returns UNAVAILABLE and does NOT serve quarantined text
    result2 = coordinator.get_or_generate_translation(product)
    assert result2.overall_status == TranslationOverallStatus.UNAVAILABLE
    for field in result2.fields.values():
        assert field.khmer_translation is None


def test_coordinator_shared_generation_budget_fails_closed(caplog) -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    # Budget of 1 call
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=1)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    provider.canned_translations["product_name"] = "ផលិតផល __LG_TOK_0__"
    # 1st call uses budget
    res1 = coordinator.get_or_generate_translation(_make_product(name="Product 1"))
    assert res1.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 1

    # 2nd call with different content exceeds budget -> fails closed
    with caplog.at_level("INFO", logger="lifegoods.generated_data.coordinator"):
        res2 = coordinator.get_or_generate_translation(_make_product(name="Product 2"))
    assert res2.overall_status == TranslationOverallStatus.UNAVAILABLE
    assert provider.call_count == 1
    budget_logs = [
        record
        for record in caplog.records
        if getattr(record, "event", None) == "translation_generation_skipped"
    ]
    assert budget_logs[-1].failure_category == "budget_exhausted"


def test_coordinator_identical_canonical_input_reused_across_dataset_snapshots() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    # Product in Snapshot 1
    p_snap1 = _make_product(name="Matcha", snapshot="snapshot-2026-08")
    res1 = coordinator.get_or_generate_translation(p_snap1)
    assert res1.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 1

    # Product in Snapshot 2 with different barcode and snapshot version, but identical text & brand
    p_snap2 = _make_product(barcode="9999999999999", name="Matcha", snapshot="snapshot-2026-09")
    res2 = coordinator.get_or_generate_translation(p_snap2)
    assert res2.overall_status == TranslationOverallStatus.COMPLETE
    # Provider NOT called again! Identical content reused across snapshots!
    assert provider.call_count == 1


def test_coordinator_changed_content_or_config_never_reuses_incompatible_artifact() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module_v1 = KhmerTranslationModule(provider, config_version="v1")
    repo = InMemoryGeneratedDataRepository()
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coord_v1 = TranslationCoordinator(module=module_v1, repository=repo, cache=cache, budget=budget)
    res_v1 = coord_v1.get_or_generate_translation(_make_product())
    assert provider.call_count == 1

    # New config version "v2"
    module_v2 = KhmerTranslationModule(provider, config_version="v2")
    coord_v2 = TranslationCoordinator(module=module_v2, repository=repo, cache=cache, budget=budget)
    res_v2 = coord_v2.get_or_generate_translation(_make_product())
    # Generates anew because config fingerprint changed!
    assert provider.call_count == 2
    assert res_v1.config_fingerprint != res_v2.config_fingerprint


class FailingWriteRepo(InMemoryGeneratedDataRepository):
    def __init__(self, fail_on_save: bool = False, fail_on_acquire: bool = False) -> None:
        super().__init__()
        self.fail_on_save = fail_on_save
        self.fail_on_acquire = fail_on_acquire

    def save_artifact(self, artifact: StoredTranslationArtifact) -> None:
        if self.fail_on_save:
            from pymongo.errors import ConnectionFailure

            raise ConnectionFailure("Simulated MongoDB write failure")
        super().save_artifact(artifact)

    def acquire_lease(
        self, content_hash: str, config_fingerprint: str, owner_token: str, ttl_seconds: float
    ) -> bool:
        if self.fail_on_acquire:
            from pymongo.errors import ConnectionFailure

            raise ConnectionFailure("Simulated MongoDB lease acquisition failure")
        return super().acquire_lease(content_hash, config_fingerprint, owner_token, ttl_seconds)


def test_coordinator_generated_result_returned_even_if_write_fails() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = FailingWriteRepo(fail_on_save=True)
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    provider.canned_translations["product_name"] = "ផលិតផល __LG_TOK_0__"
    product1 = _make_product(name="Product 1")
    # 1st call: Translation succeeds, write fails. Result is still returned to the current request!
    res1 = coordinator.get_or_generate_translation(product1)
    assert res1.overall_status == TranslationOverallStatus.COMPLETE
    assert res1.fields["product_name"].khmer_translation == "ផលិតផល 1"
    assert provider.call_count == 1

    # But store degradation is now active -> subsequent requests do not start new provider calls!
    product2 = _make_product(name="Product 2")
    res2 = coordinator.get_or_generate_translation(product2)
    assert res2.overall_status == TranslationOverallStatus.UNAVAILABLE
    # Provider was NOT called again!
    assert provider.call_count == 1


def test_coordinator_store_unavailability_before_lease_prevents_provider_calls() -> None:
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "តែបៃតង",
            "generic_name": "ភេសជ្ជៈ",
            "ingredients_text": "តែបៃតង, ទឹក",
        }
    )
    module = KhmerTranslationModule(provider)
    repo = FailingWriteRepo(fail_on_acquire=True)
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    budget = InMemoryTranslationBudgetLimiter(requests_per_minute=10)

    coordinator = TranslationCoordinator(
        module=module,
        repository=repo,
        cache=cache,
        budget=budget,
    )

    product = _make_product()
    res = coordinator.get_or_generate_translation(product)
    assert res.overall_status == TranslationOverallStatus.UNAVAILABLE
    assert provider.call_count == 0
