"""Build and maintain the version-pinned OFF search index."""

from __future__ import annotations

import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pymongo import ASCENDING
from pymongo.database import Database

from lifegoods.identifiers import InvalidIdentifierError, normalize_identifier
from lifegoods.product_lookup.projection import (
    extract_brands,
    extract_front_image,
    extract_preferred_name,
    extract_product_names,
    extract_quantity,
)

SEARCH_COLLECTION_PREFIX = "off_product_search_"
SEARCH_SCHEMA_VERSION = 1
VERSIONS_COLLECTION = "off_dataset_versions"
REQUIRED_SEARCH_INDEXES = frozenset(
    {"ix_search_name_tokens", "ix_search_brand_tokens", "ix_search_sort"}
)


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
        normalize_search_value(n.value)
        for n in names
        if normalize_search_value(n.value)
    ]
    name_tokens = sorted({token for n in names for token in extract_terms(n.value)})
    names_data = [
        {"value": n.value, "language": n.language, "source_field": n.source_field}
        for n in names
    ]

    preferred = extract_preferred_name(product, record_language)
    name_sort = normalize_search_value(preferred.value)[:100] if preferred else ""

    brands_list = extract_brands(product)
    brand_values = [
        normalize_search_value(b)
        for b in brands_list
        if normalize_search_value(b)
    ]
    brand_tokens = sorted({token for b in brands_list for token in extract_terms(b)})

    quantity = extract_quantity(product)
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

    return {
        "_id": code,
        "code": code,
        "record_language": record_language,
        "name_values": name_values,
        "name_tokens": name_tokens,
        "brand_values": brand_values,
        "brand_tokens": brand_tokens,
        "names": names_data,
        "name_sort": name_sort,
        "brands": brands_list,
        "quantity": quantity,
        "thumbnail": thumbnail_data,
    }


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

    return target_name


def build_search_index(
    database: Database[dict[str, Any]],
    version_id: str,
    *,
    indexer: Callable[[dict[str, Any]], dict[str, Any] | None] = index_document,
) -> dict[str, Any]:
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
    try:
        target = database[temporary_name]
        indexed_count = 0
        excluded_count = 0
        batch: list[dict[str, Any]] = []
        for product in database[source_collection_name].find({}):
            indexed = indexer(product)
            if indexed is None:
                excluded_count += 1
                continue
            batch.append(indexed)
            if len(batch) >= 1_000:
                target.insert_many(batch)
                indexed_count += len(batch)
                batch.clear()
        if batch:
            target.insert_many(batch)
            indexed_count += len(batch)
            batch.clear()
        target.create_index([("name_tokens", ASCENDING)], name="ix_search_name_tokens")
        target.create_index([("brand_tokens", ASCENDING)], name="ix_search_brand_tokens")
        target.create_index(
            [("name_sort", ASCENDING), ("code", ASCENDING)], name="ix_search_sort"
        )
        target.rename(target_name, dropTarget=True)
        renamed = True
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
        return {**manifest, "search_index": result}
    finally:
        if not renamed:
            database.drop_collection(temporary_name)
