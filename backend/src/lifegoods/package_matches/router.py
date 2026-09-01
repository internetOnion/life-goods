from fastapi import APIRouter

from lifegoods.package_matches.dependencies import (
    get_finder,
    get_rate_limiter,
    get_search_rate_limiter,
    get_searcher,
)
from lifegoods.package_matches.match_routes import _candidate_response
from lifegoods.package_matches.match_routes import router as match_router
from lifegoods.package_matches.search_routes import router as search_router

router = APIRouter(prefix="/api/v1", tags=["Package Matches"])
router.include_router(match_router)
router.include_router(search_router)

__all__ = [
    "_candidate_response",
    "get_finder",
    "get_rate_limiter",
    "get_search_rate_limiter",
    "get_searcher",
    "router",
]
