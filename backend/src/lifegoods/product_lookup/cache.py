from __future__ import annotations

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from threading import Lock
from time import monotonic as system_monotonic
from typing import Any, Protocol

from redis.exceptions import RedisError

from lifegoods.identifiers import NormalizedIdentifier
from lifegoods.product_lookup.models import SourceRecord

PRODUCT_LOOKUP_CACHE_SCHEMA_VERSION = 1
PRODUCT_LOOKUP_CACHE_KEY_PREFIX = (
    f"product-lookup:cache:v{PRODUCT_LOOKUP_CACHE_SCHEMA_VERSION}"
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ProductLookupCacheEntry:
    source_record: SourceRecord | None


class ProductLookupCache(Protocol):
    def get(
        self,
        dataset_version: str,
        barcode: NormalizedIdentifier,
    ) -> ProductLookupCacheEntry | None: ...

    def put(
        self,
        dataset_version: str,
        barcode: NormalizedIdentifier,
        entry: ProductLookupCacheEntry,
    ) -> None: ...


class RedisClientProtocol(Protocol):
    def get(self, name: str) -> Any: ...
    def set(self, name: str, value: Any, ex: int | None = None) -> Any: ...


def product_lookup_cache_key(
    dataset_version: str,
    barcode: NormalizedIdentifier,
) -> str:
    return f"{PRODUCT_LOOKUP_CACHE_KEY_PREFIX}:{dataset_version}:{barcode.value}"


class RedisProductLookupCache:
    def __init__(self, client: RedisClientProtocol, *, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            raise ValueError("Product Lookup cache lifetime must be greater than zero")
        self._client = client
        self._ttl_seconds = ttl_seconds

    def get(
        self,
        dataset_version: str,
        barcode: NormalizedIdentifier,
    ) -> ProductLookupCacheEntry | None:
        try:
            payload = self._client.get(
                product_lookup_cache_key(dataset_version, barcode)
            )
            if payload is None:
                return None
            return _deserialize_entry(payload, dataset_version, barcode)
        except (RedisError, TypeError, ValueError, json.JSONDecodeError) as error:
            _log_cache_failure("read", error)
            return None

    def put(
        self,
        dataset_version: str,
        barcode: NormalizedIdentifier,
        entry: ProductLookupCacheEntry,
    ) -> None:
        try:
            self._client.set(
                product_lookup_cache_key(dataset_version, barcode),
                _serialize_entry(entry, dataset_version, barcode),
                ex=self._ttl_seconds,
            )
        except (RedisError, TypeError, ValueError) as error:
            _log_cache_failure("write", error)


class InMemoryProductLookupCache:
    def __init__(
        self,
        *,
        ttl_seconds: int,
        monotonic: Callable[[], float] = system_monotonic,
    ) -> None:
        if ttl_seconds <= 0:
            raise ValueError("Product Lookup cache lifetime must be greater than zero")
        self._ttl_seconds = ttl_seconds
        self._monotonic = monotonic
        self._entries: dict[str, tuple[float, ProductLookupCacheEntry]] = {}
        self._lock = Lock()

    def get(
        self,
        dataset_version: str,
        barcode: NormalizedIdentifier,
    ) -> ProductLookupCacheEntry | None:
        key = product_lookup_cache_key(dataset_version, barcode)
        with self._lock:
            cached = self._entries.get(key)
            if cached is None:
                return None
            expires_at, entry = cached
            if expires_at <= self._monotonic():
                self._entries.pop(key, None)
                return None
            return entry

    def put(
        self,
        dataset_version: str,
        barcode: NormalizedIdentifier,
        entry: ProductLookupCacheEntry,
    ) -> None:
        key = product_lookup_cache_key(dataset_version, barcode)
        with self._lock:
            self._entries[key] = (
                self._monotonic() + self._ttl_seconds,
                entry,
            )


class NullProductLookupCache:
    def get(self, dataset_version: str, barcode: NormalizedIdentifier) -> None:
        return None

    def put(
        self,
        dataset_version: str,
        barcode: NormalizedIdentifier,
        entry: ProductLookupCacheEntry,
    ) -> None:
        return None


def _serialize_entry(
    entry: ProductLookupCacheEntry,
    dataset_version: str,
    barcode: NormalizedIdentifier,
) -> str:
    payload: dict[str, Any] = {
        "schema_version": PRODUCT_LOOKUP_CACHE_SCHEMA_VERSION,
        "dataset_version": dataset_version,
        "barcode": barcode.value,
        "outcome": "found" if entry.source_record is not None else "not_found",
    }
    if entry.source_record is not None:
        payload["source_record"] = entry.source_record
    return json.dumps(payload, separators=(",", ":"), allow_nan=False)


def _deserialize_entry(
    payload: Any,
    dataset_version: str,
    barcode: NormalizedIdentifier,
) -> ProductLookupCacheEntry:
    if isinstance(payload, bytes):
        payload = payload.decode("utf-8")
    if not isinstance(payload, str):
        raise ValueError("Product Lookup cache value is not text")
    raw = json.loads(payload, parse_constant=_reject_json_constant)
    if not isinstance(raw, dict):
        raise ValueError("Product Lookup cache value is not an object")
    if raw.get("schema_version") != PRODUCT_LOOKUP_CACHE_SCHEMA_VERSION:
        raise ValueError("Product Lookup cache schema is incompatible")
    if raw.get("dataset_version") != dataset_version:
        raise ValueError("Product Lookup cache Dataset Snapshot is incompatible")
    if raw.get("barcode") != barcode.value:
        raise ValueError("Product Lookup cache Barcode is incompatible")
    outcome = raw.get("outcome")
    if outcome == "not_found" and "source_record" not in raw:
        return ProductLookupCacheEntry(source_record=None)
    source_record = raw.get("source_record")
    if outcome != "found" or not isinstance(source_record, dict):
        raise ValueError("Product Lookup cache outcome is malformed")
    if not all(isinstance(key, str) for key in source_record):
        raise ValueError("Product Lookup cache Source Record has an invalid key")
    if "_id" in source_record or source_record.get("code") != barcode.value:
        raise ValueError("Product Lookup cache Source Record is incompatible")
    return ProductLookupCacheEntry(source_record=source_record)


def _log_cache_failure(operation: str, error: Exception) -> None:
    logger.warning(
        "Product Lookup cache operation failed open",
        extra={
            "event": "product_lookup_cache_failure",
            "dependency": "redis",
            "operation": operation,
            "failure_category": "cache_unavailable",
            "error_category": type(error).__name__,
        },
    )


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"Unsupported JSON constant: {value}")
