from __future__ import annotations

from dataclasses import dataclass

from lifegoods.product_lookup.models import (
    DatasetSnapshot,
    RawProductLookupSource,
)
from lifegoods.product_lookup.projection import project_product_summary
from lifegoods.product_search.contracts import ProductSummary
from lifegoods.product_search.query import (
    ParsedSearchQuery,
    QueryClassification,
)


@dataclass(frozen=True, slots=True)
class ProductSearchResult:
    products: list[ProductSummary]
    dataset: DatasetSnapshot


class SearchUnavailableError(Exception):
    """Raised when text search is requested in this intermediate slice."""

    def __init__(self, message: str, dataset: DatasetSnapshot | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.dataset = dataset


class SearchProducts:
    def __init__(self, source: RawProductLookupSource) -> None:
        self._source = source

    def execute(self, query: ParsedSearchQuery) -> ProductSearchResult:
        snapshot = self._source.resolve_product_lookup_snapshot()

        if query.classification == QueryClassification.TEXT:
            raise SearchUnavailableError(
                "Text search is temporarily unavailable",
                dataset=snapshot,
            )

        assert query.normalized_barcode is not None
        source_record = self._source.fetch_source_record(
            query.normalized_barcode, snapshot
        )

        products: list[ProductSummary] = []
        if source_record is not None:
            products.append(
                project_product_summary(
                    source_record, barcode=query.normalized_barcode.value
                )
            )

        return ProductSearchResult(products=products, dataset=snapshot)
