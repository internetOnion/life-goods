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
    ParsedSearchQuery,
    QueryClassification,
    QueryValidationError,
    extract_terms,
    parse_and_validate_query,
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
    SearchUnavailableError,
)

__all__ = [
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
    "SearchPaginationMetaResponse",
    "SearchProducts",
    "SearchUnavailableError",
    "extract_terms",
    "get_product_search",
    "get_product_search_metrics",
    "get_product_search_rate_limiter",
    "parse_and_validate_query",
    "product_search_router",
]
