import json
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any, cast

import pytest

from lifegoods.open_food_facts.models import (
    ExternalDatasetVersion,
    ExternalPackageRecord,
    ExternalSourceMetadata,
    SourcedValue,
)
from lifegoods.package_matches.assessments import (
    AllergenAssessmentEvaluation,
    AllergenAssessmentOutcome,
    AllergenAssessmentStatus,
    AllergenConceptOutcome,
    AllergenFinding,
    EvidenceCoverageState,
)
from lifegoods.package_matches.cache import (
    ASSESSMENT_CACHE_SCHEMA_VERSION,
    DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS,
    RedisAllergenAssessmentCache,
    assessment_cache_key_for_record,
    build_assessment_cache_key,
    compute_evidence_digest,
    compute_reference_dataset_context_digest,
    deserialize_assessment_evaluation,
    serialize_assessment_evaluation,
)
from lifegoods.package_matches.models import PackageMatchEvidence
from lifegoods.reference_datasets import AllergenAssessmentReferenceVersion

OFF_SOURCE = ExternalSourceMetadata(
    name="Open Food Facts",
    source_type="COMMUNITY_DATABASE",
    base_url="https://world.openfoodfacts.org",
    attribution="Open Food Facts contributors",
    database_license="ODbL",
    contents_license="Database Contents License",
    image_license="CC BY-SA",
)
DATASET_VERSION = ExternalDatasetVersion(
    id="dataset-2026-08-27",
    source_url="https://static.openfoodfacts.org/data/export.jsonl.gz",
    retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
    activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
    sha256="a" * 64,
)
REFERENCE_VERSION = AllergenAssessmentReferenceVersion(
    id="codex-food-allergen-2026-minimal",
    source_url="https://www.fao.org/fao-who-codexalimentarius/standards/cxs1-1985",
    retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
    activated_at=datetime(2026, 8, 27, 9, 0, tzinfo=UTC),
    sha256="d" * 64,
    review_kind="FOOD_DOMAIN_REVIEW",
    dataset_kind="FOOD_ALLERGEN",
)


def sample_record(
    *,
    record_id: str = "4006381333931",
    source_revision: str | None = "1787462400",
    ingredient_text: str = "Cocoa mass, sugar, cocoa butter, milk powder",
    dataset_version: ExternalDatasetVersion = DATASET_VERSION,
) -> ExternalPackageRecord:
    return ExternalPackageRecord(
        identifier="4006381333931",
        source=OFF_SOURCE,
        source_record_id=record_id,
        request_url=f"https://world.openfoodfacts.org/api/v2/product/{record_id}",
        source_url=f"https://world.openfoodfacts.org/product/{record_id}",
        names=(
            SourcedValue(
                value="Dark chocolate",
                source_field="product_name_en",
                language="en",
            ),
        ),
        brands=SourcedValue(value=("Example Foods",), source_field="brands"),
        quantity=SourcedValue(value="100 g", source_field="quantity"),
        ingredient_texts=(
            SourcedValue(
                value=ingredient_text,
                source_field="ingredients_text_en",
                language="en",
            ),
        ),
        allergen_declaration=SourcedValue(
            value="Contains milk", source_field="allergens", language="en"
        ),
        allergen_tags=SourcedValue(value=("en:milk",), source_field="allergens_tags"),
        trace_declaration=SourcedValue(
            value="May contain nuts", source_field="traces", language="en"
        ),
        trace_tags=SourcedValue(value=("en:nuts",), source_field="traces_tags"),
        additives=None,
        storage_conditions=(),
        manufacturing_places=None,
        halal_label_claim=None,
        packaging_languages=None,
        countries_sold=None,
        nutrition=(),
        selected_images=(),
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        source_revision=source_revision,
        dataset_version=dataset_version,
    )


def test_build_assessment_cache_key_formats_all_key_components() -> None:
    key = build_assessment_cache_key(
        off_dataset_version_id="dataset-2026-08-27",
        record_id="4006381333931",
        source_revision_or_digest="1787462400",
        reference_dataset_context_digest="reference-context-digest",
        engine_version="0.2.0",
    )
    assert key == (
        "assessment:eval:v2:dataset-2026-08-27:4006381333931:1787462400:"
        "reference-context-digest:0.2.0"
    )


def test_compute_evidence_digest_is_deterministic_and_sensitive_to_evidence() -> None:
    record1 = sample_record(source_revision=None, ingredient_text="Cocoa, milk")
    record2 = sample_record(source_revision=None, ingredient_text="Cocoa, milk")
    record3 = sample_record(source_revision=None, ingredient_text="Cocoa, soy")

    digest1 = compute_evidence_digest(record1)
    digest2 = compute_evidence_digest(record2)
    digest3 = compute_evidence_digest(record3)

    assert len(digest1) == 64
    assert digest1 == digest2
    assert digest1 != digest3


def test_assessment_cache_key_for_record_includes_revision_and_evidence_digest() -> None:
    record = sample_record(source_revision="1787462400")
    digest = compute_evidence_digest(record)
    key = assessment_cache_key_for_record(
        record,
        reference_dataset_version=REFERENCE_VERSION,
        engine_version="0.2.0",
    )
    context_digest = compute_reference_dataset_context_digest(REFERENCE_VERSION)
    assert key == (
        f"assessment:eval:v2:dataset-2026-08-27:4006381333931:1787462400:{digest}:"
        f"{context_digest}:0.2.0"
    )


def test_assessment_cache_key_for_record_uses_none_revision_when_missing() -> None:
    record = sample_record(source_revision=None)
    digest = compute_evidence_digest(record)
    key = assessment_cache_key_for_record(
        record,
        reference_dataset_version=REFERENCE_VERSION,
        engine_version="0.2.0",
    )
    context_digest = compute_reference_dataset_context_digest(REFERENCE_VERSION)
    assert key == (
        f"assessment:eval:v2:dataset-2026-08-27:4006381333931:none:{digest}:"
        f"{context_digest}:0.2.0"
    )


def test_cache_key_changes_for_each_key_component() -> None:
    base_record = sample_record()
    base_key = assessment_cache_key_for_record(
        base_record,
        reference_dataset_version=REFERENCE_VERSION,
        engine_version="0.2.0",
    )

    # 1. OFF dataset version change
    diff_off_version = ExternalDatasetVersion(
        id="dataset-2026-08-28",
        source_url=DATASET_VERSION.source_url,
        retrieved_at=DATASET_VERSION.retrieved_at,
        activated_at=DATASET_VERSION.activated_at,
        sha256=DATASET_VERSION.sha256,
    )
    key_diff_off = assessment_cache_key_for_record(
        sample_record(dataset_version=diff_off_version),
        reference_dataset_version=REFERENCE_VERSION,
        engine_version="0.2.0",
    )
    assert key_diff_off != base_key

    # 2. Record ID change
    key_diff_record = assessment_cache_key_for_record(
        sample_record(record_id="9999999999999"),
        reference_dataset_version=REFERENCE_VERSION,
        engine_version="0.2.0",
    )
    assert key_diff_record != base_key

    # 3. Source revision change
    key_diff_rev = assessment_cache_key_for_record(
        sample_record(source_revision="1787469999"),
        reference_dataset_version=REFERENCE_VERSION,
        engine_version="0.2.0",
    )
    assert key_diff_rev != base_key

    # 4. Evidence digest change (when revision is None)
    key_diff_evidence = assessment_cache_key_for_record(
        sample_record(source_revision=None, ingredient_text="Different ingredients"),
        reference_dataset_version=REFERENCE_VERSION,
        engine_version="0.2.0",
    )
    assert key_diff_evidence != base_key

    # 5. Reference dataset version change
    key_diff_ref = assessment_cache_key_for_record(
        base_record,
        reference_dataset_version=replace(REFERENCE_VERSION, id="codex-food-allergen-2026-v2"),
        engine_version="0.2.0",
    )
    assert key_diff_ref != base_key

    # 6. Engine version change
    key_diff_engine = assessment_cache_key_for_record(
        base_record,
        reference_dataset_version=REFERENCE_VERSION,
        engine_version="0.3.0",
    )
    assert key_diff_engine != base_key


@pytest.mark.parametrize(
    "changed_version",
    [
        replace(
            REFERENCE_VERSION,
            activated_at=datetime(2026, 8, 27, 10, 0, tzinfo=UTC),
        ),
        replace(REFERENCE_VERSION, review_kind="SECOND_FOOD_DOMAIN_REVIEW"),
        replace(REFERENCE_VERSION, dataset_kind="OTHER_REVIEWED_DATASET"),
        replace(REFERENCE_VERSION, sha256="e" * 64),
    ],
)
def test_reference_context_digest_invalidates_same_version_context_changes(
    changed_version: AllergenAssessmentReferenceVersion,
) -> None:
    assert compute_reference_dataset_context_digest(changed_version) != (
        compute_reference_dataset_context_digest(REFERENCE_VERSION)
    )


def sample_evaluation() -> AllergenAssessmentEvaluation:
    concept = AllergenConceptOutcome(
        concept_id="concept-food-allergen-milk",
        name="Milk and milk products",
        outcome=AllergenAssessmentOutcome.DERIVED_FROM_INGREDIENT,
        reason=None,
        finding_ids=("finding-1",),
        parent_ids=("parent-root",),
        rule_ids=("rule-milk-1",),
    )
    finding = AllergenFinding(
        id="finding-1",
        concept_id="concept-food-allergen-milk",
        relationship_type="EXACT_NAME",
        matched_text="milk",
        start_index=33,
        end_index=37,
        mapping_id="map-en-milk-exact",
        rule_id="rule-milk-1",
        source_text="Cocoa mass, sugar, cocoa butter, milk powder",
        language="en",
        source_field="ingredients_text_en",
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        source_revision="1787462400",
        off_dataset_version_id="dataset-2026-08-27",
        reference_dataset_version_id="codex-food-allergen-2026-minimal",
        engine_version="0.1.0",
    )
    signal = PackageMatchEvidence(
        field="allergen_declaration",
        value="Contains milk",
        source_field="allergens",
        source_name="Open Food Facts",
        source_url="https://world.openfoodfacts.org/product/4006381333931",
        language="en",
        observed_at=None,
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        source_revision="1787462400",
        dataset_version_id="dataset-2026-08-27",
    )
    return AllergenAssessmentEvaluation(
        status=AllergenAssessmentStatus.COMPLETED,
        reason=None,
        evidence_coverage=EvidenceCoverageState.PARTIAL,
        engine_version="0.1.0",
        reference_dataset_version=REFERENCE_VERSION,
        concepts=(concept,),
        findings=(finding,),
        source_signals=(signal,),
    )


def test_serialization_roundtrip_preserves_equality_and_types() -> None:
    original = sample_evaluation()
    serialized = serialize_assessment_evaluation(original)
    assert isinstance(serialized, str)

    restored = deserialize_assessment_evaluation(serialized)
    assert restored == original
    assert restored.status == original.status
    assert restored.reference_dataset_version == original.reference_dataset_version
    assert restored.concepts == original.concepts
    assert restored.findings == original.findings
    assert restored.source_signals == original.source_signals

    payload = json.loads(serialized)
    assert payload["schema_version"] == ASSESSMENT_CACHE_SCHEMA_VERSION == 2


@pytest.mark.parametrize(
    ("collection_name", "missing_field"),
    [
        ("concepts", "finding_ids"),
        ("findings", "source_field"),
        ("source_signals", "retrieved_at"),
    ],
)
def test_deserialize_rejects_incomplete_nested_cache_payloads(
    collection_name: str,
    missing_field: str,
) -> None:
    payload = json.loads(serialize_assessment_evaluation(sample_evaluation()))
    del payload[collection_name][0][missing_field]

    with pytest.raises(ValueError):
        deserialize_assessment_evaluation(json.dumps(payload))


def test_serialization_contains_no_shopper_session_or_run_identifiers() -> None:
    evaluation = sample_evaluation()
    serialized = serialize_assessment_evaluation(evaluation)

    forbidden_terms = [
        "shopper_id",
        "user_id",
        "session_id",
        "preferences",
        "run_id",
        "evaluation_fingerprint",
    ]
    for term in forbidden_terms:
        assert f'"{term}"' not in serialized


def test_deserialize_malformed_json_raises_value_error() -> None:
    import pytest

    with pytest.raises(ValueError):
        deserialize_assessment_evaluation("not-valid-json")

    with pytest.raises(ValueError):
        deserialize_assessment_evaluation('{"invalid": "structure"}')


def test_redis_cache_hit_and_miss_with_7_day_ttl() -> None:
    import fakeredis

    redis_client = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(redis_client)
    key = "test:key:1"

    # Miss
    assert cache.get(key) is None

    # Set
    evaluation = sample_evaluation()
    cache.set(key, evaluation)

    # TTL verification (7 days = 604800 seconds)
    ttl = int(cast(Any, redis_client.ttl(key)))
    assert 604700 <= ttl <= DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS
    assert DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS == 7 * 24 * 60 * 60

    # Hit
    cached = cache.get(key)
    assert cached == evaluation


def test_redis_cache_expired_entry_returns_none() -> None:
    import fakeredis

    redis_client = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(redis_client, ttl_seconds=1)
    key = "test:key:expired"

    evaluation = sample_evaluation()
    cache.set(key, evaluation)

    assert cache.get(key) == evaluation
    # Advance time or expire key
    redis_client.expire(key, 0)
    assert cache.get(key) is None


def test_redis_cache_malformed_value_recomputes_and_replaces_safely() -> None:
    import fakeredis

    redis_client = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(redis_client)
    key = "test:key:malformed"

    # Insert corrupt non-JSON data directly into Redis
    redis_client.set(key, "{not-json-corrupt-data", ex=604800)

    # get returns None on malformed value
    assert cache.get(key) is None

    # Replace with valid evaluation
    evaluation = sample_evaluation()
    cache.set(key, evaluation)

    # get now returns valid evaluation
    assert cache.get(key) == evaluation


def test_redis_cache_obsolete_outcome_status_is_treated_as_a_miss() -> None:
    import fakeredis

    redis_client = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(redis_client)
    key = "test:key:obsolete-status"
    obsolete_payload = serialize_assessment_evaluation(sample_evaluation()).replace(
        '"status":"COMPLETED"',
        '"status":"DERIVED_FROM_INGREDIENT"',
    )
    redis_client.set(key, obsolete_payload, ex=604800)

    assert cache.get(key) is None


def test_redis_cache_outage_bypass_on_get_returns_none() -> None:
    from unittest.mock import MagicMock

    import redis.exceptions

    failing_client = MagicMock()
    failing_client.get.side_effect = redis.exceptions.ConnectionError("Connection refused")

    cache = RedisAllergenAssessmentCache(failing_client)
    # Should not throw, should return None
    assert cache.get("test:key") is None


def test_redis_cache_outage_bypass_on_set_continues_normally() -> None:
    from unittest.mock import MagicMock

    import redis.exceptions

    failing_client = MagicMock()
    failing_client.set.side_effect = redis.exceptions.TimeoutError("Socket timeout")

    cache = RedisAllergenAssessmentCache(failing_client)
    # Should not throw
    cache.set("test:key", sample_evaluation())


class SpyMatcher:
    def __init__(self) -> None:
        self.call_count = 0

    def match(self, **kwargs) -> tuple[AllergenFinding, ...]:
        self.call_count += 1
        return ()


def test_evaluator_cache_hit_bypasses_matcher() -> None:
    import fakeredis
    from test_allergen_assessments import (
        StubAllergenReferenceDataAccess,
        sample_reference_data,
    )

    from lifegoods.package_matches.assessments import StandardAllergenAssessmentEvaluator

    ref_data = sample_reference_data()
    access = StubAllergenReferenceDataAccess(ref_data)
    spy_matcher = SpyMatcher()
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(redis_client)

    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
        matcher=spy_matcher,
        cache=cache,
    )
    record = sample_record()

    # 1. First evaluation: cache miss -> calls matcher, stores in cache
    eval1 = evaluator.evaluate(record)
    assert spy_matcher.call_count == 1
    assert eval1.status == AllergenAssessmentStatus.COMPLETED

    # 2. Second evaluation on same record & reference version: cache hit -> matcher NOT called
    eval2 = evaluator.evaluate(record)
    assert spy_matcher.call_count == 1  # Not incremented!
    assert eval2 == eval1


def test_evaluator_rejects_and_replaces_incomplete_parseable_cache_payload() -> None:
    import fakeredis
    from test_allergen_assessments import (
        StubAllergenReferenceDataAccess,
        sample_reference_data,
    )

    from lifegoods.package_matches.assessments import StandardAllergenAssessmentEvaluator

    ref_data = sample_reference_data()
    spy_matcher = SpyMatcher()
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(redis_client)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubAllergenReferenceDataAccess(ref_data),
        matcher=spy_matcher,
        cache=cache,
    )
    record = sample_record()
    expected = evaluator.evaluate(record)
    key = cast(str, next(iter(redis_client.scan_iter("assessment:eval:*"))))
    payload = json.loads(cast(str, redis_client.get(key)))
    del payload["concepts"][0]["finding_ids"]
    redis_client.set(key, json.dumps(payload))

    actual = evaluator.evaluate(record)

    assert spy_matcher.call_count == 2
    assert actual == expected
    replaced = json.loads(cast(str, redis_client.get(key)))
    assert replaced["concepts"][0]["finding_ids"] == []


def test_evaluator_rejects_and_replaces_incoherent_cached_concept_outcome() -> None:
    import fakeredis
    from test_allergen_assessments import (
        StubAllergenReferenceDataAccess,
        sample_reference_data,
    )

    from lifegoods.package_matches.assessments import StandardAllergenAssessmentEvaluator

    ref_data = sample_reference_data()
    spy_matcher = SpyMatcher()
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(redis_client)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubAllergenReferenceDataAccess(ref_data),
        matcher=spy_matcher,
        cache=cache,
    )
    record = sample_record()
    expected = evaluator.evaluate(record)
    key = cast(str, next(iter(redis_client.scan_iter("assessment:eval:*"))))
    payload = json.loads(cast(str, redis_client.get(key)))
    payload["concepts"][0]["name"] = "Stale concept name"
    redis_client.set(key, json.dumps(payload))

    actual = evaluator.evaluate(record)

    assert spy_matcher.call_count == 2
    assert actual == expected
    replaced = json.loads(cast(str, redis_client.get(key)))
    assert replaced["concepts"][0]["name"] == expected.concepts[0].name


def test_evaluator_does_not_accept_cached_assessment_failed_state() -> None:
    import fakeredis
    from test_allergen_assessments import (
        StubAllergenReferenceDataAccess,
        sample_reference_data,
    )

    from lifegoods.package_matches.assessments import StandardAllergenAssessmentEvaluator

    spy_matcher = SpyMatcher()
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=StubAllergenReferenceDataAccess(sample_reference_data()),
        matcher=spy_matcher,
        cache=RedisAllergenAssessmentCache(redis_client),
    )
    record = sample_record()
    expected = evaluator.evaluate(record)
    key = cast(str, next(iter(redis_client.scan_iter("assessment:eval:*"))))
    payload = json.loads(cast(str, redis_client.get(key)))
    payload.update(
        status="NOT_ASSESSED",
        reason="ASSESSMENT_FAILED",
        evidence_coverage="NOT_ASSESSED",
        concepts=[],
        findings=[],
    )
    redis_client.set(key, json.dumps(payload))

    actual = evaluator.evaluate(record)

    assert spy_matcher.call_count == 2
    assert actual == expected


def test_evaluator_cache_miss_on_changed_reference_version() -> None:
    from dataclasses import replace

    import fakeredis
    from test_allergen_assessments import (
        StubAllergenReferenceDataAccess,
        sample_reference_data,
    )

    from lifegoods.package_matches.assessments import StandardAllergenAssessmentEvaluator

    ref_data_v1 = sample_reference_data()
    access = StubAllergenReferenceDataAccess(ref_data_v1)
    spy_matcher = SpyMatcher()
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(redis_client)

    evaluator = StandardAllergenAssessmentEvaluator(
        enabled=True,
        engine_version="0.1.0",
        reference_data=access,
        matcher=spy_matcher,
        cache=cache,
    )
    record = sample_record()

    # First eval on v1
    evaluator.evaluate(record)
    assert spy_matcher.call_count == 1

    # Switch to reference version v2
    ref_data_v2 = replace(
        ref_data_v1,
        version=replace(ref_data_v1.version, id="codex-food-allergen-2026-v2"),
    )
    access._data = ref_data_v2

    # Second eval on v2 -> cache miss because reference dataset version in key changed
    evaluator.evaluate(record)
    assert spy_matcher.call_count == 2


def test_package_matches_api_caches_allergen_evaluations_end_to_end() -> None:
    from pathlib import Path

    import fakeredis
    import mongomock
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from lifegoods.core.database import Base
    from lifegoods.core.settings import Settings
    from lifegoods.main import create_app
    from lifegoods.open_food_facts import (
        ACTIVE_POINTER_ID,
        CONTROL_COLLECTION,
        VERSIONS_COLLECTION,
        OpenFoodFactsDatasetSource,
    )
    from lifegoods.reference_datasets.bundle import ReferenceBundle
    from lifegoods.reference_datasets.importer import import_reference_bundle
    from lifegoods.reference_datasets.lifecycle import activate_reference_dataset_version

    codex_bundle_path = (
        Path(__file__).parents[1]
        / "src"
        / "lifegoods"
        / "reference_datasets"
        / "bundles"
        / "codex_2026_food_allergen_minimal.json"
    )

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, expire_on_commit=False)

    bundle = ReferenceBundle.from_json_file(codex_bundle_path)
    with session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(session, bundle.manifest.id)

    database = mongomock.MongoClient().lifegoods_off
    collection_name = "off_products_dataset_2026_08_27"
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": DATASET_VERSION.id,
            "collection_name": collection_name,
            "source_url": DATASET_VERSION.source_url,
            "retrieval_completed_at": DATASET_VERSION.retrieved_at,
            "activated_at": DATASET_VERSION.activated_at,
            "sha256": DATASET_VERSION.sha256,
            "status": "ACTIVE",
        }
    )
    database[CONTROL_COLLECTION].insert_one(
        {"_id": ACTIVE_POINTER_ID, "active_version_id": DATASET_VERSION.id}
    )
    database[collection_name].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark chocolate",
            "ingredients_text_en": "Cocoa mass, sugar, cocoa butter, milk powder",
            "allergens": "Contains milk",
            "allergens_tags": ["en:milk"],
            "traces": "May contain nuts",
            "traces_tags": ["en:nuts"],
            "last_modified_t": 1787462400,
        }
    )

    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    cache = RedisAllergenAssessmentCache(fake_redis)

    app = create_app(
        settings=Settings(allergen_assessments_enabled=True),
        session_factory=session_factory,
        external_source=OpenFoodFactsDatasetSource(database),
        assessment_cache=cache,
    )

    with TestClient(app) as client:
        # First request: computes and caches
        res1 = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})
        assert res1.status_code == 200
        body1 = res1.json()
        assert len(body1["candidates"]) == 1
        assessment1 = body1["candidates"][0]["allergen_assessment"]
        assert assessment1["status"] == "COMPLETED"
        assert assessment1["concepts"][0]["outcome"] == "DERIVED_FROM_INGREDIENT"

        # Verify Redis has the cache key populated with 7-day TTL
        keys = list(cast(list[str], fake_redis.keys("assessment:eval:*")))
        assert len(keys) == 1
        cached_key = keys[0]
        assert cached_key.startswith(
            "assessment:eval:v2:dataset-2026-08-27:4006381333931:1787462400:"
        )
        assert cached_key.endswith(":0.1.0")
        assert fake_redis.exists(cached_key) == 1
        ttl = int(cast(Any, fake_redis.ttl(cached_key)))
        assert 604700 <= ttl <= DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS

        # Second request: hits cache
        res2 = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})
        assert res2.status_code == 200
        body2 = res2.json()
        assert body2 == body1


def test_package_matches_api_bypasses_redis_outage_gracefully() -> None:
    from pathlib import Path

    import mongomock
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from lifegoods.core.database import Base
    from lifegoods.core.settings import Settings
    from lifegoods.main import create_app
    from lifegoods.open_food_facts import (
        ACTIVE_POINTER_ID,
        CONTROL_COLLECTION,
        VERSIONS_COLLECTION,
        OpenFoodFactsDatasetSource,
    )
    from lifegoods.reference_datasets.bundle import ReferenceBundle
    from lifegoods.reference_datasets.importer import import_reference_bundle
    from lifegoods.reference_datasets.lifecycle import activate_reference_dataset_version

    codex_bundle_path = (
        Path(__file__).parents[1]
        / "src"
        / "lifegoods"
        / "reference_datasets"
        / "bundles"
        / "codex_2026_food_allergen_minimal.json"
    )

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, expire_on_commit=False)

    bundle = ReferenceBundle.from_json_file(codex_bundle_path)
    with session_factory() as session:
        import_reference_bundle(session, bundle)
        activate_reference_dataset_version(session, bundle.manifest.id)

    database = mongomock.MongoClient().lifegoods_off
    collection_name = "off_products_dataset_2026_08_27"
    database[VERSIONS_COLLECTION].insert_one(
        {
            "_id": DATASET_VERSION.id,
            "collection_name": collection_name,
            "source_url": DATASET_VERSION.source_url,
            "retrieval_completed_at": DATASET_VERSION.retrieved_at,
            "activated_at": DATASET_VERSION.activated_at,
            "sha256": DATASET_VERSION.sha256,
            "status": "ACTIVE",
        }
    )
    database[CONTROL_COLLECTION].insert_one(
        {"_id": ACTIVE_POINTER_ID, "active_version_id": DATASET_VERSION.id}
    )
    database[collection_name].insert_one(
        {
            "code": "4006381333931",
            "product_name_en": "Dark chocolate",
            "ingredients_text_en": "Cocoa mass, sugar, cocoa butter, milk powder",
            "last_modified_t": 1787462400,
        }
    )

    # Point to an unreachable Redis port with short timeout
    settings = Settings(
        allergen_assessments_enabled=True,
        redis_url="redis://127.0.0.1:59999/0",
        redis_timeout_seconds=0.1,
    )

    app = create_app(
        settings=settings,
        session_factory=session_factory,
        external_source=OpenFoodFactsDatasetSource(database),
    )

    with TestClient(app) as client:
        # Request should not fail with 503 or 500, but succeed with 200 and complete evaluation
        res = client.get("/api/v1/package-matches", params={"identifier": "4006381333931"})
        assert res.status_code == 200
        body = res.json()
        assessment = body["candidates"][0]["allergen_assessment"]
        assert assessment["status"] == "COMPLETED"
        assert assessment["concepts"][0]["outcome"] == "DERIVED_FROM_INGREDIENT"


def test_assessment_cache_disabled_via_settings() -> None:
    from lifegoods.core.settings import Settings
    from lifegoods.main import create_app

    settings = Settings(assessment_cache_enabled=False)
    app = create_app(settings=settings)
    assert app is not None


def test_absence_of_durable_storage_for_assessment_evaluations() -> None:
    from lifegoods.core.database import Base

    # Confirm metadata has no AssessmentRun, EvaluationRun, or evaluation history tables
    table_names = list(Base.metadata.tables.keys())
    assert not any("assessment_run" in t.lower() for t in table_names)
    assert not any("evaluation_run" in t.lower() for t in table_names)
    assert not any("assessment_history" in t.lower() for t in table_names)
