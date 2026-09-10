from dataclasses import dataclass
from typing import Literal

from lifegoods.identifiers import normalize_identifier
from lifegoods.product_lookup.allergen_analysis import (
    IngredientMatcherProtocol,
    ProductAllergenAnalyzer,
)
from lifegoods.product_lookup.cache import (
    ProductLookupCache,
    ProductLookupCacheEntry,
)
from lifegoods.product_lookup.models import (
    DatasetSnapshot,
    RawProductLookupSource,
    SourceRecord,
)

type CacheStatus = Literal["hit", "miss"]


@dataclass(frozen=True, slots=True)
class ProductLookupResult:
    barcode: str
    source_record: SourceRecord | None
    dataset: DatasetSnapshot
    cache_status: CacheStatus
    allergen_analysis: dict[str, object] | None = None


class LookupProduct:
    def __init__(
        self,
        source: RawProductLookupSource,
        cache: ProductLookupCache,
        ingredient_matcher: IngredientMatcherProtocol | None = None,
    ) -> None:
        self._source = source
        self._cache = cache
        self._allergen_analyzer = (
            ProductAllergenAnalyzer(ingredient_matcher)
            if ingredient_matcher is not None
            else None
        )

    def execute(self, entered_barcode: str) -> ProductLookupResult:
        identifier = normalize_identifier(entered_barcode)
        snapshot = self._source.resolve_product_lookup_snapshot()
        cached = self._cache.get(snapshot.version, identifier)
        if cached is not None:
            analysis = (
                self._allergen_analyzer.analyze(cached.source_record)
                if cached.source_record is not None and self._allergen_analyzer is not None
                else None
            )
            return ProductLookupResult(
                barcode=identifier.value,
                source_record=cached.source_record,
                dataset=snapshot,
                cache_status="hit",
                allergen_analysis=analysis,
            )
        source_record = self._source.fetch_source_record(identifier, snapshot)
        self._cache.put(
            snapshot.version,
            identifier,
            ProductLookupCacheEntry(source_record=source_record),
        )
        analysis = (
            self._allergen_analyzer.analyze(source_record)
            if source_record is not None and self._allergen_analyzer is not None
            else None
        )
        return ProductLookupResult(
            barcode=identifier.value,
            source_record=source_record,
            dataset=snapshot,
            cache_status="miss",
            allergen_analysis=analysis,
        )
