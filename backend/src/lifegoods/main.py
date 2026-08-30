from collections.abc import Iterator
from typing import Any

import httpx2 as httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pymongo import MongoClient
from scalar_fastapi import get_scalar_api_reference
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from lifegoods.core.concurrency import KeyedSlidingWindowLimiter
from lifegoods.core.errors import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.core.settings import Settings
from lifegoods.identifiers import InvalidIdentifierError
from lifegoods.open_food_facts import (
    ExternalImageSource,
    ExternalPackageSource,
    OpenFoodFactsDatasetSource,
    OpenFoodFactsImageSource,
    get_image_source,
    open_food_facts_image_router,
)
from lifegoods.package_matches import (
    FindPackageMatches,
    PackageMatchSourceUnavailableError,
    get_finder,
    get_rate_limiter,
)
from lifegoods.package_matches import (
    router as package_matches_router,
)
from lifegoods.package_search import (
    SearchPackages,
    get_searcher,
)
from lifegoods.package_search import (
    get_rate_limiter as get_package_search_rate_limiter,
)
from lifegoods.package_search import router as package_search_router

ERROR_MESSAGES: dict[ErrorCode, str] = {
    ErrorCode.IDENTIFIER_REQUIRED: "An identifier is required.",
    ErrorCode.IDENTIFIER_CHARACTERS_INVALID: (
        "The identifier can contain only digits, spaces, or hyphens."
    ),
    ErrorCode.IDENTIFIER_LENGTH_UNSUPPORTED: (
        "The identifier is not a supported GTIN, EAN, or UPC length."
    ),
    ErrorCode.IDENTIFIER_CHECK_DIGIT_INVALID: "The identifier check digit is invalid.",
}


def create_app(
    *,
    settings: Settings | None = None,
    session_factory: sessionmaker[Session] | None = None,
    external_source: ExternalPackageSource | None = None,
    image_source: ExternalImageSource | None = None,
    package_match_limiter: KeyedSlidingWindowLimiter | None = None,
    package_search_limiter: KeyedSlidingWindowLimiter | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    _ = session_factory
    owned_http_clients: list[httpx.Client] = []
    owned_mongo_clients: list[MongoClient[dict[str, Any]]] = []
    resolved_package_match_limiter = (
        package_match_limiter
        or KeyedSlidingWindowLimiter(resolved_settings.package_match_requests_per_minute)
    )
    resolved_package_search_limiter = (
        package_search_limiter
        or KeyedSlidingWindowLimiter(resolved_settings.package_search_requests_per_minute)
    )
    if external_source is None:
        mongo_client: MongoClient[dict[str, Any]] = MongoClient(
            resolved_settings.off_mongodb_uri,
            serverSelectionTimeoutMS=resolved_settings.off_mongodb_timeout_ms,
        )
        owned_mongo_clients.append(mongo_client)
        resolved_source: ExternalPackageSource = OpenFoodFactsDatasetSource(
            mongo_client[resolved_settings.off_mongodb_database],
            image_base_url=resolved_settings.open_food_facts_image_base_url,
        )
    else:
        resolved_source = external_source
    if image_source is None:
        image_http_client = httpx.Client()
        owned_http_clients.append(image_http_client)
        resolved_image_source: ExternalImageSource = OpenFoodFactsImageSource(
            image_http_client,
            image_base_url=resolved_settings.open_food_facts_image_base_url,
            user_agent=resolved_settings.open_food_facts_user_agent,
            timeout_seconds=resolved_settings.open_food_facts_image_timeout_seconds,
            requests_per_minute=resolved_settings.open_food_facts_image_requests_per_minute,
        )
    else:
        resolved_image_source = image_source
    app = FastAPI(title="LifeGoods API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(package_matches_router)
    app.include_router(package_search_router)
    app.include_router(open_food_facts_image_router)

    @app.get("/scalar", include_in_schema=False)
    async def scalar_html() -> HTMLResponse:
        return get_scalar_api_reference(
            openapi_url=app.openapi_url or "/openapi.json",
            title=f"{app.title} - Scalar Reference",
        )

    for owned_http_client in owned_http_clients:
        app.router.add_event_handler("shutdown", owned_http_client.close)
    for owned_mongo_client in owned_mongo_clients:
        app.router.add_event_handler("shutdown", owned_mongo_client.close)

    def provide_finder() -> Iterator[FindPackageMatches]:
        yield FindPackageMatches(resolved_source)

    def provide_searcher() -> Iterator[SearchPackages]:
        yield SearchPackages(resolved_source)  # type: ignore[arg-type]

    app.dependency_overrides[get_finder] = provide_finder
    app.dependency_overrides[get_rate_limiter] = lambda: resolved_package_match_limiter
    app.dependency_overrides[get_searcher] = provide_searcher
    app.dependency_overrides[get_package_search_rate_limiter] = (
        lambda: resolved_package_search_limiter
    )
    app.dependency_overrides[get_image_source] = lambda: resolved_image_source

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        request: Request, _error: RequestValidationError
    ) -> JSONResponse:
        if request.url.path == "/api/v1/open-food-facts-images":
            envelope = ErrorEnvelope(
                error=ErrorDetail(
                    code=ErrorCode.REFERENCE_IMAGE_URL_INVALID,
                    message="A valid reference image URL is required.",
                )
            )
            return JSONResponse(status_code=422, content=envelope.model_dump())
        if request.url.path == "/api/v1/package-search":
            envelope = ErrorEnvelope(
                error=ErrorDetail(
                    code=ErrorCode.PACKAGE_SEARCH_QUERY_INVALID,
                    message="Enter a search query from 2 to 80 characters.",
                )
            )
            return JSONResponse(status_code=422, content=envelope.model_dump())
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.IDENTIFIER_REQUIRED,
                message=ERROR_MESSAGES[ErrorCode.IDENTIFIER_REQUIRED],
            )
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())

    @app.exception_handler(InvalidIdentifierError)
    async def invalid_identifier_handler(
        _request: Request, error: InvalidIdentifierError
    ) -> JSONResponse:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode(error.code),
                message=ERROR_MESSAGES[ErrorCode(error.code)],
            )
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())

    @app.exception_handler(SQLAlchemyError)
    async def database_unavailable_handler(
        _request: Request, _error: SQLAlchemyError
    ) -> JSONResponse:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.PACKAGE_MATCH_SOURCE_UNAVAILABLE,
                message="Package Match lookup is temporarily unavailable.",
            )
        )
        return JSONResponse(status_code=503, content=envelope.model_dump())

    @app.exception_handler(PackageMatchSourceUnavailableError)
    async def source_unavailable_handler(
        _request: Request, _error: PackageMatchSourceUnavailableError
    ) -> JSONResponse:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.PACKAGE_MATCH_SOURCE_UNAVAILABLE,
                message="Package Match lookup is temporarily unavailable.",
            )
        )
        return JSONResponse(status_code=503, content=envelope.model_dump())

    return app


app = create_app()
