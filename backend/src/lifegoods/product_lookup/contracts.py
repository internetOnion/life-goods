from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel

from lifegoods.core.types import JsonValue


class ProductLookupDataResponse(BaseModel):
    source_record: dict[str, JsonValue]
    allergen_analysis: "AllergenAnalysisResponse"


class OffAllergenAnalysisResponse(BaseModel):
    state: Literal["available", "empty", "missing", "invalid"]
    tags: list[str]


class AllergenInputResponse(BaseModel):
    source_field: str
    language: str


class AllergenEvidenceResponse(BaseModel):
    matched_text: str
    start: int
    end: int
    alias: str
    ingredient_tags: list[str]
    name: str | None
    parents: list[str]
    ambiguous: bool
    allergens: list[dict[str, Any]]


class IngredientMatchingAllergenResponse(BaseModel):
    state: Literal["completed", "unavailable"]
    reason: str | None = None
    quality: Literal["clear", "ambiguous", "insufficient"] | None = None
    tags: list[str]
    evidence: list[AllergenEvidenceResponse]
    limitations: list[str]
    unmatched_texts: list[str]
    input: AllergenInputResponse | None = None
    taxonomy_sha256: str | None = None
    allergen_taxonomy_sha256: str | None = None


class AllergenComparisonResponse(BaseModel):
    state: Literal["available", "unavailable"]
    in_both: list[str]
    off_only: list[str]
    ingredient_matching_only: list[str]
    sets_equal: bool | None


class AllergenAnalysisResponse(BaseModel):
    off: OffAllergenAnalysisResponse
    ingredient_matching: IngredientMatchingAllergenResponse
    comparison: AllergenComparisonResponse


class ProductLookupMetadataResponse(BaseModel):
    barcode: str


class SourceAttributionResponse(BaseModel):
    name: str
    product_url: str


class DatasetSnapshotResponse(BaseModel):
    version: str
    retrieved_at: datetime


class ProductLookupMetaResponse(BaseModel):
    lookup: ProductLookupMetadataResponse
    source: SourceAttributionResponse
    dataset: DatasetSnapshotResponse


class ProductLookupResponse(BaseModel):
    data: ProductLookupDataResponse
    meta: ProductLookupMetaResponse


class ProductLookupErrorCode(StrEnum):
    INVALID_BARCODE = "invalid_barcode"
    PRODUCT_NOT_FOUND = "product_not_found"
    DATASET_UNAVAILABLE = "dataset_unavailable"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INTERNAL_ERROR = "internal_error"


class ProductLookupErrorDetail(BaseModel):
    code: ProductLookupErrorCode
    message: str


class ProductLookupErrorMetaResponse(BaseModel):
    dataset: DatasetSnapshotResponse


class ProductLookupErrorResponse(BaseModel):
    error: ProductLookupErrorDetail
    meta: ProductLookupErrorMetaResponse | None = None
