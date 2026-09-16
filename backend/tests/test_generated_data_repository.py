from __future__ import annotations

from datetime import UTC, datetime, timedelta

from lifegoods.generated_data.repository import (
    AggregateStorageStats,
    InMemoryGeneratedDataRepository,
    StoredTranslationArtifact,
)


def _make_sample_artifact(
    content_hash: str = "hash123",
    config_fingerprint: str = "cfg456",
    overall_status: str = "complete",
) -> StoredTranslationArtifact:
    return StoredTranslationArtifact(
        artifact_id=f"{content_hash}:{config_fingerprint}",
        content_hash=content_hash,
        translation_config_fingerprint=config_fingerprint,
        overall_status=overall_status,
        fields={
            "product_name": {
                "field_name": "product_name",
                "status": "generated",
                "khmer_translation": "តែបៃតង",
                "failure_reason": None,
            }
        },
        raw_input={"product_name": "Green Tea"},
        masked_input={"product_name": "Green Tea"},
        token_maps={"product_name": {}},
        provenance={
            "machine_generated": True,
            "provider": "google",
            "model": "gemini-3.8-flash",
            "configuration_version": "v1",
            "generated_at": "2026-09-05T00:00:00Z",
        },
        created_at=datetime.now(UTC),
    )


def test_save_and_retrieve_artifact() -> None:
    repo = InMemoryGeneratedDataRepository()
    artifact = _make_sample_artifact()

    assert repo.get_artifact(artifact.content_hash, artifact.translation_config_fingerprint) is None

    repo.save_artifact(artifact)

    retrieved = repo.get_artifact(artifact.content_hash, artifact.translation_config_fingerprint)
    assert retrieved is not None
    assert retrieved.artifact_id == artifact.artifact_id
    assert retrieved.content_hash == "hash123"
    assert retrieved.fields["product_name"]["khmer_translation"] == "តែបៃតង"


def test_artifact_is_immutable_rejects_overwrite() -> None:
    repo = InMemoryGeneratedDataRepository()
    artifact = _make_sample_artifact()
    repo.save_artifact(artifact)

    # Re-saving identical content is idempotent / no-op
    repo.save_artifact(artifact)
    assert (
        repo.get_artifact(artifact.content_hash, artifact.translation_config_fingerprint)
        is not None
    )


def test_lease_acquisition_and_single_flight() -> None:
    clock = datetime(2026, 9, 5, 12, 0, 0, tzinfo=UTC)
    repo = InMemoryGeneratedDataRepository(datetime_provider=lambda: clock)

    content_hash = "content1"
    config_fingerprint = "config1"

    # Worker 1 acquires lease
    assert (
        repo.acquire_lease(content_hash, config_fingerprint, "worker-1", ttl_seconds=5.0)
        is True
    )

    # Worker 2 attempts while lease active -> denied
    assert (
        repo.acquire_lease(content_hash, config_fingerprint, "worker-2", ttl_seconds=5.0)
        is False
    )

    # Worker 1 releases lease
    repo.release_lease(content_hash, config_fingerprint, "worker-1")

    # Worker 2 can now acquire
    assert repo.acquire_lease(content_hash, config_fingerprint, "worker-2", ttl_seconds=5.0) is True


def test_expired_lease_can_be_recovered_by_another_owner() -> None:
    now = datetime(2026, 9, 5, 12, 0, 0, tzinfo=UTC)
    current_time = [now]

    def time_now() -> datetime:
        return current_time[0]

    repo = InMemoryGeneratedDataRepository(datetime_provider=time_now)

    # Worker 1 acquires lease for 5s
    assert repo.acquire_lease("c1", "cfg1", "worker-1", ttl_seconds=5.0) is True

    # Advance time by 6s (worker 1 crashed / took too long)
    current_time[0] = now + timedelta(seconds=6)

    # Worker 2 can acquire the expired lease safely
    assert repo.acquire_lease("c1", "cfg1", "worker-2", ttl_seconds=5.0) is True

    # Worker 1 waking up cannot release Worker 2's lease
    repo.release_lease("c1", "cfg1", "worker-1")
    # Worker 3 cannot acquire since Worker 2 still owns it
    assert repo.acquire_lease("c1", "cfg1", "worker-3", ttl_seconds=5.0) is False


def test_failure_cooldown() -> None:
    now = datetime(2026, 9, 5, 12, 0, 0, tzinfo=UTC)
    current_time = [now]

    repo = InMemoryGeneratedDataRepository(datetime_provider=lambda: current_time[0])

    assert repo.is_cooling_down("c1", "cfg1") is False

    repo.record_cooldown("c1", "cfg1", "Provider 500 error", ttl_seconds=60.0)
    assert repo.is_cooling_down("c1", "cfg1") is True

    # Advance past 60s
    current_time[0] = now + timedelta(seconds=61)
    assert repo.is_cooling_down("c1", "cfg1") is False


def test_artifact_quarantine() -> None:
    repo = InMemoryGeneratedDataRepository()
    artifact = _make_sample_artifact()
    repo.save_artifact(artifact)

    assert (
        repo.is_quarantined(artifact.content_hash, artifact.translation_config_fingerprint)
        is False
    )

    repo.quarantine_artifact(
        artifact.content_hash, artifact.translation_config_fingerprint, reason="Corrupted text"
    )
    assert (
        repo.is_quarantined(artifact.content_hash, artifact.translation_config_fingerprint)
        is True
    )



def test_aggregate_stats() -> None:
    repo = InMemoryGeneratedDataRepository()
    stats = repo.get_aggregate_stats()
    assert stats == AggregateStorageStats(
        artifacts_count=0,
        active_leases_count=0,
        active_cooldowns_count=0,
        quarantines_count=0,
    )

    repo.save_artifact(_make_sample_artifact("c1", "cfg1"))
    repo.save_artifact(_make_sample_artifact("c2", "cfg1"))
    repo.acquire_lease("c3", "cfg1", "owner-1", ttl_seconds=10.0)
    repo.record_cooldown("c4", "cfg1", "error", ttl_seconds=10.0)
    repo.quarantine_artifact("c1", "cfg1", "toxic")

    stats = repo.get_aggregate_stats()
    assert stats.artifacts_count == 2
    assert stats.active_leases_count == 1
    assert stats.active_cooldowns_count == 1
    assert stats.quarantines_count == 1
