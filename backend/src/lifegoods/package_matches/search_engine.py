"""MongoDB-backed search implementation."""

from __future__ import annotations

import re
from collections.abc import Iterable
from contextlib import suppress
from typing import Any, cast

from pymongo import ASCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError

from lifegoods.identifiers import InvalidIdentifierError, NormalizedIdentifier, normalize_identifier
from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
    ExternalLookupResult,
    ExternalPackageFound,
    ExternalPackageSource,
    ExternalPackageUnavailable,
)
from lifegoods.package_matches.models import PackageMatchSourceUnavailableError
from lifegoods.package_matches.search_index import dataset_version_from_manifest
from lifegoods.package_matches.search_models import BatchPackageSource, SearchHit, SearchPage
from lifegoods.package_matches.search_text import match_fields, normalize_search_text, tokens


class MongoPackageSearch:
    def __init__(self, source: ExternalPackageSource) -> None:
        self._source = source
        database = getattr(source, "database", None)
        if database is None:
            raise ValueError("The dataset source must expose its MongoDB database")
        self._database: Database[dict[str, Any]] = database

    def search(self, query: str, *, page: int, page_size: int) -> SearchPage:
        normalized_query = normalize_search_text(query)
        query_tokens = tokens(normalized_query)
        if not query_tokens:
            return SearchPage(results=(), has_more=False)
        index_name, dataset_version = self._ready_search_index()

        token_regexes = [f"^{re.escape(token)}" for token in query_tokens]
        identifier = None
        with suppress(InvalidIdentifierError):
            identifier = normalize_identifier(normalized_query)
        name_clause = {
            "$and": [
                {"name_tokens": {"$elemMatch": {"$regex": pattern}}} for pattern in token_regexes
            ]
        }
        brand_clause = {
            "$and": [
                {"brand_tokens": {"$elemMatch": {"$regex": pattern}}} for pattern in token_regexes
            ]
        }
        try:
            collection = self._database[index_name]
            window = (page - 1) * page_size + page_size
            indexed: list[dict[str, Any]] = []
            clauses: list[dict[str, Any]] = []
            if identifier is not None:
                clauses.append({"_id": identifier.value})
            clauses.extend(({"country_values": normalized_query}, name_clause, brand_clause))
            for clause in clauses:
                indexed.extend(
                    collection.find(clause)
                    .sort([("name_sort", ASCENDING), ("code", ASCENDING)])
                    .limit(window + 1)
                )
        except (PyMongoError, TypeError, ValueError) as error:
            raise PackageMatchSourceUnavailableError("search index unavailable") from error

        ranked: list[tuple[tuple[int, int, str, str], str, tuple[str, ...], tuple[str, ...]]] = []
        unique_indexed = {item.get("code"): item for item in indexed if item.get("code")}
        for item in unique_indexed.values():
            if identifier is not None and item.get("code") == identifier.value:
                matched, rank = ("identifier",), -1
            else:
                matched, rank = match_fields(item, normalized_query, query_tokens)
            if not matched:
                continue
            code = item.get("code")
            if not isinstance(code, str):
                continue
            ranked.append(
                (
                    (rank, -len(matched), str(item.get("name_sort", "")), code),
                    code,
                    matched,
                    tuple(item.get("country_display_values", ())),
                )
            )
        ranked.sort(key=lambda value: value[0])
        start = (page - 1) * page_size
        selected = ranked[start : start + page_size]
        selected_identifiers: list[
            tuple[str, tuple[str, ...], tuple[str, ...], NormalizedIdentifier]
        ] = []
        for _, code, matched, made_in in selected:
            with suppress(InvalidIdentifierError):
                selected_identifiers.append(
                    (code, matched, made_in, normalize_identifier(code))
                )

        results: list[SearchHit] = []
        batch_fetch = cast(BatchPackageSource | None, getattr(self._source, "fetch_many", None))
        fetched_results: Iterable[
            tuple[
                tuple[str, tuple[str, ...], tuple[str, ...], NormalizedIdentifier],
                ExternalLookupResult,
            ]
        ]
        if callable(batch_fetch):
            try:
                fetched = batch_fetch(
                    dataset_version.id,
                    tuple(item[3] for item in selected_identifiers),
                )
            except (PyMongoError, TypeError, ValueError) as error:
                raise PackageMatchSourceUnavailableError("search dataset unavailable") from error
            if len(fetched) != len(selected_identifiers):
                raise PackageMatchSourceUnavailableError("search dataset unavailable")
            fetched_results = zip(selected_identifiers, fetched, strict=True)
        else:
            fetched_results = (
                (selected_item, self._source.fetch(selected_item[3]))
                for selected_item in selected_identifiers
            )
        try:
            for (_, matched, made_in, _), result in fetched_results:
                if isinstance(result, ExternalPackageUnavailable):
                    raise PackageMatchSourceUnavailableError("search dataset unavailable")
                if isinstance(result, ExternalPackageFound):
                    results.append(SearchHit(result.record, matched, made_in))
        except (PyMongoError, TypeError, ValueError) as error:
            raise PackageMatchSourceUnavailableError("search dataset unavailable") from error
        return SearchPage(
            results=tuple(results),
            has_more=(
                len(ranked) > start + page_size
                or len(unique_indexed) > (page - 1) * page_size + page_size
            ),
            dataset_version=dataset_version,
        )

    def _ready_search_index(self) -> tuple[str, Any]:
        try:
            pointer = self._database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID})
            version_id = pointer.get("active_version_id") if pointer else None
            manifest = (
                self._database[VERSIONS_COLLECTION].find_one({"_id": version_id})
                if isinstance(version_id, str)
                else None
            )
            if not isinstance(manifest, dict):
                raise PackageMatchSourceUnavailableError("active dataset unavailable")
            search_index = manifest.get("search_index")
            if not isinstance(search_index, dict):
                raise PackageMatchSourceUnavailableError("search index unavailable")
            index_name = search_index.get("collection_name")
            if (
                not isinstance(index_name, str)
                or search_index.get("status") != "READY"
                or index_name not in self._database.list_collection_names()
            ):
                raise PackageMatchSourceUnavailableError("search index unavailable")
            return index_name, dataset_version_from_manifest(manifest)
        except PackageMatchSourceUnavailableError:
            raise
        except (PyMongoError, TypeError, ValueError) as error:
            raise PackageMatchSourceUnavailableError("search dataset unavailable") from error


__all__ = ["MongoPackageSearch"]
