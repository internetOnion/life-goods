from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import Any, Protocol

from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, PyMongoError

from lifegoods.generated_data.schema import (
    TRANSLATION_ARTIFACTS_COLLECTION,
    TRANSLATION_COOLDOWNS_COLLECTION,
    TRANSLATION_LEASES_COLLECTION,
    TRANSLATION_QUARANTINES_COLLECTION,
)


@dataclass(frozen=True, slots=True)
class StoredTranslationArtifact:
    artifact_id: str
    content_hash: str
    translation_config_fingerprint: str
    overall_status: str
    fields: dict[str, dict[str, Any]]
    raw_input: dict[str, str]
    masked_input: dict[str, str]
    token_maps: dict[str, dict[str, str]]
    provenance: dict[str, Any]
    created_at: datetime


@dataclass(frozen=True, slots=True)
class GenerationLease:
    artifact_id: str
    content_hash: str
    translation_config_fingerprint: str
    owner_token: str
    acquired_at: datetime
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class FailureCooldown:
    artifact_id: str
    content_hash: str
    translation_config_fingerprint: str
    failure_reason: str
    created_at: datetime
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ArtifactQuarantine:
    artifact_id: str
    content_hash: str
    translation_config_fingerprint: str
    reason: str
    quarantined_at: datetime


@dataclass(frozen=True, slots=True)
class AggregateStorageStats:
    artifacts_count: int
    active_leases_count: int
    active_cooldowns_count: int
    quarantines_count: int


class GeneratedDataRepositoryProtocol(Protocol):
    def save_artifact(self, artifact: StoredTranslationArtifact) -> None: ...

    def get_artifact(
        self, content_hash: str, config_fingerprint: str
    ) -> StoredTranslationArtifact | None: ...

    def acquire_lease(
        self,
        content_hash: str,
        config_fingerprint: str,
        owner_token: str,
        ttl_seconds: float,
    ) -> bool: ...

    def release_lease(
        self, content_hash: str, config_fingerprint: str, owner_token: str
    ) -> None: ...

    def record_cooldown(
        self,
        content_hash: str,
        config_fingerprint: str,
        failure_reason: str,
        ttl_seconds: float,
    ) -> None: ...

    def is_cooling_down(self, content_hash: str, config_fingerprint: str) -> bool: ...

    def quarantine_artifact(
        self, content_hash: str, config_fingerprint: str, reason: str
    ) -> None: ...

    def is_quarantined(self, content_hash: str, config_fingerprint: str) -> bool: ...

    def get_aggregate_stats(self) -> AggregateStorageStats: ...

    def ping(self) -> bool: ...


class MongoGeneratedDataRepository:
    def __init__(self, database: Database[dict[str, Any]]) -> None:
        self._database = database
        self._artifacts: Collection[dict[str, Any]] = database[TRANSLATION_ARTIFACTS_COLLECTION]
        self._leases: Collection[dict[str, Any]] = database[TRANSLATION_LEASES_COLLECTION]
        self._cooldowns: Collection[dict[str, Any]] = database[TRANSLATION_COOLDOWNS_COLLECTION]
        self._quarantines: Collection[dict[str, Any]] = database[TRANSLATION_QUARANTINES_COLLECTION]

    def save_artifact(self, artifact: StoredTranslationArtifact) -> None:
        doc = {
            "artifact_id": artifact.artifact_id,
            "content_hash": artifact.content_hash,
            "translation_config_fingerprint": artifact.translation_config_fingerprint,
            "overall_status": artifact.overall_status,
            "fields": artifact.fields,
            "raw_input": artifact.raw_input,
            "masked_input": artifact.masked_input,
            "token_maps": artifact.token_maps,
            "provenance": artifact.provenance,
            "created_at": artifact.created_at,
        }
        self._artifacts.update_one(
            {
                "content_hash": artifact.content_hash,
                "translation_config_fingerprint": artifact.translation_config_fingerprint,
            },
            {"$setOnInsert": doc},
            upsert=True,
        )

    def get_artifact(
        self, content_hash: str, config_fingerprint: str
    ) -> StoredTranslationArtifact | None:
        doc = self._artifacts.find_one(
            {
                "content_hash": content_hash,
                "translation_config_fingerprint": config_fingerprint,
            }
        )
        if doc is None:
            return None
        return StoredTranslationArtifact(
            artifact_id=str(doc.get("artifact_id", f"{content_hash}:{config_fingerprint}")),
            content_hash=str(doc["content_hash"]),
            translation_config_fingerprint=str(doc["translation_config_fingerprint"]),
            overall_status=str(doc["overall_status"]),
            fields=dict(doc.get("fields", {})),
            raw_input=dict(doc.get("raw_input", {})),
            masked_input=dict(doc.get("masked_input", {})),
            token_maps=dict(doc.get("token_maps", {})),
            provenance=dict(doc.get("provenance", {})),
            created_at=doc["created_at"],
        )

    def _take_over_expired_lease(
        self,
        content_hash: str,
        config_fingerprint: str,
        owner_token: str,
        now: datetime,
        expires_at: datetime,
    ) -> bool:
        doc = self._leases.find_one_and_update(
            {
                "content_hash": content_hash,
                "translation_config_fingerprint": config_fingerprint,
                "expires_at": {"$lte": now},
            },
            {
                "$set": {
                    "artifact_id": f"{content_hash}:{config_fingerprint}",
                    "owner_token": owner_token,
                    "acquired_at": now,
                    "expires_at": expires_at,
                }
            },
        )
        return doc is not None

    def acquire_lease(
        self,
        content_hash: str,
        config_fingerprint: str,
        owner_token: str,
        ttl_seconds: float,
    ) -> bool:
        now = datetime.now(UTC)
        expires_at = now + timedelta(seconds=ttl_seconds)

        if self._take_over_expired_lease(
            content_hash, config_fingerprint, owner_token, now, expires_at
        ):
            return True

        try:
            self._leases.insert_one(
                {
                    "artifact_id": f"{content_hash}:{config_fingerprint}",
                    "content_hash": content_hash,
                    "translation_config_fingerprint": config_fingerprint,
                    "owner_token": owner_token,
                    "acquired_at": now,
                    "expires_at": expires_at,
                }
            )
            return True
        except DuplicateKeyError:
            return self._take_over_expired_lease(
                content_hash, config_fingerprint, owner_token, now, expires_at
            )

    def release_lease(
        self, content_hash: str, config_fingerprint: str, owner_token: str
    ) -> None:
        self._leases.delete_one(
            {
                "content_hash": content_hash,
                "translation_config_fingerprint": config_fingerprint,
                "owner_token": owner_token,
            }
        )

    def record_cooldown(
        self,
        content_hash: str,
        config_fingerprint: str,
        failure_reason: str,
        ttl_seconds: float,
    ) -> None:
        now = datetime.now(UTC)
        expires_at = now + timedelta(seconds=ttl_seconds)
        self._cooldowns.update_one(
            {
                "content_hash": content_hash,
                "translation_config_fingerprint": config_fingerprint,
            },
            {
                "$set": {
                    "artifact_id": f"{content_hash}:{config_fingerprint}",
                    "failure_reason": failure_reason,
                    "created_at": now,
                    "expires_at": expires_at,
                }
            },
            upsert=True,
        )

    def is_cooling_down(self, content_hash: str, config_fingerprint: str) -> bool:
        now = datetime.now(UTC)
        doc = self._cooldowns.find_one(
            {
                "content_hash": content_hash,
                "translation_config_fingerprint": config_fingerprint,
                "expires_at": {"$gt": now},
            }
        )
        return doc is not None

    def quarantine_artifact(
        self, content_hash: str, config_fingerprint: str, reason: str
    ) -> None:
        now = datetime.now(UTC)
        self._quarantines.update_one(
            {
                "content_hash": content_hash,
                "translation_config_fingerprint": config_fingerprint,
            },
            {
                "$set": {
                    "artifact_id": f"{content_hash}:{config_fingerprint}",
                    "reason": reason,
                    "quarantined_at": now,
                }
            },
            upsert=True,
        )

    def is_quarantined(self, content_hash: str, config_fingerprint: str) -> bool:
        doc = self._quarantines.find_one(
            {
                "content_hash": content_hash,
                "translation_config_fingerprint": config_fingerprint,
            }
        )
        return doc is not None

    def get_aggregate_stats(self) -> AggregateStorageStats:
        now = datetime.now(UTC)
        return AggregateStorageStats(
            artifacts_count=self._artifacts.count_documents({}),
            active_leases_count=self._leases.count_documents({"expires_at": {"$gt": now}}),
            active_cooldowns_count=self._cooldowns.count_documents({"expires_at": {"$gt": now}}),
            quarantines_count=self._quarantines.count_documents({}),
        )

    def ping(self) -> bool:
        try:
            self._database.command("ping")
            return True
        except PyMongoError:
            return False


class InMemoryGeneratedDataRepository:
    def __init__(
        self,
        *,
        datetime_provider: Callable[[], datetime] | None = None,
    ) -> None:
        self._now = datetime_provider or (lambda: datetime.now(UTC))
        self._lock = Lock()
        self._artifacts: dict[tuple[str, str], StoredTranslationArtifact] = {}
        self._leases: dict[tuple[str, str], GenerationLease] = {}
        self._cooldowns: dict[tuple[str, str], FailureCooldown] = {}
        self._quarantines: dict[tuple[str, str], ArtifactQuarantine] = {}

    def save_artifact(self, artifact: StoredTranslationArtifact) -> None:
        key = (artifact.content_hash, artifact.translation_config_fingerprint)
        with self._lock:
            if key not in self._artifacts:
                self._artifacts[key] = artifact

    def get_artifact(
        self, content_hash: str, config_fingerprint: str
    ) -> StoredTranslationArtifact | None:
        key = (content_hash, config_fingerprint)
        with self._lock:
            return self._artifacts.get(key)

    def acquire_lease(
        self,
        content_hash: str,
        config_fingerprint: str,
        owner_token: str,
        ttl_seconds: float,
    ) -> bool:
        now = self._now()
        expires_at = now + timedelta(seconds=ttl_seconds)
        key = (content_hash, config_fingerprint)

        with self._lock:
            existing = self._leases.get(key)
            if existing is not None and existing.expires_at > now:
                return False

            self._leases[key] = GenerationLease(
                artifact_id=f"{content_hash}:{config_fingerprint}",
                content_hash=content_hash,
                translation_config_fingerprint=config_fingerprint,
                owner_token=owner_token,
                acquired_at=now,
                expires_at=expires_at,
            )
            return True

    def release_lease(
        self, content_hash: str, config_fingerprint: str, owner_token: str
    ) -> None:
        key = (content_hash, config_fingerprint)
        with self._lock:
            existing = self._leases.get(key)
            if existing is not None and existing.owner_token == owner_token:
                del self._leases[key]

    def record_cooldown(
        self,
        content_hash: str,
        config_fingerprint: str,
        failure_reason: str,
        ttl_seconds: float,
    ) -> None:
        now = self._now()
        expires_at = now + timedelta(seconds=ttl_seconds)
        key = (content_hash, config_fingerprint)
        with self._lock:
            self._cooldowns[key] = FailureCooldown(
                artifact_id=f"{content_hash}:{config_fingerprint}",
                content_hash=content_hash,
                translation_config_fingerprint=config_fingerprint,
                failure_reason=failure_reason,
                created_at=now,
                expires_at=expires_at,
            )

    def is_cooling_down(self, content_hash: str, config_fingerprint: str) -> bool:
        now = self._now()
        key = (content_hash, config_fingerprint)
        with self._lock:
            cd = self._cooldowns.get(key)
            if cd is None:
                return False
            if cd.expires_at <= now:
                del self._cooldowns[key]
                return False
            return True

    def quarantine_artifact(
        self, content_hash: str, config_fingerprint: str, reason: str
    ) -> None:
        now = self._now()
        key = (content_hash, config_fingerprint)
        with self._lock:
            self._quarantines[key] = ArtifactQuarantine(
                artifact_id=f"{content_hash}:{config_fingerprint}",
                content_hash=content_hash,
                translation_config_fingerprint=config_fingerprint,
                reason=reason,
                quarantined_at=now,
            )

    def is_quarantined(self, content_hash: str, config_fingerprint: str) -> bool:
        key = (content_hash, config_fingerprint)
        with self._lock:
            return key in self._quarantines

    def get_aggregate_stats(self) -> AggregateStorageStats:
        now = self._now()
        with self._lock:
            active_leases = sum(1 for lease in self._leases.values() if lease.expires_at > now)
            active_cooldowns = sum(
                1 for cooldown in self._cooldowns.values() if cooldown.expires_at > now
            )
            return AggregateStorageStats(
                artifacts_count=len(self._artifacts),
                active_leases_count=active_leases,
                active_cooldowns_count=active_cooldowns,
                quarantines_count=len(self._quarantines),
            )

    def ping(self) -> bool:
        return True
