from __future__ import annotations

import mongomock
import pytest

from lifegoods.generated_data import (
    ALL_GENERATED_DATA_COLLECTIONS,
    TRANSLATION_ARTIFACTS_COLLECTION,
    TRANSLATION_COOLDOWNS_COLLECTION,
    TRANSLATION_LEASES_COLLECTION,
    TRANSLATION_QUARANTINES_COLLECTION,
    IncompatibleIndexError,
    ensure_generated_data_schema,
    verify_generated_data_schema,
)


def test_ensure_schema_creates_all_collections_and_indexes() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    report = ensure_generated_data_schema(database)

    assert set(database.list_collection_names()) >= set(ALL_GENERATED_DATA_COLLECTIONS)
    assert report["status"] == "INITIALIZED"

    # Artifacts: unique compound content_config, unique artifact_id, no TTL
    artifact_indexes = database[TRANSLATION_ARTIFACTS_COLLECTION].index_information()
    assert "uq_translation_artifacts_content_config" in artifact_indexes
    assert artifact_indexes["uq_translation_artifacts_content_config"]["unique"] is True
    assert artifact_indexes["uq_translation_artifacts_content_config"]["key"] == [
        ("content_hash", 1),
        ("translation_config_fingerprint", 1),
    ]
    assert "uq_translation_artifacts_artifact_id" in artifact_indexes
    assert artifact_indexes["uq_translation_artifacts_artifact_id"]["unique"] is True
    assert "expireAfterSeconds" not in artifact_indexes["uq_translation_artifacts_content_config"]

    # Leases: unique compound content_config, unique artifact_id, expiring TTL
    lease_indexes = database[TRANSLATION_LEASES_COLLECTION].index_information()
    assert "ttl_translation_leases_expires_at" in lease_indexes
    assert lease_indexes["ttl_translation_leases_expires_at"]["expireAfterSeconds"] == 0
    assert lease_indexes["ttl_translation_leases_expires_at"]["key"] == [("expires_at", 1)]
    assert lease_indexes["uq_translation_leases_content_config"]["unique"] is True

    # Cooldowns: unique compound content_config, unique artifact_id, expiring TTL
    cooldown_indexes = database[TRANSLATION_COOLDOWNS_COLLECTION].index_information()
    assert "ttl_translation_cooldowns_expires_at" in cooldown_indexes
    assert cooldown_indexes["ttl_translation_cooldowns_expires_at"]["expireAfterSeconds"] == 0
    assert cooldown_indexes["ttl_translation_cooldowns_expires_at"]["key"] == [("expires_at", 1)]

    # Quarantines: unique compound content_config, unique artifact_id, quarantined_at, no TTL
    quarantine_indexes = database[TRANSLATION_QUARANTINES_COLLECTION].index_information()
    assert "uq_translation_quarantines_content_config" in quarantine_indexes
    assert quarantine_indexes["uq_translation_quarantines_content_config"]["unique"] is True
    assert "idx_translation_quarantines_quarantined_at" in quarantine_indexes
    for idx in quarantine_indexes.values():
        assert "expireAfterSeconds" not in idx


def test_ensure_schema_is_idempotent() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    first_report = ensure_generated_data_schema(database)
    second_report = ensure_generated_data_schema(database)

    assert first_report["status"] == "INITIALIZED"
    assert second_report["status"] == "INITIALIZED"
    assert verify_generated_data_schema(database)["status"] == "VERIFIED"


def test_verify_schema_succeeds_after_ensure() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    ensure_generated_data_schema(database)
    verification = verify_generated_data_schema(database)

    assert verification["status"] == "VERIFIED"
    assert len(verification["collections"]) == len(ALL_GENERATED_DATA_COLLECTIONS)


def test_verify_schema_fails_when_collection_missing() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    ensure_generated_data_schema(database)
    database.drop_collection(TRANSLATION_ARTIFACTS_COLLECTION)

    with pytest.raises(IncompatibleIndexError, match="Missing required collection"):
        verify_generated_data_schema(database)


def test_rejects_incompatible_ttl_on_leases() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    collection = database[TRANSLATION_LEASES_COLLECTION]
    collection.create_index(
        [("expires_at", 1)],
        expireAfterSeconds=3600,
        name="ttl_translation_leases_expires_at",
    )

    with pytest.raises(IncompatibleIndexError, match="expireAfterSeconds=0"):
        ensure_generated_data_schema(database)


def test_rejects_disallowed_ttl_on_artifacts() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    collection = database[TRANSLATION_ARTIFACTS_COLLECTION]
    collection.create_index(
        [("created_at", 1)],
        expireAfterSeconds=86400,
        name="ttl_translation_artifacts_bad",
    )

    with pytest.raises(IncompatibleIndexError, match="must not have automatic TTL"):
        ensure_generated_data_schema(database)


def test_rejects_incompatible_uniqueness_on_artifacts() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    collection = database[TRANSLATION_ARTIFACTS_COLLECTION]
    collection.create_index(
        [("content_hash", 1), ("translation_config_fingerprint", 1)],
        unique=False,
        name="uq_translation_artifacts_content_config",
    )

    with pytest.raises(IncompatibleIndexError, match="unique=True"):
        ensure_generated_data_schema(database)


def test_rejects_incompatible_key_specification() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    collection = database[TRANSLATION_ARTIFACTS_COLLECTION]
    collection.create_index(
        [("translation_config_fingerprint", 1), ("content_hash", 1)],
        unique=True,
        name="uq_translation_artifacts_content_config",
    )

    with pytest.raises(IncompatibleIndexError, match="key specification"):
        ensure_generated_data_schema(database)


def test_rejects_unexpected_ttl_index_on_leases() -> None:
    database = mongomock.MongoClient().lifegoods_generated
    collection = database[TRANSLATION_LEASES_COLLECTION]
    collection.create_index(
        [("created_at", 1)],
        expireAfterSeconds=60,
        name="ttl_bad_leases_created_at",
    )

    with pytest.raises(IncompatibleIndexError, match="unexpected TTL index"):
        ensure_generated_data_schema(database)


def test_web_startup_does_not_create_collections_or_indexes_implicitly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from lifegoods.main import create_app

    mock_client = mongomock.MongoClient()
    monkeypatch.setattr("lifegoods.main.MongoClient", lambda *args, **kwargs: mock_client)

    app = create_app()
    assert app is not None
    assert mock_client.lifegoods_generated.list_collection_names() == []

