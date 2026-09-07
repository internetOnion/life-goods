from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from lifegoods.core.types import JsonValue
from lifegoods.translation.contracts import (
    OriginalText,
    TranslationFieldStatus,
    TranslationOverallStatus,
)


class ProductLookupDataResponse(BaseModel):
    source_record: dict[str, JsonValue]


class ProductLookupMetadataResponse(BaseModel):
    barcode: str


class SourceAttributionResponse(BaseModel):
    name: str
    product_url: str


class DatasetSnapshotResponse(BaseModel):
    version: str
    retrieved_at: datetime


class TranslationMetadataResponse(BaseModel):
    machine_generated: bool = True
    provider: str
    model: str
    configuration_version: str
    generated_at: str


class TranslationMetaResponse(BaseModel):
    status: TranslationOverallStatus
    metadata: TranslationMetadataResponse | None = None


class ProductLookupMetaResponse(BaseModel):
    lookup: ProductLookupMetadataResponse
    source: SourceAttributionResponse
    dataset: DatasetSnapshotResponse


class ProductProjectionMetaResponse(ProductLookupMetaResponse):
    translation: TranslationMetaResponse = Field(
        default_factory=lambda: TranslationMetaResponse(
            status=TranslationOverallStatus.NOT_REQUESTED
        )
    )


class ProductLookupResponse(BaseModel):
    data: ProductLookupDataResponse
    meta: ProductLookupMetaResponse


type NutritionAmount = float | int | str


class TranslatableField(BaseModel):
    """Original Text and its independent Khmer Translation outcome.

    generated selects khmer_translation. source_khmer_available selects Khmer
    Original Text; original_text_preserved selects intentionally unchanged text.
    translation_unavailable and not_requested retain Original Text.
    source_data_unavailable has no source text to display.
    """

    original_texts: list[OriginalText] = Field(default_factory=list)
    selected_original_text: OriginalText | None = None
    translation_status: TranslationFieldStatus = TranslationFieldStatus.NOT_REQUESTED
    khmer_translation: str | None = None


class TranslatableTextItem(TranslatableField):
    key: str


class StorageInstructionItem(TranslatableTextItem):
    pass


class SourceImage(BaseModel):
    url: str
    language: str | None = None
    source_field: str


class ProductIdentityProjection(BaseModel):
    barcode: str | None = None
    preferred_name: OriginalText | None = None
    names: list[OriginalText] = Field(default_factory=list)
    generic_names: list[OriginalText] = Field(default_factory=list)
    name: TranslatableField = Field(default_factory=TranslatableField)
    generic_name: TranslatableField = Field(default_factory=TranslatableField)
    brands: list[str] = Field(default_factory=list)
    quantity: str | None = None


class NutritionRow(BaseModel):
    nutrient: str
    label: str
    per_100g: NutritionAmount | None = None
    per_serving: NutritionAmount | None = None
    value: NutritionAmount | None = None
    unit: str | None = None


class NutritionProjection(BaseModel):
    basis: str | None = None
    serving_size: str | None = None
    rows: list[NutritionRow] = Field(default_factory=list)


class GradedSourceAssessment(BaseModel):
    grade: str | None = None
    score: NutritionAmount | None = None
    version: str | None = None
    source_fields: list[str] = Field(default_factory=list)


class NovaSourceAssessment(BaseModel):
    group: NutritionAmount
    source_field: str


class SourceAssessmentsProjection(BaseModel):
    nutri_score: GradedSourceAssessment | None = None
    nova: NovaSourceAssessment | None = None
    green_score: GradedSourceAssessment | None = None


class PackagingComponent(BaseModel):
    shape: str | None = None
    material: str | None = None
    recycling: str | None = None
    quantity_per_unit: str | None = None
    weight_measured: NutritionAmount | None = None
    number_of_units: NutritionAmount | None = None


class PackagingProjection(BaseModel):
    description_items: list[TranslatableTextItem] = Field(default_factory=list)
    recycling_instruction_items: list[TranslatableTextItem] = Field(default_factory=list)
    texts: list[OriginalText] = Field(default_factory=list)
    recycling_instructions: list[OriginalText] = Field(default_factory=list)
    components: list[PackagingComponent] = Field(default_factory=list)
    materials: list[str] = Field(default_factory=list)
    shapes: list[str] = Field(default_factory=list)
    recycling: list[str] = Field(default_factory=list)


class EnvironmentProjection(BaseModel):
    origins: list[str] = Field(default_factory=list)
    manufacturing_places: list[str] = Field(default_factory=list)
    carbon_footprint_100g: NutritionAmount | None = None
    carbon_footprint_from_known_ingredients_100g: NutritionAmount | None = None
    carbon_footprint_from_meat_or_fish_100g: NutritionAmount | None = None


class SourceRecordMetadataProjection(BaseModel):
    name: str | None = None
    product_url: str | None = None
    dataset_version: str | None = None
    retrieved_at: str | None = None
    record_language: str | None = None
    languages: list[str] = Field(default_factory=list)
    creator: str | None = None
    created_at: str | None = None
    last_modified_at: str | None = None
    completeness: float | None = None
    data_quality_warnings: list[str] = Field(default_factory=list)


class ProductProjection(BaseModel):
    identity: ProductIdentityProjection
    front_image: SourceImage | None = None
    ingredients: list[OriginalText] = Field(default_factory=list)
    ingredients_text: TranslatableField = Field(default_factory=TranslatableField)
    additives: list[str] = Field(default_factory=list)
    storage_instructions: list[OriginalText] = Field(default_factory=list)
    storage_instruction_items: list[StorageInstructionItem] = Field(default_factory=list)
    nutrition: NutritionProjection
    assessments: SourceAssessmentsProjection
    categories: list[str] = Field(default_factory=list)
    categories_text: TranslatableField = Field(default_factory=TranslatableField)
    category_items: list[TranslatableTextItem] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    packaging: PackagingProjection
    environment: EnvironmentProjection
    source: SourceRecordMetadataProjection


class ProductProjectionData(BaseModel):
    product: ProductProjection


class ProductProjectionResponse(BaseModel):
    data: ProductProjectionData
    meta: ProductProjectionMetaResponse


class ProductLookupErrorCode(StrEnum):
    INVALID_BARCODE = "invalid_barcode"
    PRODUCT_NOT_FOUND = "product_not_found"
    DATASET_UNAVAILABLE = "dataset_unavailable"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INTERNAL_ERROR = "internal_error"
    UNSUPPORTED_LANGUAGE = "unsupported_language"


class ProductLookupErrorDetail(BaseModel):
    code: ProductLookupErrorCode
    message: str


class ProductLookupErrorMetaResponse(BaseModel):
    dataset: DatasetSnapshotResponse


class ProductLookupErrorResponse(BaseModel):
    error: ProductLookupErrorDetail
    meta: ProductLookupErrorMetaResponse | None = None
