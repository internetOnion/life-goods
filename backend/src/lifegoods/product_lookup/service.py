from dataclasses import dataclass
from typing import Literal

from lifegoods.identifiers import normalize_identifier
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


class LookupProduct:
    def __init__(
        self,
        source: RawProductLookupSource,
        cache: ProductLookupCache,
    ) -> None:
        self._source = source
        self._cache = cache

    def execute(self, entered_barcode: str) -> ProductLookupResult:
        identifier = normalize_identifier(entered_barcode)
        snapshot = self._source.resolve_product_lookup_snapshot()
        cached = self._cache.get(snapshot.version, identifier)
        if cached is not None:
            return ProductLookupResult(
                barcode=identifier.value,
                source_record=cached.source_record,
                dataset=snapshot,
                cache_status="hit",
            )
        source_record = self._source.fetch_source_record(identifier, snapshot)
        self._cache.put(
            snapshot.version,
            identifier,
            ProductLookupCacheEntry(source_record=source_record),
        )
        return ProductLookupResult(
            barcode=identifier.value,
            source_record=source_record,
            dataset=snapshot,
            cache_status="miss",
        )
