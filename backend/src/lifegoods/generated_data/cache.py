from __future__ import annotations

import json
import logging
from collections.abc import Callable
from datetime import datetime
from threading import Lock
from time import monotonic as system_monotonic
from typing import Any, Protocol

from redis.exceptions import RedisError

from lifegoods.generated_data.repository import StoredTranslationArtifact

TRANSLATION_CACHE_SCHEMA_VERSION = 1
TRANSLATION_CACHE_KEY_PREFIX = f"translation:artifact:v{TRANSLATION_CACHE_SCHEMA_VERSION}"

logger = logging.getLogger(__name__)


def translation_cache_key(content_hash: str, config_fingerprint: str) -> str:
    return f"{TRANSLATION_CACHE_KEY_PREFIX}:{content_hash}:{config_fingerprint}"


class TranslationHotCacheProtocol(Protocol):
    def get(
        self, content_hash: str, config_fingerprint: str
    ) -> StoredTranslationArtifact | None: ...

    def put(
        self, artifact: StoredTranslationArtifact, *, ttl_seconds: int | None = None
    ) -> None: ...

    def delete(self, content_hash: str, config_fingerprint: str) -> None: ...


class RedisClientProtocol(Protocol):
    def get(self, name: str) -> Any: ...
    def set(self, name: str, value: Any, ex: int | None = None) -> Any: ...
    def delete(self, *names: Any) -> Any: ...


class RedisTranslationHotCache:
    def __init__(self, client: RedisClientProtocol, *, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            raise ValueError("Translation cache lifetime must be greater than zero")
        self._client = client
        self._ttl_seconds = ttl_seconds

    def get(
        self, content_hash: str, config_fingerprint: str
    ) -> StoredTranslationArtifact | None:
        key = translation_cache_key(content_hash, config_fingerprint)
        try:
            payload = self._client.get(key)
            if payload is None:
                return None
            return _deserialize_artifact(payload, content_hash, config_fingerprint)
        except (RedisError, TypeError, ValueError, json.JSONDecodeError) as error:
            _log_cache_failure("read", error)
            return None

    def put(
        self, artifact: StoredTranslationArtifact, *, ttl_seconds: int | None = None
    ) -> None:
        key = translation_cache_key(
            artifact.content_hash, artifact.translation_config_fingerprint
        )
        try:
            payload = _serialize_artifact(artifact)
            ttl = self._ttl_seconds if ttl_seconds is None else ttl_seconds
            if ttl <= 0:
                raise ValueError("Translation cache lifetime must be greater than zero")
            self._client.set(key, payload, ex=ttl)
        except (RedisError, TypeError, ValueError) as error:
            _log_cache_failure("write", error)

    def delete(self, content_hash: str, config_fingerprint: str) -> None:
        key = translation_cache_key(content_hash, config_fingerprint)
        try:
            self._client.delete(key)
        except (RedisError, TypeError, ValueError) as error:
            _log_cache_failure("delete", error)


class InMemoryTranslationHotCache:
    def __init__(
        self,
        *,
        ttl_seconds: int,
        monotonic: Callable[[], float] = system_monotonic,
    ) -> None:
        if ttl_seconds <= 0:
            raise ValueError("Translation cache lifetime must be greater than zero")
        self._ttl_seconds = ttl_seconds
        self._monotonic = monotonic
        self._entries: dict[tuple[str, str], tuple[float, StoredTranslationArtifact]] = {}
        self._lock = Lock()

    def get(
        self, content_hash: str, config_fingerprint: str
    ) -> StoredTranslationArtifact | None:
        key = (content_hash, config_fingerprint)
        with self._lock:
            cached = self._entries.get(key)
            if cached is None:
                return None
            expires_at, artifact = cached
            if expires_at <= self._monotonic():
                del self._entries[key]
                return None
            return artifact

    def put(
        self, artifact: StoredTranslationArtifact, *, ttl_seconds: int | None = None
    ) -> None:
        ttl = self._ttl_seconds if ttl_seconds is None else ttl_seconds
        if ttl <= 0:
            raise ValueError("Translation cache lifetime must be greater than zero")
        key = (artifact.content_hash, artifact.translation_config_fingerprint)
        with self._lock:
            self._entries[key] = (
                self._monotonic() + ttl,
                artifact,
            )

    def delete(self, content_hash: str, config_fingerprint: str) -> None:
        key = (content_hash, config_fingerprint)
        with self._lock:
            self._entries.pop(key, None)


class NullTranslationHotCache:
    def get(
        self, content_hash: str, config_fingerprint: str
    ) -> StoredTranslationArtifact | None:
        return None

    def put(
        self, artifact: StoredTranslationArtifact, *, ttl_seconds: int | None = None
    ) -> None:
        pass

    def delete(self, content_hash: str, config_fingerprint: str) -> None:
        pass


def _serialize_artifact(artifact: StoredTranslationArtifact) -> str:
    payload: dict[str, Any] = {
        "schema_version": TRANSLATION_CACHE_SCHEMA_VERSION,
        "artifact_id": artifact.artifact_id,
        "content_hash": artifact.content_hash,
        "translation_config_fingerprint": artifact.translation_config_fingerprint,
        "overall_status": artifact.overall_status,
        "fields": artifact.fields,
        "raw_input": artifact.raw_input,
        "masked_input": artifact.masked_input,
        "token_maps": artifact.token_maps,
        "provenance": artifact.provenance,
        "created_at": artifact.created_at.isoformat(),
    }
    return json.dumps(payload, separators=(",", ":"), allow_nan=False)


def _deserialize_artifact(
    payload: Any, content_hash: str, config_fingerprint: str
) -> StoredTranslationArtifact:
    if isinstance(payload, bytes):
        payload = payload.decode("utf-8")
    if not isinstance(payload, str):
        raise ValueError("Translation cache value is not text")
    raw = json.loads(payload, parse_constant=_reject_json_constant)
    if not isinstance(raw, dict):
        raise ValueError("Translation cache value is not an object")
    if raw.get("schema_version") != TRANSLATION_CACHE_SCHEMA_VERSION:
        raise ValueError("Translation cache schema is incompatible")
    if raw.get("content_hash") != content_hash:
        raise ValueError("Translation cache content hash is incompatible")
    if raw.get("translation_config_fingerprint") != config_fingerprint:
        raise ValueError("Translation cache config fingerprint is incompatible")

    created_at = datetime.fromisoformat(raw["created_at"])
    return StoredTranslationArtifact(
        artifact_id=str(raw["artifact_id"]),
        content_hash=str(raw["content_hash"]),
        translation_config_fingerprint=str(raw["translation_config_fingerprint"]),
        overall_status=str(raw["overall_status"]),
        fields=dict(raw.get("fields", {})),
        raw_input=dict(raw.get("raw_input", {})),
        masked_input=dict(raw.get("masked_input", {})),
        token_maps=dict(raw.get("token_maps", {})),
        provenance=dict(raw.get("provenance", {})),
        created_at=created_at,
    )


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"Unsupported JSON constant: {value}")


def _log_cache_failure(operation: str, error: Exception) -> None:
    logger.warning(
        "Translation cache operation failed open",
        extra={
            "event": "translation_cache_failure",
            "dependency": "redis",
            "operation": operation,
            "failure_category": "cache_unavailable",
            "error_category": type(error).__name__,
        },
    )
