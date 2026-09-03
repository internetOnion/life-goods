from fastapi import Request

from lifegoods.package_matches.rate_limit import PackageMatchRateLimiter
from lifegoods.package_matches.search import PackageSearch
from lifegoods.package_matches.service import FindPackageMatches


def get_finder() -> FindPackageMatches:
    raise RuntimeError("Package Match application dependency is not configured")


def get_rate_limiter() -> PackageMatchRateLimiter:
    raise RuntimeError("Package Match rate limiter dependency is not configured")


def get_searcher() -> PackageSearch:
    raise RuntimeError("Package search dependency is not configured")


def get_search_rate_limiter() -> PackageMatchRateLimiter:
    raise RuntimeError("Package search rate limiter dependency is not configured")


def client_identifier(request: Request) -> str:
    if request.client:
        return request.client.host
    return "unknown"
