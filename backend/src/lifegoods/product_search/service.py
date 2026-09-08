from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from lifegoods.open_food_facts.search_index import (
    SearchIndexIncompatibleError,
    SearchIndexTimeoutError,
    SearchIndexUnavailableError,
)
from lifegoods.product_lookup.contracts import (
    OriginalText,
    SourceAttributionResponse,
    SourceImage,
)
from lifegoods.product_lookup.models import (
    DatasetSnapshot,
    RawProductLookupSource,
)
from lifegoods.product_lookup.projection import project_product_summary
from lifegoods.product_search.contracts import ProductSummary
from lifegoods.product_search.query import (
    InvalidCursorError,
    ParsedSearchQuery,
    QueryClassification,
    SearchCursor,
    decode_and_validate_cursor,
    encode_cursor,
    extract_terms,
    normalize_search_value,
)


@dataclass(frozen=True, slots=True)
class ProductSearchResult:
    products: list[ProductSummary]
    dataset: DatasetSnapshot
    next_cursor: str | None = None


class SearchUnavailableError(Exception):
    """Raised when text search is unavailable or index is not ready."""

    def __init__(self, message: str, dataset: DatasetSnapshot | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.dataset = dataset


class SearchTimeoutError(Exception):
    """Raised when text search query exceeds execution deadline."""

    def __init__(self, message: str, dataset: DatasetSnapshot | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.dataset = dataset


def select_matching_name(
    names: list[dict[str, Any]],
    query_terms: tuple[str, ...],
    record_language: str | None = None,
) -> OriginalText | None:
    if not names:
        return None

    terms_set = set(query_terms)
    match_counts: list[int] = []
    for item in names:
        val = item.get("value", "")
        item_terms = set(extract_terms(val))
        match_counts.append(len(terms_set.intersection(item_terms)))

    max_matches = max(match_counts, default=0)
    if max_matches > 0:
        candidates = [
            names[i] for i, count in enumerate(match_counts) if count == max_matches
        ]
    else:
        candidates = names

    if record_language:
        for c in candidates:
            if c.get("language") == record_language:
                return OriginalText(
                    value=c["value"],
                    language=c.get("language"),
                    source_field=c.get("source_field", "product_name"),
                )
    for c in candidates:
        if c.get("language") == "en":
            return OriginalText(
                value=c["value"],
                language=c.get("language"),
                source_field=c.get("source_field", "product_name"),
            )

    selected = candidates[0]
    return OriginalText(
        value=selected["value"],
        language=selected.get("language"),
        source_field=selected.get("source_field", "product_name"),
    )


@runtime_checkable
class ProductSearchTextSource(Protocol):
    def search_text(
        self,
        snapshot: DatasetSnapshot,
        terms: tuple[str, ...],
        normalized_query: str,
        cursor: SearchCursor | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]: ...


class SearchProducts:
    def __init__(self, source: RawProductLookupSource) -> None:
        self._source = source

    def execute(
        self, query: ParsedSearchQuery, cursor: str | None = None
    ) -> ProductSearchResult:
        snapshot = self._source.resolve_product_lookup_snapshot()

        if query.classification == QueryClassification.BARCODE:
            if cursor is not None:
                raise InvalidCursorError("Pagination cursor is invalid")

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

            return ProductSearchResult(
                products=products, dataset=snapshot, next_cursor=None
            )

        assert query.classification == QueryClassification.TEXT

        search_cursor: SearchCursor | None = None
        if cursor is not None:
            search_cursor = decode_and_validate_cursor(
                cursor, expected_terms=query.terms
            )

        if not isinstance(self._source, ProductSearchTextSource):
            raise SearchUnavailableError(
                "Text search is temporarily unavailable",
                dataset=snapshot,
            )

        normalized_query = normalize_search_value(query.raw)
        try:
            docs = self._source.search_text(
                snapshot,
                query.terms,
                normalized_query,
                cursor=search_cursor,
                limit=20,
            )
        except (
            SearchUnavailableError,
            SearchIndexUnavailableError,
            SearchIndexIncompatibleError,
        ) as error:
            raise SearchUnavailableError(
                "Text search is temporarily unavailable",
                dataset=snapshot,
            ) from error
        except (SearchTimeoutError, SearchIndexTimeoutError) as error:
            raise SearchTimeoutError(
                "Search request timed out. Please try again.",
                dataset=snapshot,
            ) from error

        has_more = len(docs) > 20
        page_docs = docs[:20] if has_more else docs

        next_cursor: str | None = None
        if has_more:
            last_doc = page_docs[-1]
            next_cursor = encode_cursor(
                terms=query.terms,
                rank=last_doc["rank"],
                name_sort=last_doc.get("name_sort", ""),
                code=last_doc["code"],
            )

        products = []
        for doc in page_docs:
            name_summary = select_matching_name(
                doc.get("names", []),
                query.terms,
                doc.get("record_language"),
            )
            thumbnail_data = doc.get("thumbnail")
            thumbnail = (
                SourceImage(
                    url=thumbnail_data["url"],
                    language=thumbnail_data.get("language"),
                    source_field=thumbnail_data.get(
                        "source_field", "selected_images.front.display"
                    ),
                )
                if thumbnail_data
                else None
            )
            products.append(
                ProductSummary(
                    barcode=doc["code"],
                    name=name_summary,
                    brands=doc.get("brands", []),
                    quantity=doc.get("quantity"),
                    thumbnail=thumbnail,
                    source=SourceAttributionResponse(
                        name="Open Food Facts",
                        product_url=f"https://world.openfoodfacts.org/product/{doc['code']}",
                    ),
                )
            )

        return ProductSearchResult(
            products=products,
            dataset=snapshot,
            next_cursor=next_cursor,
        )
