from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from lifegoods.product_lookup.contracts import (
    DatasetSnapshotResponse,
    ProductLookupErrorMetaResponse,
    ProductSummary,
    SourceAttributionResponse,
)

PRODUCT_SEARCH_PAGE_SIZE = 10


class ProductSearchDataResponse(BaseModel):
    products: list[ProductSummary] = Field(default_factory=list)


class SearchPaginationMetaResponse(BaseModel):
    next_cursor: str | None = None


class ProductSearchMetaResponse(BaseModel):
    source: SourceAttributionResponse
    dataset: DatasetSnapshotResponse
    pagination: SearchPaginationMetaResponse = Field(
        default_factory=SearchPaginationMetaResponse
    )


class ProductSearchResponse(BaseModel):
    data: ProductSearchDataResponse
    meta: ProductSearchMetaResponse


class ProductSearchErrorCode(StrEnum):
    INVALID_QUERY = "invalid_query"
    INVALID_BARCODE = "invalid_barcode"
    INVALID_CURSOR = "invalid_cursor"
    SEARCH_UNAVAILABLE = "search_unavailable"
    SEARCH_TIMEOUT = "search_timeout"
    DATASET_UNAVAILABLE = "dataset_unavailable"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INTERNAL_ERROR = "internal_error"


class ProductSearchErrorDetail(BaseModel):
    code: ProductSearchErrorCode
    message: str


class ProductSearchErrorResponse(BaseModel):
    error: ProductSearchErrorDetail
    meta: ProductLookupErrorMetaResponse | None = None
