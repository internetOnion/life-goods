from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from pymongo import MongoClient
from pymongo.errors import OperationFailure

from lifegoods.core.settings import Settings
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

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def settings() -> Settings:
    return Settings()


@pytest.fixture(scope="module")
def reader_client(settings: Settings) -> Iterator[MongoClient[dict[str, Any]]]:
    client: MongoClient[dict[str, Any]] = MongoClient(
        settings.off_mongodb_uri,
        serverSelectionTimeoutMS=settings.off_mongodb_timeout_ms,
    )
    yield client
    client.close()


@pytest.fixture(scope="module")
def generated_client(settings: Settings) -> Iterator[MongoClient[dict[str, Any]]]:
    client: MongoClient[dict[str, Any]] = MongoClient(
        settings.generated_mongodb_uri,
        serverSelectionTimeoutMS=settings.generated_mongodb_timeout_ms,
    )
    yield client
    client.close()


def test_reader_identity_cannot_write_to_off_database(
    reader_client: MongoClient[dict[str, Any]], settings: Settings
) -> None:
    off_database = reader_client[settings.off_mongodb_database]

    with pytest.raises(OperationFailure, match="not authorized"):
        off_database["test_write_probe"].insert_one({"probe": "unauthorized"})


def test_reader_identity_cannot_access_generated_database(
    reader_client: MongoClient[dict[str, Any]], settings: Settings
) -> None:
    generated_database = reader_client[settings.generated_mongodb_database]

    with pytest.raises(OperationFailure, match="not authorized"):
        generated_database[TRANSLATION_ARTIFACTS_COLLECTION].insert_one(
            {"probe": "unauthorized"}
        )

    with pytest.raises(OperationFailure, match="not authorized"):
        list(generated_database[TRANSLATION_ARTIFACTS_COLLECTION].find({}))


def test_generated_identity_cannot_access_off_database(
    generated_client: MongoClient[dict[str, Any]], settings: Settings
) -> None:
    off_database = generated_client[settings.off_mongodb_database]

    with pytest.raises(OperationFailure, match="not authorized"):
        list(off_database["off_dataset_versions"].find({}))

    with pytest.raises(OperationFailure, match="not authorized"):
        off_database["test_write_probe"].insert_one({"probe": "unauthorized"})


def test_generated_identity_can_read_and_write_generated_database(
    generated_client: MongoClient[dict[str, Any]], settings: Settings
) -> None:
    generated_database = generated_client[settings.generated_mongodb_database]

    probe_doc = {"_id": "permission_probe", "status": "ok"}
    try:
        result = generated_database["permission_probe"].insert_one(probe_doc)
        assert result.inserted_id == "permission_probe"

        retrieved = generated_database["permission_probe"].find_one(
            {"_id": "permission_probe"}
        )
        assert retrieved is not None
        assert retrieved["status"] == "ok"
    finally:
        generated_database["permission_probe"].delete_one({"_id": "permission_probe"})


def test_idempotent_initialization_and_verification_on_real_mongodb(
    generated_client: MongoClient[dict[str, Any]], settings: Settings
) -> None:
    generated_database = generated_client[settings.generated_mongodb_database]

    first_init = ensure_generated_data_schema(generated_database)
    assert first_init["status"] == "INITIALIZED"

    second_init = ensure_generated_data_schema(generated_database)
    assert second_init["status"] == "INITIALIZED"

    verification = verify_generated_data_schema(generated_database)
    assert verification["status"] == "VERIFIED"

    existing_collections = set(generated_database.list_collection_names())
    assert set(ALL_GENERATED_DATA_COLLECTIONS).issubset(existing_collections)


def test_ttl_and_uniqueness_on_real_mongodb(
    generated_client: MongoClient[dict[str, Any]], settings: Settings
) -> None:
    generated_database = generated_client[settings.generated_mongodb_database]
    ensure_generated_data_schema(generated_database)

    # Translation artifacts: unique index, NO TTL
    artifact_indexes = generated_database[TRANSLATION_ARTIFACTS_COLLECTION].index_information()
    assert "uq_translation_artifacts_content_config" in artifact_indexes
    assert artifact_indexes["uq_translation_artifacts_content_config"]["unique"] is True
    assert "uq_translation_artifacts_artifact_id" in artifact_indexes
    assert artifact_indexes["uq_translation_artifacts_artifact_id"]["unique"] is True
    for idx in artifact_indexes.values():
        assert "expireAfterSeconds" not in idx

    # Translation leases: unique index and active TTL (0s expiry)
    lease_indexes = generated_database[TRANSLATION_LEASES_COLLECTION].index_information()
    assert "ttl_translation_leases_expires_at" in lease_indexes
    assert lease_indexes["ttl_translation_leases_expires_at"]["expireAfterSeconds"] == 0
    assert lease_indexes["uq_translation_leases_content_config"]["unique"] is True

    # Translation cooldowns: unique index and active TTL (0s expiry)
    cooldown_indexes = generated_database[TRANSLATION_COOLDOWNS_COLLECTION].index_information()
    assert "ttl_translation_cooldowns_expires_at" in cooldown_indexes
    assert cooldown_indexes["ttl_translation_cooldowns_expires_at"]["expireAfterSeconds"] == 0
    assert cooldown_indexes["uq_translation_cooldowns_content_config"]["unique"] is True

    # Translation quarantines: unique index, NO TTL
    quarantine_indexes = generated_database[TRANSLATION_QUARANTINES_COLLECTION].index_information()
    assert "uq_translation_quarantines_content_config" in quarantine_indexes
    assert quarantine_indexes["uq_translation_quarantines_content_config"]["unique"] is True
    for idx in quarantine_indexes.values():
        assert "expireAfterSeconds" not in idx


def test_incompatible_indexes_fail_on_real_mongodb(
    generated_client: MongoClient[dict[str, Any]], settings: Settings
) -> None:
    generated_database = generated_client[settings.generated_mongodb_database]
    ensure_generated_data_schema(generated_database)

    # Replace idx_translation_artifacts_created_at with an incompatible TTL version
    artifacts_collection = generated_database[TRANSLATION_ARTIFACTS_COLLECTION]
    artifacts_collection.drop_index("idx_translation_artifacts_created_at")
    artifacts_collection.create_index(
        [("created_at", 1)],
        expireAfterSeconds=3600,
        name="idx_translation_artifacts_created_at",
    )
    try:
        with pytest.raises(IncompatibleIndexError, match="must not have automatic TTL"):
            verify_generated_data_schema(generated_database)

        with pytest.raises(IncompatibleIndexError, match="must not have automatic TTL"):
            ensure_generated_data_schema(generated_database)
    finally:
        artifacts_collection.drop_index("idx_translation_artifacts_created_at")

    # After dropping the incompatible index, ensure re-creates the proper index
    # and verification passes.
    assert ensure_generated_data_schema(generated_database)["status"] == "INITIALIZED"
    assert verify_generated_data_schema(generated_database)["status"] == "VERIFIED"
