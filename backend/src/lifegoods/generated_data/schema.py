from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pymongo.database import Database

TRANSLATION_ARTIFACTS_COLLECTION = "translation_artifacts"
TRANSLATION_LEASES_COLLECTION = "translation_leases"
TRANSLATION_COOLDOWNS_COLLECTION = "translation_cooldowns"
TRANSLATION_QUARANTINES_COLLECTION = "translation_quarantines"

ALL_GENERATED_DATA_COLLECTIONS: tuple[str, ...] = (
    TRANSLATION_ARTIFACTS_COLLECTION,
    TRANSLATION_LEASES_COLLECTION,
    TRANSLATION_COOLDOWNS_COLLECTION,
    TRANSLATION_QUARANTINES_COLLECTION,
)


class IncompatibleIndexError(Exception):
    """Raised when an existing MongoDB index conflicts with required schema definitions."""


def _normalize_keys(raw_keys: object) -> tuple[tuple[str, int], ...]:
    if not isinstance(raw_keys, (list, tuple)):
        return ()
    normalized: list[tuple[str, int]] = []
    for item in raw_keys:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            normalized.append((str(item[0]), int(item[1])))
    return tuple(normalized)


@dataclass(frozen=True)
class IndexSpec:
    name: str
    keys: tuple[tuple[str, int], ...]
    unique: bool = False
    expire_after_seconds: int | None = None

    def validate_against(
        self, collection_name: str, index_name: str, info: dict[str, Any]
    ) -> None:
        actual_keys = _normalize_keys(info.get("key"))
        if actual_keys != self.keys:
            raise IncompatibleIndexError(
                f"Index '{index_name}' on collection '{collection_name}' exists with incompatible "
                f"key specification: expected {self.keys}, found {actual_keys}"
            )

        actual_unique = bool(info.get("unique", False))
        if actual_unique != self.unique:
            raise IncompatibleIndexError(
                f"Index '{index_name}' on collection '{collection_name}' exists with incompatible "
                f"uniqueness: expected unique={self.unique}, found unique={actual_unique}"
            )

        actual_ttl = info.get("expireAfterSeconds")
        if actual_ttl != self.expire_after_seconds:
            raise IncompatibleIndexError(
                f"Index '{index_name}' on collection '{collection_name}' exists with incompatible "
                f"TTL: expected expireAfterSeconds={self.expire_after_seconds}, "
                f"found expireAfterSeconds={actual_ttl}"
            )


@dataclass(frozen=True)
class CollectionSpec:
    name: str
    indexes: tuple[IndexSpec, ...]
    allow_ttl: bool = False

    def validate_index_compatibility(
        self,
        index_name: str,
        info: dict[str, Any],
    ) -> None:
        if not self.allow_ttl and "expireAfterSeconds" in info:
            raise IncompatibleIndexError(
                f"Collection '{self.name}' has index '{index_name}' with "
                f"expireAfterSeconds={info['expireAfterSeconds']}, but translation "
                "artifacts and quarantines must not have automatic TTL"
            )

        expected_spec = next((idx for idx in self.indexes if idx.name == index_name), None)
        if expected_spec is None:
            raw_keys = _normalize_keys(info.get("key"))
            expected_spec = next((idx for idx in self.indexes if idx.keys == raw_keys), None)

        if expected_spec is None:
            if "expireAfterSeconds" in info:
                raise IncompatibleIndexError(
                    f"Collection '{self.name}' has unexpected TTL index '{index_name}' "
                    f"with expireAfterSeconds={info['expireAfterSeconds']}"
                )
            return

        expected_spec.validate_against(self.name, index_name, info)


GENERATED_DATA_SPECS: tuple[CollectionSpec, ...] = (
    CollectionSpec(
        name=TRANSLATION_ARTIFACTS_COLLECTION,
        allow_ttl=False,
        indexes=(
            IndexSpec(
                name="uq_translation_artifacts_content_config",
                keys=(("content_hash", 1), ("translation_config_fingerprint", 1)),
                unique=True,
            ),
            IndexSpec(
                name="uq_translation_artifacts_artifact_id",
                keys=(("artifact_id", 1),),
                unique=True,
            ),
            IndexSpec(
                name="idx_translation_artifacts_created_at",
                keys=(("created_at", 1),),
                unique=False,
            ),
            IndexSpec(
                name="idx_translation_artifacts_config_fingerprint",
                keys=(("translation_config_fingerprint", 1),),
                unique=False,
            ),
        ),
    ),
    CollectionSpec(
        name=TRANSLATION_LEASES_COLLECTION,
        allow_ttl=True,
        indexes=(
            IndexSpec(
                name="uq_translation_leases_content_config",
                keys=(("content_hash", 1), ("translation_config_fingerprint", 1)),
                unique=True,
            ),
            IndexSpec(
                name="ttl_translation_leases_expires_at",
                keys=(("expires_at", 1),),
                expire_after_seconds=0,
            ),
        ),
    ),
    CollectionSpec(
        name=TRANSLATION_COOLDOWNS_COLLECTION,
        allow_ttl=True,
        indexes=(
            IndexSpec(
                name="uq_translation_cooldowns_content_config",
                keys=(("content_hash", 1), ("translation_config_fingerprint", 1)),
                unique=True,
            ),
            IndexSpec(
                name="ttl_translation_cooldowns_expires_at",
                keys=(("expires_at", 1),),
                expire_after_seconds=0,
            ),
        ),
    ),
    CollectionSpec(
        name=TRANSLATION_QUARANTINES_COLLECTION,
        allow_ttl=False,
        indexes=(
            IndexSpec(
                name="uq_translation_quarantines_content_config",
                keys=(("content_hash", 1), ("translation_config_fingerprint", 1)),
                unique=True,
            ),
            IndexSpec(
                name="idx_translation_quarantines_quarantined_at",
                keys=(("quarantined_at", 1),),
                unique=False,
            ),
        ),
    ),
)


def verify_generated_data_schema(
    database: Database[dict[str, Any]],
) -> dict[str, Any]:
    existing_collections = set(database.list_collection_names())
    verified_collections: list[dict[str, Any]] = []

    for spec in GENERATED_DATA_SPECS:
        if spec.name not in existing_collections:
            raise IncompatibleIndexError(f"Missing required collection '{spec.name}'")

        collection = database[spec.name]
        index_info = collection.index_information()

        for idx_name, info in index_info.items():
            if idx_name == "_id_":
                continue
            spec.validate_index_compatibility(idx_name, info)

        for expected_idx in spec.indexes:
            if expected_idx.name not in index_info:
                raise IncompatibleIndexError(
                    f"Missing required index '{expected_idx.name}' on collection '{spec.name}'"
                )

        verified_collections.append(
            {
                "collection": spec.name,
                "indexes": sorted(index_info.keys()),
            }
        )

    return {
        "status": "VERIFIED",
        "collections": verified_collections,
    }


def ensure_generated_data_schema(
    database: Database[dict[str, Any]],
) -> dict[str, Any]:
    existing_collections = set(database.list_collection_names())
    initialized_collections: list[dict[str, Any]] = []

    for spec in GENERATED_DATA_SPECS:
        if spec.name not in existing_collections:
            database.create_collection(spec.name)

        collection = database[spec.name]
        index_info = collection.index_information()

        for idx_name, info in index_info.items():
            if idx_name == "_id_":
                continue
            spec.validate_index_compatibility(idx_name, info)

        for expected_idx in spec.indexes:
            if expected_idx.name not in index_info:
                kwargs: dict[str, Any] = {"name": expected_idx.name}
                if expected_idx.unique:
                    kwargs["unique"] = True
                if expected_idx.expire_after_seconds is not None:
                    kwargs["expireAfterSeconds"] = expected_idx.expire_after_seconds
                collection.create_index(list(expected_idx.keys), **kwargs)

        initialized_collections.append(
            {
                "collection": spec.name,
                "indexes": sorted(collection.index_information().keys()),
            }
        )

    verify_generated_data_schema(database)

    return {
        "status": "INITIALIZED",
        "collections": initialized_collections,
    }
