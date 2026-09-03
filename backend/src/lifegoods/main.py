from typing import Any

import httpx2 as httpx
import redis
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pymongo import MongoClient
from scalar_fastapi import get_scalar_api_reference

from lifegoods.core.errors import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.core.settings import Settings
from lifegoods.identifiers import InvalidIdentifierError
from lifegoods.open_food_facts import (
    ExternalImageSource,
    OpenFoodFactsDatasetSource,
    OpenFoodFactsImageSource,
    get_image_source,
    open_food_facts_image_router,
)
from lifegoods.product_lookup import (
    LookupProduct,
    NoOpProductLookupMetrics,
    NullProductLookupCache,
    ProductLookupCache,
    ProductLookupMetrics,
    ProductLookupRateLimiter,
    RawProductLookupSource,
    RedisProductLookupCache,
    RedisProductLookupRateLimiter,
    get_product_lookup,
    get_product_lookup_metrics,
    get_product_lookup_rate_limiter,
    install_product_lookup_access_log_filter,
    product_lookup_router,
)

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
    image_source: ExternalImageSource | None = None,
    product_lookup_source: RawProductLookupSource | None = None,
    product_lookup_cache: ProductLookupCache | None = None,
    product_lookup_limiter: ProductLookupRateLimiter | None = None,
    product_lookup_metrics: ProductLookupMetrics | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    install_product_lookup_access_log_filter()

    owned_http_clients: list[httpx.Client] = []
    owned_mongo_clients: list[MongoClient[dict[str, Any]]] = []
    owned_redis_clients: list[redis.Redis] = []
    shared_redis_client: redis.Redis | None = None

    needs_shared_redis = (
        product_lookup_limiter is None
        or (
            resolved_settings.product_lookup_cache_enabled
            and product_lookup_cache is None
        )
    )

    if needs_shared_redis:
        shared_redis_client = redis.Redis.from_url(
            resolved_settings.redis_url,
            socket_connect_timeout=resolved_settings.redis_timeout_seconds,
            socket_timeout=resolved_settings.redis_timeout_seconds,
            decode_responses=True,
        )
        owned_redis_clients.append(shared_redis_client)

    if product_lookup_source is not None:
        resolved_product_lookup_source = product_lookup_source
    else:
        mongo_client: MongoClient[dict[str, Any]] = MongoClient(
            resolved_settings.off_mongodb_uri,
            serverSelectionTimeoutMS=resolved_settings.off_mongodb_timeout_ms,
        )
        owned_mongo_clients.append(mongo_client)
        resolved_product_lookup_source = OpenFoodFactsDatasetSource(
            mongo_client[resolved_settings.off_mongodb_database],
            image_base_url=resolved_settings.open_food_facts_image_base_url,
        )

    if product_lookup_cache is not None:
        resolved_product_lookup_cache = product_lookup_cache
    elif resolved_settings.product_lookup_cache_enabled:
        assert shared_redis_client is not None
        resolved_product_lookup_cache = RedisProductLookupCache(
            shared_redis_client,
            ttl_seconds=resolved_settings.product_lookup_cache_ttl_seconds,
        )
    else:
        resolved_product_lookup_cache = NullProductLookupCache()

    if product_lookup_limiter is not None:
        resolved_product_lookup_limiter = product_lookup_limiter
    else:
        assert shared_redis_client is not None
        resolved_product_lookup_limiter = RedisProductLookupRateLimiter(
            shared_redis_client,
            resolved_settings.product_lookup_requests_per_minute,
        )

    resolved_product_lookup_metrics = (
        product_lookup_metrics or NoOpProductLookupMetrics()
    )

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

    app = FastAPI(title="Life Goods API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(product_lookup_router)
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
    for owned_redis_client in owned_redis_clients:
        app.router.add_event_handler("shutdown", owned_redis_client.close)

    app.dependency_overrides[get_image_source] = lambda: resolved_image_source
    app.dependency_overrides[get_product_lookup] = lambda: LookupProduct(
        resolved_product_lookup_source,
        resolved_product_lookup_cache,
    )
    app.dependency_overrides[get_product_lookup_rate_limiter] = (
        lambda: resolved_product_lookup_limiter
    )
    app.dependency_overrides[get_product_lookup_metrics] = (
        lambda: resolved_product_lookup_metrics
    )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        _request: Request, _error: RequestValidationError
    ) -> JSONResponse:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.REQUEST_BODY_INVALID,
                message="The request is invalid.",
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

    return app


app = create_app()
