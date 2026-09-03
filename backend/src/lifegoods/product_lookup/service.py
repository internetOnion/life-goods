from dataclasses import dataclass
from typing import Literal

from lifegoods.product_lookup.barcode import normalize_barcode
from lifegoods.product_lookup.cache import (
    ProductLookupCache,
    ProductLookupCacheEntry,
)
from lifegoods.product_lookup.contracts import (
    DatasetSnapshotResponse,
    ProductLookupMetadataResponse,
    ProductLookupMetaResponse,
    ProductProjection,
    SourceAttributionResponse,
)
from lifegoods.product_lookup.models import (
    DatasetSnapshot,
    RawProductLookupSource,
    SourceRecord,
)
from lifegoods.product_lookup.projection import project_source_record

type CacheStatus = Literal["hit", "miss"]


@dataclass(frozen=True, slots=True)
class ProductLookupResult:
    barcode: str
    source_record: SourceRecord | None
    dataset: DatasetSnapshot
    cache_status: CacheStatus
    product: ProductProjection | None = None


class LookupProduct:
    def __init__(
        self,
        source: RawProductLookupSource,
        cache: ProductLookupCache,
    ) -> None:
        self._source = source
        self._cache = cache

    def execute(self, entered_barcode: str) -> ProductLookupResult:
        identifier = normalize_barcode(entered_barcode)
        snapshot = self._source.resolve_product_lookup_snapshot()
        cached = self._cache.get(snapshot.version, identifier)
        if cached is not None:
            source_record = cached.source_record
            cache_status: CacheStatus = "hit"
        else:
            source_record = self._source.fetch_source_record(identifier, snapshot)
            self._cache.put(
                snapshot.version,
                identifier,
                ProductLookupCacheEntry(source_record=source_record),
            )
            cache_status = "miss"

        product: ProductProjection | None = None
        if source_record is not None:
            meta = ProductLookupMetaResponse(
                lookup=ProductLookupMetadataResponse(barcode=identifier.value),
                source=SourceAttributionResponse(
                    name="Open Food Facts",
                    product_url="https://world.openfoodfacts.org/product/" + identifier.value,
                ),
                dataset=DatasetSnapshotResponse(
                    version=snapshot.version,
                    retrieved_at=snapshot.retrieved_at,
                ),
            )
            product = project_source_record(source_record, meta=meta)

        return ProductLookupResult(
            barcode=identifier.value,
            source_record=source_record,
            dataset=snapshot,
            cache_status=cache_status,
            product=product,
        )
