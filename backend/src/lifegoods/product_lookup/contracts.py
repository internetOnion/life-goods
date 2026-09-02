from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel

from lifegoods.core.types import JsonValue


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
