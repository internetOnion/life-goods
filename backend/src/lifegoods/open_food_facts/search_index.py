"""Build and maintain the version-pinned OFF search index."""

from __future__ import annotations

import time
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from math import isfinite
from typing import Any

from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database

from lifegoods.identifiers import InvalidIdentifierError, normalize_identifier
from lifegoods.product_lookup.projection import (
    extract_brands,
    extract_front_image,
    extract_labels,
    extract_manufacturing_places,
    extract_packaging,
    extract_preferred_generic_name,
    extract_preferred_name,
    extract_product_names,
    extract_quantity,
)

SEARCH_COLLECTION_PREFIX = "off_product_search_"
SEARCH_SCHEMA_VERSION = 4
VERSIONS_COLLECTION = "off_dataset_versions"
REQUIRED_SEARCH_INDEXES = frozenset(
    {
        "ix_search_name_tokens",
        "ix_search_brand_tokens",
        "ix_search_country_tokens",
        "ix_search_sort",
    }
)

SORTED_SEARCH_INDEXES = {
    f"ix_search_{field}_sort": [
        (field, ASCENDING),
        ("information_score", DESCENDING),
        ("name_sort", ASCENDING),
        ("code", ASCENDING),
    ]
    for field in ("brand_values", "name_values", "name_tokens", "brand_tokens", "country_tokens")
}
SEARCH_SORT_INDEX = [
    ("information_score", DESCENDING),
    ("name_sort", ASCENDING),
    ("code", ASCENDING),
]
SEARCH_SORT_SPEC = {
    "information_score": -1,
    "name_sort": 1,
    "code": 1,
}
REQUIRED_SEARCH_INDEXES = REQUIRED_SEARCH_INDEXES | frozenset(SORTED_SEARCH_INDEXES)


def ensure_collection_search_indexes(collection: Any) -> None:
    collection.create_index(SEARCH_SORT_INDEX, name="ix_search_sort")
    for name, keys in SORTED_SEARCH_INDEXES.items():
        collection.create_index(keys, name=name)


def ensure_search_indexes(database: Database[dict[str, Any]], version_id: str) -> dict[str, Any]:
    """Add ordering indexes without rebuilding summaries or modifying the manifest."""
    manifest = database[VERSIONS_COLLECTION].find_one({"_id": version_id})
    meta = manifest.get("search_index") if manifest else None
    if not isinstance(meta, dict) or meta.get("schema_version") != SEARCH_SCHEMA_VERSION:
        raise SearchIndexIncompatibleError("Search index schema is incompatible")
    name = meta.get("collection_name")
    if meta.get("status") != "READY" or not isinstance(name, str):
        raise SearchIndexUnavailableError("Search index is not ready")
    if name not in database.list_collection_names():
        raise SearchIndexUnavailableError("Search collection is unavailable")
    ensure_collection_search_indexes(database[name])
    validate_search_index_readiness(database, version_id)
    return {
        "version_id": version_id, "collection_name": name, "status": "READY",
        "indexes": sorted(SORTED_SEARCH_INDEXES),
    }


class SearchIndexError(Exception):
    """Base exception for search index issues."""


class SearchIndexUnavailableError(SearchIndexError):
    """Raised when the search index or collection is missing or not ready."""


class SearchIndexIncompatibleError(SearchIndexError):
    """Raised when the search index has an incompatible schema version."""


class SearchIndexTimeoutError(SearchIndexError):
    """Raised when text search query exceeds execution deadline."""


@dataclass(frozen=True, slots=True)
class SearchCursor:
    rank: int
    name_sort: str
    code: str
    information_score: int


def search_sort_key(row: dict[str, Any]) -> tuple[int, str, str]:
    """Return the deterministic descending-information search order."""
    return (
        -row.get("information_score", 0),
        row.get("name_sort", ""),
        row.get("code", ""),
    )


def extract_terms(text: str) -> tuple[str, ...]:
    """Extract normalized terms while preserving Unicode combining marks.

    NFKC normalizes and casefolds the text, then groups consecutive word
    characters (Unicode categories L: Letter, M: Mark, N: Number).
    """
    normalized = unicodedata.normalize("NFKC", text).casefold()
    terms: list[str] = []
    current: list[str] = []
    for char in normalized:
        cat = unicodedata.category(char)
        if cat[0] in ("L", "M", "N"):
            current.append(char)
        else:
            if current:
                token = "".join(current)
                if any(unicodedata.category(c)[0] in ("L", "N") for c in token):
                    terms.append(token)
                current = []
    if current:
        token = "".join(current)
        if any(unicodedata.category(c)[0] in ("L", "N") for c in token):
            terms.append(token)
    return tuple(terms)


def normalize_search_value(text: str) -> str:
    """Normalize text for exact matching while preserving combining marks."""
    return " ".join(extract_terms(text))


def _text_value(val: Any) -> str | None:
    if isinstance(val, str) and val.strip():
        return val.strip()
    return None


def index_document(
    product: dict[str, Any],
    *,
    validate_barcode: bool = True,
) -> dict[str, Any] | None:
    code = product.get("code")
    if not isinstance(code, str) or not code.strip():
        return None
    if validate_barcode:
        try:
            normalized = normalize_identifier(code)
            if normalized.value != code:
                return None
        except InvalidIdentifierError:
            return None

    record_language = _text_value(product.get("lang"))
    names = extract_product_names(product, record_language)
    name_values = [
        normalize_search_value(n.value) for n in names if normalize_search_value(n.value)
    ]
    name_tokens = sorted({token for n in names for token in extract_terms(n.value)})
    names_data = [
        {"value": n.value, "language": n.language, "source_field": n.source_field} for n in names
    ]

    preferred = extract_preferred_name(product, record_language)
    name_sort = normalize_search_value(preferred.value)[:100] if preferred else ""
    generic_name = extract_preferred_generic_name(product, record_language)

    brands_list = extract_brands(product)
    brand_values = [normalize_search_value(b) for b in brands_list if normalize_search_value(b)]
    brand_tokens = sorted({token for b in brands_list for token in extract_terms(b)})

    manufacturing_places = extract_manufacturing_places(product)
    country_values = [
        normalize_search_value(place)
        for place in manufacturing_places
        if normalize_search_value(place)
    ]
    country_tokens = sorted(
        {token for place in manufacturing_places for token in extract_terms(place)}
    )

    quantity = extract_quantity(product)
    packaging = extract_packaging(product)
    labels = extract_labels(product)
    thumbnail_img = extract_front_image(product, code, record_language)
    thumbnail_data = (
        {
            "url": thumbnail_img.url,
            "language": thumbnail_img.language,
            "source_field": thumbnail_img.source_field,
        }
        if thumbnail_img
        else None
    )

    information_score = sum(
        (
            _has_ingredient_data(product),
            _has_nutrition_data(product),
            thumbnail_img is not None,
            bool(brands_list),
            quantity is not None,
        )
    )

    return {
        "_id": code,
        "code": code,
        "record_language": record_language,
        "name_values": name_values,
        "name_tokens": name_tokens,
        "brand_values": brand_values,
        "brand_tokens": brand_tokens,
        "country_values": country_values,
        "country_tokens": country_tokens,
        "names": names_data,
        "name_sort": name_sort,
        "information_score": information_score,
        "generic_name": (
            {
                "value": generic_name.value,
                "language": generic_name.language,
                "source_field": generic_name.source_field,
            }
            if generic_name
            else None
        ),
        "brands": brands_list,
        "manufacturing_places": manufacturing_places,
        "quantity": quantity,
        "packaging": packaging,
        "labels": labels,
        "thumbnail": thumbnail_data,
    }


def _has_ingredient_data(product: dict[str, Any]) -> bool:
    return any(
        isinstance(product.get(field), str) and bool(product[field].strip())
        for field, _language in (
            ("ingredients_text", None),
            ("ingredients_text_en", "en"),
            ("ingredients_text_fr", "fr"),
            ("ingredients_text_km", "km"),
            ("ingredients_text_th", "th"),
            ("ingredients_text_vi", "vi"),
            ("ingredients_text_zh", "zh"),
        )
    )


def _has_nutrition_data(product: dict[str, Any]) -> bool:
    nutriments = product.get("nutriments")
    if isinstance(nutriments, dict):
        for field, value in nutriments.items():
            if (
                isinstance(field, str)
                and any(
                    field == declaration or field.startswith(f"{declaration}_")
                    for declaration in (
                        "energy",
                        "energy-kj",
                        "energy-kcal",
                        "fat",
                        "saturated-fat",
                        "carbohydrates",
                        "sugars",
                        "fiber",
                        "proteins",
                        "salt",
                        "sodium",
                    )
                )
                and value not in (None, "", [], {})
            ):
                return True
    return any(product.get(field) not in (None, "", [], {}) for field in (
        "nutrition_data_per", "nutrition_data_prepared_per", "serving_size"
    ))


def search_collection_name(version_id: str) -> str:
    return f"{SEARCH_COLLECTION_PREFIX}{version_id}"


def validate_search_index_readiness(
    database: Database[dict[str, Any]],
    version_id: str,
) -> str:
    manifest = database[VERSIONS_COLLECTION].find_one({"_id": version_id})
    if manifest is None:
        raise SearchIndexUnavailableError(f"Dataset version {version_id} does not exist")

    search_meta = manifest.get("search_index")
    if not isinstance(search_meta, dict):
        raise SearchIndexUnavailableError(f"Search index metadata missing for version {version_id}")

    schema_ver = search_meta.get("schema_version")
    if schema_ver != SEARCH_SCHEMA_VERSION:
        raise SearchIndexIncompatibleError(
            f"Search index schema version is {schema_ver}, expected {SEARCH_SCHEMA_VERSION}"
        )

    status = search_meta.get("status")
    if status != "READY":
        raise SearchIndexUnavailableError(f"Search index status is '{status}', expected 'READY'")

    target_name = search_meta.get("collection_name")
    if not isinstance(target_name, str) or target_name not in database.list_collection_names():
        raise SearchIndexUnavailableError(f"Search collection '{target_name}' is unavailable")

    existing_indexes = database[target_name].index_information()
    missing_indexes = REQUIRED_SEARCH_INDEXES - set(existing_indexes.keys())
    if missing_indexes:
        raise SearchIndexUnavailableError(
            f"Search collection is missing required indexes: {sorted(missing_indexes)}"
        )

    for name, keys in SORTED_SEARCH_INDEXES.items():
        if list(existing_indexes[name].get("key", [])) != keys:
            raise SearchIndexUnavailableError(f"Search index definition is incompatible: {name}")
    if list(existing_indexes["ix_search_sort"].get("key", [])) != SEARCH_SORT_INDEX:
        raise SearchIndexUnavailableError("Search index definition is incompatible: ix_search_sort")
    return target_name


def build_search_index(
    database: Database[dict[str, Any]],
    version_id: str,
    *,
    indexer: Callable[[dict[str, Any]], dict[str, Any] | None] = index_document,
    progress: Callable[[dict[str, int | float | str]], None] | None = None,
    progress_interval_seconds: float = 5.0,
) -> dict[str, Any]:
    if not isfinite(progress_interval_seconds) or progress_interval_seconds <= 0:
        raise ValueError("Progress interval must be greater than zero")

    manifest = database[VERSIONS_COLLECTION].find_one({"_id": version_id})
    if manifest is None:
        raise ValueError(f"Dataset version {version_id} does not exist")
    source_collection_name = manifest.get("collection_name")
    if not isinstance(source_collection_name, str) or not source_collection_name:
        raise ValueError("Dataset product collection is unavailable")
    if source_collection_name not in database.list_collection_names():
        raise ValueError("Dataset product collection is unavailable")

    target_name = search_collection_name(version_id)
    temporary_name = f"{target_name}_building"
    database.drop_collection(temporary_name)
    renamed = False
    started_monotonic = time.monotonic()
    last_progress = started_monotonic

    def report(event: dict[str, int | float | str]) -> None:
        if progress is not None:
            progress(event)

    try:
        target = database[temporary_name]
        total_count = database[source_collection_name].count_documents({})
        indexed_count = 0
        excluded_count = 0
        scanned_count = 0
        batch: list[dict[str, Any]] = []
        report(
            {
                "stage": "scanning",
                "scanned_count": scanned_count,
                "total_count": total_count,
                "indexed_count": indexed_count,
                "excluded_count": excluded_count,
                "elapsed_seconds": 0.0,
            }
        )
        for product in database[source_collection_name].find({}):
            scanned_count += 1
            indexed = indexer(product)
            if indexed is None:
                excluded_count += 1
            else:
                batch.append(indexed)
                if len(batch) >= 1_000:
                    target.insert_many(batch)
                    indexed_count += len(batch)
                    batch.clear()

            now_monotonic = time.monotonic()
            if now_monotonic - last_progress >= progress_interval_seconds:
                report(
                    {
                        "stage": "scanning",
                        "scanned_count": scanned_count,
                        "total_count": total_count,
                        "indexed_count": indexed_count + len(batch),
                        "excluded_count": excluded_count,
                        "elapsed_seconds": now_monotonic - started_monotonic,
                    }
                )
                last_progress = now_monotonic
        if batch:
            target.insert_many(batch)
            indexed_count += len(batch)
            batch.clear()
        elapsed = time.monotonic() - started_monotonic
        report(
            {
                "stage": "scanning",
                "scanned_count": scanned_count,
                "total_count": total_count,
                "indexed_count": indexed_count,
                "excluded_count": excluded_count,
                "elapsed_seconds": elapsed,
            }
        )

        index_definitions = [
            ("ix_search_name_tokens", [("name_tokens", ASCENDING)]),
            ("ix_search_brand_tokens", [("brand_tokens", ASCENDING)]),
            ("ix_search_country_tokens", [("country_tokens", ASCENDING)]),
            ("ix_search_sort", SEARCH_SORT_INDEX),
            *SORTED_SEARCH_INDEXES.items(),
        ]
        for index_number, (index_name, keys) in enumerate(index_definitions, start=1):
            report(
                {
                    "stage": "creating_index",
                    "index_name": index_name,
                    "index_number": index_number,
                    "index_total": len(index_definitions),
                }
            )
            target.create_index(keys, name=index_name)
            report(
                {
                    "stage": "index_created",
                    "index_name": index_name,
                    "index_number": index_number,
                    "index_total": len(index_definitions),
                }
            )
        report({"stage": "activating"})
        target.rename(target_name, dropTarget=True)
        renamed = True
        report({"stage": "activated"})
        result = {
            "schema_version": SEARCH_SCHEMA_VERSION,
            "collection_name": target_name,
            "document_count": indexed_count,
            "excluded_count": excluded_count,
            "status": "READY",
        }
        database[VERSIONS_COLLECTION].update_one(
            {"_id": version_id}, {"$set": {"search_index": result}}
        )
        report(
            {
                "stage": "complete",
                "scanned_count": scanned_count,
                "total_count": total_count,
                "indexed_count": indexed_count,
                "excluded_count": excluded_count,
                "elapsed_seconds": time.monotonic() - started_monotonic,
            }
        )
        return {**manifest, "search_index": result}
    finally:
        if not renamed:
            database.drop_collection(temporary_name)
