from __future__ import annotations

from dataclasses import dataclass
from typing import Any, NamedTuple, Protocol, runtime_checkable

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

    earlier_terms = set(query_terms[:-1])
    final_term = query_terms[-1] if query_terms else None

    class _NameScore(NamedTuple):
        total: int
        complete: int

    scores: list[_NameScore] = []
    for item in names:
        val = item.get("value", "")
        item_terms = set(extract_terms(val))

        complete_matches = len({t for t in earlier_terms if t in item_terms})
        prefix_matches = 0

        if final_term is not None:
            if final_term in item_terms:
                if final_term not in earlier_terms:
                    complete_matches += 1
            elif any(tok.startswith(final_term) for tok in item_terms):
                prefix_matches += 1

        total_matches = complete_matches + prefix_matches
        scores.append(_NameScore(total=total_matches, complete=complete_matches))

    max_total = max((score.total for score in scores), default=0)
    if max_total > 0:
        top_candidates = [
            (names[i], scores[i]) for i, score in enumerate(scores) if score.total == max_total
        ]
        max_complete = max(score.complete for _, score in top_candidates)
        candidates = [c for c, score in top_candidates if score.complete == max_complete]
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

    def execute(self, query: ParsedSearchQuery, cursor: str | None = None) -> ProductSearchResult:
        snapshot = self._source.resolve_product_lookup_snapshot()

        if query.classification == QueryClassification.BARCODE:
            if cursor is not None:
                raise InvalidCursorError("Pagination cursor is invalid")

            assert query.normalized_barcode is not None
            source_record = self._source.fetch_source_record(query.normalized_barcode, snapshot)

            products: list[ProductSummary] = []
            if source_record is not None:
                products.append(
                    project_product_summary(source_record, barcode=query.normalized_barcode.value)
                )

            return ProductSearchResult(products=products, dataset=snapshot, next_cursor=None)

        assert query.classification == QueryClassification.TEXT

        search_cursor: SearchCursor | None = None
        if cursor is not None:
            search_cursor = decode_and_validate_cursor(cursor, expected_terms=query.terms)

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
                    generic_name=doc.get("generic_name"),
                    brands=doc.get("brands", []),
                    manufacturing_places=doc.get("manufacturing_places", []),
                    quantity=doc.get("quantity"),
                    packaging=doc.get("packaging"),
                    labels=doc.get("labels", []),
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
