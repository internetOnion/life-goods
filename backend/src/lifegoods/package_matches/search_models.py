"""Small interfaces and value objects shared by Package Match search modules."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from lifegoods.identifiers import NormalizedIdentifier
from lifegoods.open_food_facts import (
    ExternalLookupResult,
    ExternalPackageRecord,
)
from lifegoods.open_food_facts.models import ExternalDatasetVersion


@dataclass(frozen=True, slots=True)
class SearchHit:
    record: ExternalPackageRecord
    matched_fields: tuple[str, ...]
    made_in: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class SearchPage:
    results: tuple[SearchHit, ...]
    has_more: bool
    dataset_version: ExternalDatasetVersion | None = None


class SearchValidationError(ValueError):
    pass


class PackageSearch(Protocol):
    def search(self, query: str, *, page: int, page_size: int) -> SearchPage: ...


class BatchPackageSource(Protocol):
    def fetch_many(
        self,
        version_id: str,
        identifiers: tuple[NormalizedIdentifier, ...],
    ) -> tuple[ExternalLookupResult, ...]: ...


__all__ = [
    "BatchPackageSource",
    "PackageSearch",
    "SearchHit",
    "SearchPage",
    "SearchValidationError",
]
