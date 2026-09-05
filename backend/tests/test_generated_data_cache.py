from __future__ import annotations

from datetime import UTC, datetime

from redis.exceptions import RedisError

from lifegoods.generated_data.cache import (
    InMemoryTranslationHotCache,
    NullTranslationHotCache,
    RedisTranslationHotCache,
    translation_cache_key,
)
from lifegoods.generated_data.repository import StoredTranslationArtifact


def _make_artifact(content_hash: str = "c1", config_fp: str = "cfg1") -> StoredTranslationArtifact:
    return StoredTranslationArtifact(
        artifact_id=f"{content_hash}:{config_fp}",
        content_hash=content_hash,
        translation_config_fingerprint=config_fp,
        overall_status="complete",
        fields={
            "product_name": {
                "field_name": "product_name",
                "status": "generated",
                "khmer_translation": "តែ",
                "failure_reason": None,
            }
        },
        raw_input={"product_name": "Tea"},
        masked_input={"product_name": "Tea"},
        token_maps={"product_name": {}},
        provenance={
            "machine_generated": True,
            "provider": "google",
            "model": "gemini-3.8-flash",
            "configuration_version": "v1",
            "generated_at": "2026-09-05T00:00:00Z",
        },
        created_at=datetime(2026, 9, 5, 0, 0, 0, tzinfo=UTC),
    )


def test_cache_key_contains_no_barcode_or_shopper_id() -> None:
    key = translation_cache_key("hash_abc", "cfg_xyz")
    assert "barcode" not in key.lower()
    assert "shopper" not in key.lower()
    assert key == "translation:artifact:v1:hash_abc:cfg_xyz"


def test_in_memory_cache_lifecycle() -> None:
    clock = [100.0]
    cache = InMemoryTranslationHotCache(ttl_seconds=10, monotonic=lambda: clock[0])
    artifact = _make_artifact()

    assert cache.get(artifact.content_hash, artifact.translation_config_fingerprint) is None

    cache.put(artifact)
    retrieved = cache.get(artifact.content_hash, artifact.translation_config_fingerprint)
    assert retrieved is not None
    assert retrieved.content_hash == "c1"
    assert retrieved.fields["product_name"]["khmer_translation"] == "តែ"

    # Advance beyond TTL
    clock[0] = 111.0
    assert cache.get(artifact.content_hash, artifact.translation_config_fingerprint) is None


def test_in_memory_cache_delete() -> None:
    cache = InMemoryTranslationHotCache(ttl_seconds=100)
    artifact = _make_artifact()
    cache.put(artifact)
    assert cache.get(artifact.content_hash, artifact.translation_config_fingerprint) is not None

    cache.delete(artifact.content_hash, artifact.translation_config_fingerprint)
    assert cache.get(artifact.content_hash, artifact.translation_config_fingerprint) is None


def test_null_cache_is_noop() -> None:
    cache = NullTranslationHotCache()
    artifact = _make_artifact()
    cache.put(artifact)
    assert cache.get(artifact.content_hash, artifact.translation_config_fingerprint) is None
    cache.delete(artifact.content_hash, artifact.translation_config_fingerprint)


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.should_raise: bool = False

    def get(self, name: str) -> str | None:
        if self.should_raise:
            raise RedisError("Redis connection broken")
        return self.store.get(name)

    def set(self, name: str, value: str, ex: int | None = None) -> None:
        if self.should_raise:
            raise RedisError("Redis connection broken")
        self.store[name] = value

    def delete(self, name: str) -> None:
        if self.should_raise:
            raise RedisError("Redis connection broken")
        self.store.pop(name, None)


def test_redis_cache_serialization_and_deserialization() -> None:
    fake_redis = FakeRedis()
    cache = RedisTranslationHotCache(fake_redis, ttl_seconds=3600)  # type: ignore[arg-type]
    artifact = _make_artifact()

    assert cache.get("c1", "cfg1") is None
    cache.put(artifact)

    # Check key and stored string has no barcode or shopper id
    key = translation_cache_key("c1", "cfg1")
    assert key in fake_redis.store
    stored_str = fake_redis.store[key]
    assert "barcode" not in stored_str.lower()
    assert "shopper" not in stored_str.lower()

    # Deserializes cleanly
    retrieved = cache.get("c1", "cfg1")
    assert retrieved is not None
    assert retrieved.artifact_id == artifact.artifact_id
    assert retrieved.content_hash == "c1"
    assert retrieved.translation_config_fingerprint == "cfg1"
    assert retrieved.fields["product_name"]["khmer_translation"] == "តែ"
    assert retrieved.provenance["model"] == "gemini-3.8-flash"
    assert retrieved.created_at == artifact.created_at


def test_redis_cache_falls_through_on_error() -> None:
    fake_redis = FakeRedis()
    cache = RedisTranslationHotCache(fake_redis, ttl_seconds=3600)  # type: ignore[arg-type]
    artifact = _make_artifact()
    cache.put(artifact)

    fake_redis.should_raise = True

    # Reads fail open to None (fall through to MongoDB)
    assert cache.get("c1", "cfg1") is None

    # Writes fail open silently
    cache.put(artifact)
    cache.delete("c1", "cfg1")
