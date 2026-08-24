from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from time import monotonic as system_monotonic
from typing import Any

import httpx

from lifegoods.matching.external_source import (
    ExternalLookupResult,
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageRecord,
    ExternalPackageUnavailable,
    ExternalSelectedImage,
    ExternalSourceUnavailableReason,
    JsonValue,
    SourcedValue,
)
from lifegoods.matching.identifier import NormalizedIdentifier

OPEN_FOOD_FACTS_BASE_URL = "https://world.openfoodfacts.org"
OPEN_FOOD_FACTS_USER_AGENT = (
    "LifeGoods/0.1.0 (https://github.com/internetOnion/life-goods)"
)
SUCCESS_CACHE_TTL_SECONDS = 24 * 60 * 60
NOT_FOUND_CACHE_TTL_SECONDS = 15 * 60
DEFAULT_MAX_CACHE_ENTRIES = 1_024
OPEN_FOOD_FACTS_FIELDS = (
    "code",
    "product_name",
    "product_name_en",
    "product_name_km",
    "product_name_th",
    "product_name_vi",
    "product_name_zh",
    "brands",
    "quantity",
    "selected_images",
    "ingredients_text",
    "ingredients_text_en",
    "ingredients_text_km",
    "ingredients_text_th",
    "ingredients_text_vi",
    "ingredients_text_zh",
    "allergens",
    "allergens_tags",
    "traces",
    "traces_tags",
    "nutriments",
    "nutrition_data_per",
    "nutrition_data_prepared_per",
    "serving_size",
    "lang",
    "languages_tags",
    "countries_tags",
    "last_modified_t",
)

LOCALIZED_NAME_FIELDS = (
    ("product_name", None),
    ("product_name_en", "en"),
    ("product_name_km", "km"),
    ("product_name_th", "th"),
    ("product_name_vi", "vi"),
    ("product_name_zh", "zh"),
)
LOCALIZED_INGREDIENT_FIELDS = (
    ("ingredients_text", None),
    ("ingredients_text_en", "en"),
    ("ingredients_text_km", "km"),
    ("ingredients_text_th", "th"),
    ("ingredients_text_vi", "vi"),
    ("ingredients_text_zh", "zh"),
)

type CacheableLookupResult = ExternalPackageFound | ExternalPackageNotFound


@dataclass(frozen=True, slots=True)
class _CacheEntry:
    result: CacheableLookupResult
    expires_at: float


class OpenFoodFactsPackageSource:
    def __init__(
        self,
        client: httpx.Client,
        *,
        base_url: str = OPEN_FOOD_FACTS_BASE_URL,
        user_agent: str = OPEN_FOOD_FACTS_USER_AGENT,
        timeout_seconds: float = 2.0,
        utc_now: Callable[[], datetime] | None = None,
        monotonic: Callable[[], float] = system_monotonic,
        success_cache_ttl_seconds: float = SUCCESS_CACHE_TTL_SECONDS,
        not_found_cache_ttl_seconds: float = NOT_FOUND_CACHE_TTL_SECONDS,
        max_cache_entries: int = DEFAULT_MAX_CACHE_ENTRIES,
    ) -> None:
        if success_cache_ttl_seconds <= 0 or not_found_cache_ttl_seconds <= 0:
            raise ValueError("Cache TTLs must be positive")
        if max_cache_entries <= 0:
            raise ValueError("The cache must allow at least one entry")
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._user_agent = user_agent
        self._timeout_seconds = timeout_seconds
        self._utc_now = utc_now or (lambda: datetime.now(UTC))
        self._monotonic = monotonic
        self._success_cache_ttl_seconds = success_cache_ttl_seconds
        self._not_found_cache_ttl_seconds = not_found_cache_ttl_seconds
        self._max_cache_entries = max_cache_entries
        self._cache: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._cache_lock = Lock()

    def lookup(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        cached = self._cached(identifier.value)
        if cached is not None:
            return cached

        result = self._fetch(identifier)
        if isinstance(result, (ExternalPackageFound, ExternalPackageNotFound)):
            self._store(identifier.value, result)
        return result

    def _fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        try:
            response = self._client.get(
                f"{self._base_url}/api/v3/product/{identifier.value}.json",
                params={"fields": ",".join(OPEN_FOOD_FACTS_FIELDS)},
                headers={"accept": "application/json", "user-agent": self._user_agent},
                timeout=self._timeout_seconds,
            )
        except httpx.TimeoutException:
            return ExternalPackageUnavailable(
                identifier=identifier.value,
                reason=ExternalSourceUnavailableReason.TIMEOUT,
            )
        except httpx.TransportError:
            return ExternalPackageUnavailable(
                identifier=identifier.value,
                reason=ExternalSourceUnavailableReason.NETWORK,
            )

        retrieved_at = self._utc_now()
        if response.status_code == 404:
            return ExternalPackageNotFound(
                identifier=identifier.value,
                request_url=str(response.request.url),
                retrieved_at=retrieved_at,
                raw_response=response.content,
            )
        if response.status_code != 200:
            if response.status_code == 429:
                reason = ExternalSourceUnavailableReason.RATE_LIMITED
            elif response.status_code >= 500:
                reason = ExternalSourceUnavailableReason.UPSTREAM_ERROR
            else:
                reason = ExternalSourceUnavailableReason.UNEXPECTED_STATUS
            return ExternalPackageUnavailable(
                identifier=identifier.value,
                reason=reason,
                status_code=response.status_code,
            )

        try:
            payload = response.json()
        except ValueError:
            return _invalid_response(identifier)
        if not isinstance(payload, dict):
            return _invalid_response(identifier)
        product = payload.get("product")
        if not isinstance(product, dict) or product.get("code") != identifier.value:
            return _invalid_response(identifier)

        primary_language = _non_empty_string(product.get("lang"))
        record = ExternalPackageRecord(
            identifier=identifier.value,
            source_record_id=identifier.value,
            request_url=str(response.request.url),
            source_url=f"{self._base_url}/product/{identifier.value}",
            retrieved_at=retrieved_at,
            source_revision=_source_revision(product.get("last_modified_t")),
            raw_response=response.content,
            names=_localized_texts(product, LOCALIZED_NAME_FIELDS, primary_language),
            brands=_brands(product),
            quantity=_string_value(product, "quantity"),
            selected_images=_selected_images(product),
            ingredient_texts=_localized_texts(
                product, LOCALIZED_INGREDIENT_FIELDS, primary_language
            ),
            allergen_declaration=_string_value(product, "allergens"),
            allergen_tags=_string_tuple_value(product, "allergens_tags"),
            trace_declaration=_string_value(product, "traces"),
            trace_tags=_string_tuple_value(product, "traces_tags"),
            nutrition=_nutrition(product),
            packaging_languages=_string_tuple_value(product, "languages_tags"),
            countries_sold=_string_tuple_value(product, "countries_tags"),
        )
        return ExternalPackageFound(record=record)

    def _cached(self, identifier: str) -> CacheableLookupResult | None:
        with self._cache_lock:
            now = self._monotonic()
            self._purge_expired(now)
            entry = self._cache.pop(identifier, None)
            if entry is None:
                return None
            self._cache[identifier] = entry
            return entry.result

    def _store(self, identifier: str, result: CacheableLookupResult) -> None:
        if isinstance(result, ExternalPackageFound):
            ttl_seconds = self._success_cache_ttl_seconds
        else:
            ttl_seconds = self._not_found_cache_ttl_seconds
        with self._cache_lock:
            now = self._monotonic()
            self._purge_expired(now)
            self._cache.pop(identifier, None)
            self._cache[identifier] = _CacheEntry(
                result=result,
                expires_at=now + ttl_seconds,
            )
            while len(self._cache) > self._max_cache_entries:
                self._cache.popitem(last=False)

    def _purge_expired(self, now: float) -> None:
        expired = [
            identifier
            for identifier, entry in self._cache.items()
            if entry.expires_at <= now
        ]
        for identifier in expired:
            del self._cache[identifier]


def _invalid_response(identifier: NormalizedIdentifier) -> ExternalPackageUnavailable:
    return ExternalPackageUnavailable(
        identifier=identifier.value,
        reason=ExternalSourceUnavailableReason.INVALID_RESPONSE,
    )


def _localized_texts(
    product: dict[str, Any],
    fields: tuple[tuple[str, str | None], ...],
    primary_language: str | None,
) -> tuple[SourcedValue[str], ...]:
    values: list[SourcedValue[str]] = []
    for source_field, language in fields:
        value = _non_empty_string(product.get(source_field))
        if value is not None:
            values.append(
                SourcedValue(
                    value=value,
                    source_field=source_field,
                    language=primary_language if language is None else language,
                )
            )
    return tuple(values)


def _brands(product: dict[str, Any]) -> SourcedValue[tuple[str, ...]] | None:
    value = _non_empty_string(product.get("brands"))
    if value is None:
        return None
    brands = tuple(brand.strip() for brand in value.split(",") if brand.strip())
    return SourcedValue(value=brands, source_field="brands") if brands else None


def _string_value(product: dict[str, Any], field: str) -> SourcedValue[str] | None:
    value = _non_empty_string(product.get(field))
    return SourcedValue(value=value, source_field=field) if value is not None else None


def _string_tuple_value(
    product: dict[str, Any], field: str
) -> SourcedValue[tuple[str, ...]] | None:
    raw_value = product.get(field)
    if not isinstance(raw_value, list):
        return None
    values = tuple(value for value in raw_value if isinstance(value, str) and value)
    return SourcedValue(value=values, source_field=field) if values else None


def _selected_images(product: dict[str, Any]) -> tuple[ExternalSelectedImage, ...]:
    selected_images = product.get("selected_images")
    if not isinstance(selected_images, dict):
        return ()
    images: list[ExternalSelectedImage] = []
    for role, variants in selected_images.items():
        if not isinstance(role, str) or not isinstance(variants, dict):
            continue
        display = variants.get("display")
        if not isinstance(display, dict):
            continue
        for language, raw_url in display.items():
            url = _non_empty_string(raw_url)
            if isinstance(language, str) and url is not None:
                images.append(
                    ExternalSelectedImage(
                        role=role,
                        url=url,
                        source_field=f"selected_images.{role}.display.{language}",
                        language=language,
                    )
                )
    return tuple(images)


def _nutrition(product: dict[str, Any]) -> tuple[SourcedValue[JsonValue], ...]:
    nutrition_fields = (
        "nutriments",
        "nutrition_data_per",
        "nutrition_data_prepared_per",
        "serving_size",
    )
    return tuple(
        SourcedValue(value=value, source_field=field)
        for field in nutrition_fields
        if (value := product.get(field)) not in (None, "", [], {})
    )


def _source_revision(value: object) -> str | None:
    if isinstance(value, (int, str)) and str(value):
        return str(value)
    return None


def _non_empty_string(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None
