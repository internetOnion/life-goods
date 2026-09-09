from __future__ import annotations

from lifegoods.product_search.contracts import (
    ProductSearchDataResponse,
    ProductSearchErrorCode,
    ProductSearchErrorDetail,
    ProductSearchErrorResponse,
    ProductSearchMetaResponse,
    ProductSearchResponse,
    ProductSummary,
    SearchPaginationMetaResponse,
)
from lifegoods.product_search.metrics import (
    NoOpProductSearchMetrics,
    ProductSearchMetrics,
)
from lifegoods.product_search.query import (
    InvalidCursorError,
    ParsedSearchQuery,
    QueryClassification,
    QueryValidationError,
    SearchCursor,
    decode_and_validate_cursor,
    encode_cursor,
    extract_terms,
    normalize_search_value,
    parse_and_validate_query,
    query_fingerprint,
)
from lifegoods.product_search.rate_limit import (
    ProductSearchRateLimiter,
    RedisProductSearchRateLimiter,
)
from lifegoods.product_search.router import (
    get_product_search,
    get_product_search_metrics,
    get_product_search_rate_limiter,
)
from lifegoods.product_search.router import router as product_search_router
from lifegoods.product_search.service import (
    ProductSearchResult,
    SearchProducts,
    SearchTimeoutError,
    SearchUnavailableError,
    select_matching_name,
)

__all__ = [
    "InvalidCursorError",
    "NoOpProductSearchMetrics",
    "ParsedSearchQuery",
    "ProductSearchDataResponse",
    "ProductSearchErrorCode",
    "ProductSearchErrorDetail",
    "ProductSearchErrorResponse",
    "ProductSearchMetaResponse",
    "ProductSearchRateLimiter",
    "ProductSearchMetrics",
    "ProductSearchResponse",
    "ProductSearchResult",
    "ProductSummary",
    "QueryClassification",
    "QueryValidationError",
    "RedisProductSearchRateLimiter",
    "SearchCursor",
    "SearchPaginationMetaResponse",
    "SearchProducts",
    "SearchTimeoutError",
    "SearchUnavailableError",
    "decode_and_validate_cursor",
    "encode_cursor",
    "extract_terms",
    "get_product_search",
    "get_product_search_metrics",
    "get_product_search_rate_limiter",
    "normalize_search_value",
    "parse_and_validate_query",
    "product_search_router",
    "query_fingerprint",
    "select_matching_name",
]
