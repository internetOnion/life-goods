from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from lifegoods.generated_data.coordinator import TranslationCoordinator
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
    TranslatableField,
    TranslationFieldStatus,
    TranslationMetadataResponse,
    TranslationMetaResponse,
    TranslationOverallStatus,
)
from lifegoods.product_lookup.models import (
    DatasetSnapshot,
    RawProductLookupSource,
    SourceRecord,
)
from lifegoods.product_lookup.projection import project_source_record
from lifegoods.translation.contracts import (
    FieldTranslationOutcome,
    ProductTranslationResult,
)
from lifegoods.translation.selection import ELIGIBLE_FIELDS, unavailable_result

type CacheStatus = Literal["hit", "miss"]


@dataclass(frozen=True, slots=True)
class ProductLookupResult:
    barcode: str
    source_record: SourceRecord | None
    dataset: DatasetSnapshot
    cache_status: CacheStatus
    product: ProductProjection | None = None
    translation: TranslationMetaResponse | None = None


def mark_product_translation_unavailable(
    product: ProductProjection,
) -> tuple[ProductProjection, TranslationMetaResponse]:
    return apply_translation_to_product(product, unavailable_result(product))


def _apply_field_outcome(
    target: TranslatableField, outcome: FieldTranslationOutcome | None
) -> None:
    if outcome:
        target.original_texts = outcome.original_texts
        target.selected_original_text = outcome.selected_original_text
        target.translation_status = outcome.status
        target.khmer_translation = outcome.khmer_translation


def apply_translation_to_product(
    product: ProductProjection,
    translation: ProductTranslationResult,
) -> tuple[ProductProjection, TranslationMetaResponse]:
    for field in ELIGIBLE_FIELDS:
        _apply_field_outcome(field.target(product), translation.fields.get(field.name))

    for item in product.storage_instruction_items:
        _apply_field_outcome(item, translation.fields.get(item.key))

    meta_metadata: TranslationMetadataResponse | None = None
    if translation.provenance is not None and any(
        f.status == TranslationFieldStatus.GENERATED and f.khmer_translation
        for f in translation.fields.values()
    ):
        meta_metadata = TranslationMetadataResponse(
            machine_generated=translation.provenance.machine_generated,
            provider=translation.provenance.provider,
            model=translation.provenance.model,
            configuration_version=translation.provenance.configuration_version,
            generated_at=translation.provenance.generated_at,
        )

    translation_meta = TranslationMetaResponse(
        status=translation.overall_status,
        metadata=meta_metadata,
    )
    return product, translation_meta


class LookupProduct:
    def __init__(
        self,
        source: RawProductLookupSource,
        cache: ProductLookupCache,
        coordinator: TranslationCoordinator | None = None,
    ) -> None:
        self._source = source
        self._cache = cache
        self._coordinator = coordinator

    def execute(
        self,
        entered_barcode: str,
        *,
        language: str | None = None,
    ) -> ProductLookupResult:
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
        translation_meta: TranslationMetaResponse | None = None
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

            if language == "kh":
                if self._coordinator is not None:
                    try:
                        translation_result = self._coordinator.get_or_generate_translation(
                            product, target_language="kh"
                        )
                        product, translation_meta = apply_translation_to_product(
                            product, translation_result
                        )
                    except Exception:
                        product, translation_meta = mark_product_translation_unavailable(product)
                else:
                    product, translation_meta = mark_product_translation_unavailable(product)
            else:
                translation_meta = TranslationMetaResponse(
                    status=TranslationOverallStatus.NOT_REQUESTED
                )

        return ProductLookupResult(
            barcode=identifier.value,
            source_record=source_record,
            dataset=snapshot,
            cache_status=cache_status,
            product=product,
            translation=translation_meta,
        )
