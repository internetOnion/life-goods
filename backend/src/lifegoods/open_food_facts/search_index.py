"""Build and maintain the version-pinned OFF search index."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from pymongo import ASCENDING
from pymongo.database import Database

from lifegoods.open_food_facts.dataset import VERSIONS_COLLECTION
from lifegoods.open_food_facts.search_text import (
    brand_values,
    country_display_values,
    country_values,
    text_values,
    tokens,
)

SEARCH_COLLECTION_PREFIX = "off_product_search_"
SEARCH_SCHEMA_VERSION = 1


def index_document(product: dict[str, Any]) -> dict[str, Any] | None:
    code = product.get("code")
    if not isinstance(code, str) or not code.strip():
        return None
    names = text_values(product, "product_name")
    brands = brand_values(product)
    countries = country_values(product)
    return {
        "_id": code,
        "code": code,
        "name_values": names,
        "name_tokens": sorted({token for value in names for token in tokens(value)}),
        "brand_values": brands,
        "brand_tokens": sorted({token for value in brands for token in tokens(value)}),
        "country_values": countries,
        "country_display_values": country_display_values(product),
        "name_sort": names[0] if names else "",
    }


def search_collection_name(version_id: str) -> str:
    return f"{SEARCH_COLLECTION_PREFIX}{version_id}"


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
        batch: list[dict[str, Any]] = []
        for product in database[source_collection_name].find({}):
            indexed = indexer(product)
            if indexed is None:
                continue
            batch.append(indexed)
            if len(batch) >= 1_000:
                target.insert_many(batch)
                indexed_count += len(batch)
                batch.clear()
        if batch:
            target.insert_many(batch)
            indexed_count += len(batch)
        target.create_index([("name_tokens", ASCENDING)], name="ix_search_name_tokens")
        target.create_index([("brand_tokens", ASCENDING)], name="ix_search_brand_tokens")
        target.create_index([("country_values", ASCENDING)], name="ix_search_country_values")
        target.create_index([("name_sort", ASCENDING), ("code", ASCENDING)], name="ix_search_sort")
        target.rename(target_name, dropTarget=True)
        renamed = True
        result = {
            "schema_version": SEARCH_SCHEMA_VERSION,
            "collection_name": target_name,
            "document_count": indexed_count,
            "status": "READY",
        }
        database[VERSIONS_COLLECTION].update_one(
            {"_id": version_id}, {"$set": {"search_index": result}}
        )
        return {**manifest, "search_index": result}
    finally:
        if not renamed:
            database.drop_collection(temporary_name)
