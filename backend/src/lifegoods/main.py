from typing import Any

import httpx2 as httpx
import redis
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pymongo import MongoClient
from scalar_fastapi import get_scalar_api_reference
from starlette.exceptions import HTTPException as StarletteHTTPException

from lifegoods.core.errors import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.core.health import ReadinessProbe, build_health_router
from lifegoods.core.security import SecurityHeadersMiddleware, TrustedProxyClientMiddleware
from lifegoods.core.settings import Settings
from lifegoods.generated_data.budget import RedisTranslationBudgetLimiter
from lifegoods.generated_data.cache import RedisTranslationHotCache
from lifegoods.generated_data.coordinator import TranslationCoordinator
from lifegoods.generated_data.repository import MongoGeneratedDataRepository
from lifegoods.identifiers import InvalidIdentifierError
from lifegoods.ingredient_matching import (
    IngredientMatcher,
    get_ingredient_matcher,
)
from lifegoods.ingredient_matching import router as ingredient_matching_router
from lifegoods.label_reading.gemini import create_label_reading_provider
from lifegoods.label_reading.khmer_rendering import (
    KHMER_RENDERING_DEADLINE_SECONDS,
    KhmerRenderingService,
    create_khmer_rendering_provider,
)
from lifegoods.label_reading.router import (
    build_label_reading_router,
    install_label_reading_openapi,
)
from lifegoods.label_reading.service import LabelReadingProvider, LabelReadingService
from lifegoods.open_food_facts import (
    ExternalImageSource,
    OpenFoodFactsDatasetSource,
    OpenFoodFactsImageSource,
    get_image_source,
    open_food_facts_image_router,
)
from lifegoods.photo_comparison.contracts import (
    PhotoComparisonErrorCode,
    PhotoComparisonErrorDetail,
    PhotoComparisonErrorResponse,
)
from lifegoods.photo_comparison.gemini import (
    PHOTO_TIMEOUT_SECONDS,
    create_photo_extraction_provider,
)
from lifegoods.photo_comparison.rate_limit import (
    PhotoComparisonRateLimiter,
    RedisPhotoComparisonRateLimiter,
)
from lifegoods.photo_comparison.router import (
    LABEL_READING_PATH,
    PhotoComparisonUploadLimitMiddleware,
    install_photo_comparison_openapi,
    is_photo_upload_path,
    photo_comparison_http_exception_response,
)
from lifegoods.photo_comparison.router import build_router as build_photo_comparison_router
from lifegoods.photo_comparison.service import (
    PhotoComparisonService,
    PhotoExtractionProvider,
    PhotoExtractionService,
    PhotoProviderAdmission,
    ProviderCapacityProtocol,
    RedisProviderCapacity,
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
    get_translation_coordinator,
    install_product_lookup_access_log_filter,
    product_lookup_router,
)
from lifegoods.product_search import (
    NoOpProductSearchMetrics,
    ProductSearchMetrics,
    ProductSearchRateLimiter,
    RedisProductSearchRateLimiter,
    SearchProducts,
    get_product_search,
    get_product_search_metrics,
    get_product_search_rate_limiter,
    product_search_router,
)
from lifegoods.translation.gemini import GeminiTranslationAdapter
from lifegoods.translation.module import (
    PRODUCTION_MODEL,
    KhmerTranslationModule,
)
from lifegoods.translation.provider import TranslationProvider

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
    ingredient_matching_database: Any | None = None,
    ingredient_matcher: IngredientMatcher | None = None,
    translation_coordinator: TranslationCoordinator | None = None,
    product_search_service: SearchProducts | None = None,
    product_search_limiter: ProductSearchRateLimiter | None = None,
    product_search_metrics: ProductSearchMetrics | None = None,
    photo_provider: PhotoExtractionProvider | None = None,
    photo_rate_limiter: PhotoComparisonRateLimiter | None = None,
    photo_capacity: ProviderCapacityProtocol | None = None,
    label_reading_provider: LabelReadingProvider | None = None,
    khmer_rendering_provider: TranslationProvider | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    install_product_lookup_access_log_filter()

    owned_http_clients: list[httpx.Client] = []
    owned_mongo_clients: list[MongoClient[dict[str, Any]]] = []
    owned_redis_clients: list[redis.Redis] = []
    shared_redis_client: redis.Redis | None = None

    needs_shared_redis = (
        product_lookup_limiter is None
        or (resolved_settings.product_lookup_cache_enabled and product_lookup_cache is None)
        or translation_coordinator is None
        or product_search_limiter is None
        or photo_rate_limiter is None
        or photo_capacity is None
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

    resolved_ingredient_matching_database = ingredient_matching_database
    if (
        resolved_ingredient_matching_database is None
        and isinstance(resolved_product_lookup_source, OpenFoodFactsDatasetSource)
    ):
        resolved_ingredient_matching_database = resolved_product_lookup_source.database
    resolved_ingredient_matcher = ingredient_matcher or IngredientMatcher(
        resolved_ingredient_matching_database,
        enabled=resolved_settings.ingredient_matching_prototype_enabled,
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

    if product_search_limiter is not None:
        resolved_product_search_limiter = product_search_limiter
    else:
        assert shared_redis_client is not None
        resolved_product_search_limiter = RedisProductSearchRateLimiter(
            shared_redis_client,
            resolved_settings.product_search_requests_per_minute,
        )

    resolved_product_search_metrics = (
        product_search_metrics or NoOpProductSearchMetrics()
    )

    resolved_product_lookup_metrics = product_lookup_metrics or NoOpProductLookupMetrics()

    if photo_rate_limiter is not None:
        resolved_photo_rate_limiter = photo_rate_limiter
    else:
        assert shared_redis_client is not None
        resolved_photo_rate_limiter = RedisPhotoComparisonRateLimiter(
            shared_redis_client,
            resolved_settings.photo_comparison_requests_per_minute,
        )

    if image_source is None:
        image_http_client = httpx.Client()
        owned_http_clients.append(image_http_client)
        resolved_image_source: ExternalImageSource = OpenFoodFactsImageSource(
            image_http_client,
            image_base_url=resolved_settings.open_food_facts_image_base_url,
            user_agent=resolved_settings.open_food_facts_user_agent,
            connect_timeout_seconds=(
                resolved_settings.open_food_facts_image_connect_timeout_seconds
            ),
            read_timeout_seconds=resolved_settings.open_food_facts_image_timeout_seconds,
            requests_per_minute=resolved_settings.open_food_facts_image_requests_per_minute,
        )
    else:
        resolved_image_source = image_source

    resolved_photo_provider = photo_provider
    if resolved_photo_provider is None and resolved_settings.gemini_api_key:
        photo_provider_client = httpx.Client(timeout=PHOTO_TIMEOUT_SECONDS)
        owned_http_clients.append(photo_provider_client)
        resolved_photo_provider = create_photo_extraction_provider(
            resolved_settings.gemini_api_key,
            http_client=photo_provider_client,
        )

    resolved_photo_capacity = photo_capacity
    if resolved_photo_capacity is None:
        assert shared_redis_client is not None
        resolved_photo_capacity = RedisProviderCapacity(shared_redis_client)

    # One admission budget and provider lease shared by every photo operation.
    photo_admission = PhotoProviderAdmission(
        rate_limiter=resolved_photo_rate_limiter,
        capacity=resolved_photo_capacity,
    )
    photo_extraction_service = PhotoExtractionService(
        resolved_photo_provider,
        admission=photo_admission,
    )
    photo_comparison_service = PhotoComparisonService()
    resolved_label_reading_provider = label_reading_provider
    if resolved_label_reading_provider is None and resolved_settings.gemini_api_key:
        label_reading_client = httpx.Client(timeout=PHOTO_TIMEOUT_SECONDS)
        owned_http_clients.append(label_reading_client)
        resolved_label_reading_provider = create_label_reading_provider(
            resolved_settings.gemini_api_key,
            http_client=label_reading_client,
        )
    resolved_khmer_rendering_provider = khmer_rendering_provider
    if resolved_khmer_rendering_provider is None and resolved_settings.gemini_api_key:
        khmer_rendering_client = httpx.Client(timeout=KHMER_RENDERING_DEADLINE_SECONDS)
        owned_http_clients.append(khmer_rendering_client)
        resolved_khmer_rendering_provider = create_khmer_rendering_provider(
            resolved_settings.gemini_api_key,
            http_client=khmer_rendering_client,
        )
    khmer_rendering_service = KhmerRenderingService(
        resolved_khmer_rendering_provider,
        admission=photo_admission,
    )
    label_reading_service = LabelReadingService(
        resolved_label_reading_provider,
        admission=photo_admission,
        ingredient_matcher=resolved_ingredient_matcher,
    )

    app = FastAPI(title="Life Goods API", version="0.1.0")
    readiness_probe = ReadinessProbe(resolved_settings)
    app.include_router(build_health_router(readiness_probe))
    app.router.add_event_handler("shutdown", readiness_probe.close)
    app.add_middleware(
        TrustedProxyClientMiddleware,
        trusted_proxy_cidrs=resolved_settings.trusted_proxy_cidrs,
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(PhotoComparisonUploadLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(product_search_router)
    app.include_router(product_lookup_router)
    app.include_router(ingredient_matching_router)
    app.include_router(open_food_facts_image_router)
    app.include_router(
        build_photo_comparison_router(
            photo_extraction_service,
            photo_comparison_service,
        )
    )
    app.include_router(
        build_label_reading_router(
            label_reading_service, khmer_rendering_service, path=LABEL_READING_PATH
        )
    )
    install_photo_comparison_openapi(app)
    install_label_reading_openapi(app)

    @app.get("/scalar", include_in_schema=False)
    async def scalar_html() -> HTMLResponse:
        return get_scalar_api_reference(
            openapi_url=app.openapi_url or "/openapi.json",
            title=f"{app.title} - Scalar Reference",
        )

    if translation_coordinator is not None:
        resolved_translation_coordinator = translation_coordinator
    else:
        assert shared_redis_client is not None
        generated_mongo_client: MongoClient[dict[str, Any]] = MongoClient(
            resolved_settings.generated_mongodb_uri,
            serverSelectionTimeoutMS=resolved_settings.generated_mongodb_timeout_ms,
        )
        owned_mongo_clients.append(generated_mongo_client)
        generated_repository = MongoGeneratedDataRepository(
            generated_mongo_client[resolved_settings.generated_mongodb_database]
        )

        provider: TranslationProvider | None
        if resolved_settings.gemini_api_key:
            gemini_http_client = httpx.Client()
            owned_http_clients.append(gemini_http_client)
            provider = GeminiTranslationAdapter(
                resolved_settings.gemini_api_key,
                model=PRODUCTION_MODEL,
                timeout_seconds=resolved_settings.gemini_translation_timeout_seconds,
                http_client=gemini_http_client,
            )
        else:
            provider = None

        translation_module = KhmerTranslationModule(provider=provider)
        translation_cache = RedisTranslationHotCache(
            shared_redis_client,
            ttl_seconds=resolved_settings.generated_translation_cache_ttl_seconds,
        )
        translation_budget = RedisTranslationBudgetLimiter(
            shared_redis_client,
            requests_per_minute=resolved_settings.generated_translation_budget_per_minute,
        )
        resolved_translation_coordinator = TranslationCoordinator(
            module=translation_module,
            deadline_seconds=resolved_settings.translation_deadline_seconds,
            repository=generated_repository,
            cache=translation_cache,
            budget=translation_budget,
            lease_ttl_seconds=resolved_settings.generated_translation_lease_ttl_seconds,
            cooldown_seconds=resolved_settings.generated_translation_cooldown_seconds,
            poll_interval_seconds=resolved_settings.generated_translation_poll_interval_seconds,
        )

    app.dependency_overrides[get_image_source] = lambda: resolved_image_source
    app.dependency_overrides[get_translation_coordinator] = lambda: resolved_translation_coordinator
    app.dependency_overrides[get_product_lookup] = lambda: LookupProduct(
        resolved_product_lookup_source,
        resolved_product_lookup_cache,
        coordinator=resolved_translation_coordinator,
        ingredient_matcher=resolved_ingredient_matcher,
    )
    app.dependency_overrides[get_product_lookup_rate_limiter] = lambda: (
        resolved_product_lookup_limiter
    )
    app.dependency_overrides[get_product_lookup_metrics] = lambda: resolved_product_lookup_metrics
    app.dependency_overrides[get_product_search] = lambda: (
        product_search_service
        if product_search_service is not None
        else SearchProducts(resolved_product_lookup_source)
    )
    app.dependency_overrides[get_product_search_rate_limiter] = lambda: (
        resolved_product_search_limiter
    )
    app.dependency_overrides[get_product_search_metrics] = lambda: (
        resolved_product_search_metrics
    )
    app.dependency_overrides[get_ingredient_matcher] = lambda: resolved_ingredient_matcher

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        request: Request, _error: RequestValidationError
    ) -> JSONResponse:
        if request.url.path == "/api/experimental/ingredient-matches":
            return JSONResponse(
                status_code=422,
                content={
                    "error": {
                        "code": "invalid_ingredient_text",
                        "message": "Enter ingredient text from 1 to 2000 characters.",
                    }
                },
            )
        if is_photo_upload_path(request.url.path):
            envelope = PhotoComparisonErrorResponse(
                error=PhotoComparisonErrorDetail(
                    code=PhotoComparisonErrorCode.REQUEST_INVALID,
                    message="The photo-comparison request is invalid.",
                )
            )
            return JSONResponse(
                status_code=422,
                content=envelope.model_dump(mode="json"),
                headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
            )
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.REQUEST_BODY_INVALID,
                message="The request is invalid.",
            )
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, error: StarletteHTTPException
    ) -> JSONResponse:
        photo_error = photo_comparison_http_exception_response(
            request.url.path, error.status_code
        )
        if photo_error is not None:
            return photo_error
        return JSONResponse(
            status_code=error.status_code,
            content={"detail": error.detail},
            headers=error.headers,
        )

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

    for owned_http_client in owned_http_clients:
        app.router.add_event_handler("shutdown", owned_http_client.close)
    for owned_mongo_client in owned_mongo_clients:
        app.router.add_event_handler("shutdown", owned_mongo_client.close)
    for owned_redis_client in owned_redis_clients:
        app.router.add_event_handler("shutdown", owned_redis_client.close)

    return app


app = create_app()
