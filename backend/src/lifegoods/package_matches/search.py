"""Compatibility interface for Package Match search.

Implementation is split by responsibility into text normalization, index
maintenance, and the MongoDB search adapter. Existing imports can continue to
use this module while callers learn only the small search interface.
"""

from __future__ import annotations

from typing import Any

from pymongo.database import Database

from lifegoods.package_matches.search_engine import MongoPackageSearch
from lifegoods.package_matches.search_index import (
    SEARCH_COLLECTION_PREFIX,
    SEARCH_SCHEMA_VERSION,
    search_collection_name,
)
from lifegoods.package_matches.search_index import (
    build_search_index as _build_search_index,
)
from lifegoods.package_matches.search_index import (
    index_document as _index_document,
)
from lifegoods.package_matches.search_models import (
    BatchPackageSource,
    PackageSearch,
    SearchHit,
    SearchPage,
    SearchValidationError,
)
from lifegoods.package_matches.search_text import normalize_search_text


def build_search_index(database: Database[dict[str, Any]], version_id: str) -> dict[str, Any]:
    """Build the derived index, retaining the historical import seam."""

    return _build_search_index(database, version_id, indexer=_index_document)


__all__ = [
    "BatchPackageSource",
    "MongoPackageSearch",
    "PackageSearch",
    "SEARCH_COLLECTION_PREFIX",
    "SEARCH_SCHEMA_VERSION",
    "SearchHit",
    "SearchPage",
    "SearchValidationError",
    "build_search_index",
    "normalize_search_text",
    "search_collection_name",
]
