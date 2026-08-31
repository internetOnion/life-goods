"""OFF-only Package search use case and API contract."""

from lifegoods.package_search.contracts import (
    PackageSearchEvidenceResponse,
    PackageSearchResponse,
    PackageSearchResultResponse,
)
from lifegoods.package_search.router import get_rate_limiter, get_searcher, router
from lifegoods.package_search.service import SearchPackages

__all__ = [
    "PackageSearchEvidenceResponse",
    "PackageSearchResponse",
    "PackageSearchResultResponse",
    "SearchPackages",
    "get_rate_limiter",
    "get_searcher",
    "router",
]
