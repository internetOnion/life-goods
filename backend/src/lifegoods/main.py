from collections.abc import Iterator
from typing import Any, cast

import httpx2 as httpx
import redis
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pymongo import MongoClient
from scalar_fastapi import get_scalar_api_reference
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from lifegoods.core.concurrency import KeyedSlidingWindowLimiter
from lifegoods.core.errors import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.core.settings import Settings
from lifegoods.identifiers import InvalidIdentifierError
from lifegoods.ingredient_matching import (
    IngredientMatcher,
    get_ingredient_matcher,
)
from lifegoods.ingredient_matching import router as ingredient_matching_router
from lifegoods.open_food_facts import (
    ExternalImageSource,
    ExternalPackageSource,
    OpenFoodFactsDatasetSource,
    OpenFoodFactsImageSource,
    get_image_source,
    open_food_facts_image_router,
)
from lifegoods.package_matches import (
    AllergenAssessmentCache,
    AllergenAssessmentEvaluator,
    FindPackageMatches,
    HalalIngredientAssessmentCache,
    HalalIngredientAssessmentEvaluator,
    MongoPackageSearch,
    PackageMatchRateLimiter,
    PackageMatchSourceUnavailableError,
    PackageSearch,
    RedisAllergenAssessmentCache,
    RedisHalalIngredientAssessmentCache,
    RedisPackageMatchRateLimiter,
    SearchValidationError,
    StandardAllergenAssessmentEvaluator,
    StandardHalalIngredientAssessmentEvaluator,
    get_finder,
    get_rate_limiter,
)
from lifegoods.package_matches import (
    get_search_rate_limiter as get_package_match_search_rate_limiter,
)
from lifegoods.package_matches import (
    get_searcher as get_package_match_searcher,
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
from lifegoods.reference_datasets import (
    DatabaseAllergenReferenceDataAccess,
    DatabaseHalalReferenceDataAccess,
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
    session_factory: sessionmaker[Session] | None = None,
    external_source: ExternalPackageSource | None = None,
    image_source: ExternalImageSource | None = None,
    package_match_limiter: PackageMatchRateLimiter | None = None,
    package_search_limiter: KeyedSlidingWindowLimiter | None = None,
    allergen_evaluator: AllergenAssessmentEvaluator | None = None,
    assessment_cache: AllergenAssessmentCache | None = None,
    package_search: PackageSearch | None = None,
    search_rate_limiter: PackageMatchRateLimiter | None = None,
    halal_evaluator: HalalIngredientAssessmentEvaluator | None = None,
    halal_assessment_cache: HalalIngredientAssessmentCache | None = None,
    product_lookup_source: RawProductLookupSource | None = None,
    product_lookup_cache: ProductLookupCache | None = None,
    product_lookup_limiter: ProductLookupRateLimiter | None = None,
    product_lookup_metrics: ProductLookupMetrics | None = None,
    ingredient_matching_database: Any | None = None,
    ingredient_matcher: IngredientMatcher | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    install_product_lookup_access_log_filter()
    if session_factory is None:
        db_engine = create_engine(resolved_settings.database_url)
        resolved_session_factory = sessionmaker(db_engine, expire_on_commit=False)
    else:
        resolved_session_factory = session_factory

    owned_http_clients: list[httpx.Client] = []
    owned_mongo_clients: list[MongoClient[dict[str, Any]]] = []
    owned_redis_clients: list[redis.Redis] = []
    shared_redis_client: redis.Redis | None = None

    needs_shared_redis = False
    if package_match_limiter is None and not isinstance(
        assessment_cache, RedisAllergenAssessmentCache
    ):
        needs_shared_redis = True
    if search_rate_limiter is None:
        needs_shared_redis = True
    if resolved_settings.assessment_cache_enabled:
        if assessment_cache is None and not isinstance(
            halal_assessment_cache, RedisHalalIngredientAssessmentCache
        ):
            needs_shared_redis = True
        if halal_assessment_cache is None and not isinstance(
            assessment_cache, RedisAllergenAssessmentCache
        ):
            needs_shared_redis = True
    if product_lookup_limiter is None:
        needs_shared_redis = True
    if (
        resolved_settings.product_lookup_cache_enabled
        and product_lookup_cache is None
    ):
        needs_shared_redis = True

    if needs_shared_redis:
        shared_redis_client = redis.Redis.from_url(
            resolved_settings.redis_url,
            socket_connect_timeout=resolved_settings.redis_timeout_seconds,
            socket_timeout=resolved_settings.redis_timeout_seconds,
            decode_responses=True,
        )
        owned_redis_clients.append(shared_redis_client)

    if package_match_limiter is not None:
        resolved_package_match_limiter = package_match_limiter
    else:
        limiter_redis_client = cast(
            redis.Redis,
            assessment_cache._client
            if isinstance(assessment_cache, RedisAllergenAssessmentCache)
            else shared_redis_client,
        )
        assert limiter_redis_client is not None
        resolved_package_match_limiter = RedisPackageMatchRateLimiter(
            limiter_redis_client,
            resolved_settings.package_match_requests_per_minute,
            fallback_seconds=resolved_settings.package_match_rate_limit_fallback_seconds,
            local_max_keys=resolved_settings.package_match_rate_limit_local_max_keys,
        )
    if search_rate_limiter is not None:
        resolved_search_rate_limiter = search_rate_limiter
    else:
        assert shared_redis_client is not None
        resolved_search_rate_limiter = RedisPackageMatchRateLimiter(
            shared_redis_client,
            resolved_settings.package_search_requests_per_minute,
            fallback_seconds=resolved_settings.package_match_rate_limit_fallback_seconds,
            local_max_keys=resolved_settings.package_match_rate_limit_local_max_keys,
            key_prefix="package-matches:search-rate-limit",
        )
    resolved_reference_data = DatabaseAllergenReferenceDataAccess(
        resolved_session_factory
    )
    if assessment_cache is not None:
        resolved_cache: AllergenAssessmentCache | None = assessment_cache
    elif isinstance(halal_assessment_cache, RedisHalalIngredientAssessmentCache):
        resolved_cache = RedisAllergenAssessmentCache(
            halal_assessment_cache._client,
            ttl_seconds=resolved_settings.assessment_cache_ttl_seconds,
        )
    elif resolved_settings.assessment_cache_enabled:
        assert shared_redis_client is not None
        resolved_cache = RedisAllergenAssessmentCache(
            shared_redis_client,
            ttl_seconds=resolved_settings.assessment_cache_ttl_seconds,
        )
    else:
        resolved_cache = None

    resolved_allergen_evaluator = (
        allergen_evaluator
        or StandardAllergenAssessmentEvaluator(
            enabled=resolved_settings.allergen_assessments_enabled,
            engine_version=resolved_settings.assessment_engine_version,
            reference_data=resolved_reference_data,
            cache=resolved_cache,
        )
    )

    resolved_halal_reference_data = DatabaseHalalReferenceDataAccess(
        resolved_session_factory
    )
    if halal_assessment_cache is not None:
        resolved_halal_cache: HalalIngredientAssessmentCache | None = (
            halal_assessment_cache
        )
    elif isinstance(assessment_cache, RedisAllergenAssessmentCache):
        resolved_halal_cache = RedisHalalIngredientAssessmentCache(
            assessment_cache._client,
            ttl_seconds=resolved_settings.assessment_cache_ttl_seconds,
        )
    elif resolved_settings.assessment_cache_enabled:
        assert shared_redis_client is not None
        resolved_halal_cache = RedisHalalIngredientAssessmentCache(
            shared_redis_client,
            ttl_seconds=resolved_settings.assessment_cache_ttl_seconds,
        )
    else:
        resolved_halal_cache = None

    resolved_halal_evaluator = (
        halal_evaluator
        or StandardHalalIngredientAssessmentEvaluator(
            enabled=resolved_settings.halal_ingredient_assessments_enabled,
            engine_version=(
                resolved_settings.halal_ingredient_assessment_engine_version
            ),
            reference_data=resolved_halal_reference_data,
            cache=resolved_halal_cache,
        )
    )
    resolved_package_search_limiter = (
        package_search_limiter
        or KeyedSlidingWindowLimiter(resolved_settings.package_search_requests_per_minute)
    )
    needs_dataset_source = external_source is None or (
        product_lookup_source is None
        and not isinstance(external_source, OpenFoodFactsDatasetSource)
    )
    dataset_source: OpenFoodFactsDatasetSource | None = None
    if needs_dataset_source:
        mongo_client: MongoClient[dict[str, Any]] = MongoClient(
            resolved_settings.off_mongodb_uri,
            serverSelectionTimeoutMS=resolved_settings.off_mongodb_timeout_ms,
        )
        owned_mongo_clients.append(mongo_client)
        dataset_source = OpenFoodFactsDatasetSource(
            mongo_client[resolved_settings.off_mongodb_database],
            image_base_url=resolved_settings.open_food_facts_image_base_url,
        )
    if external_source is None:
        assert dataset_source is not None
        resolved_source: ExternalPackageSource = dataset_source
    else:
        resolved_source = external_source
    if product_lookup_source is not None:
        resolved_product_lookup_source = product_lookup_source
    elif isinstance(resolved_source, OpenFoodFactsDatasetSource):
        resolved_product_lookup_source = resolved_source
    else:
        assert dataset_source is not None
        resolved_product_lookup_source = dataset_source

    resolved_ingredient_matching_database = ingredient_matching_database
    if resolved_ingredient_matching_database is None and dataset_source is not None:
        resolved_ingredient_matching_database = dataset_source.database
    if (
        resolved_settings.ingredient_matching_prototype_enabled
        and resolved_ingredient_matching_database is None
    ):
        ingredient_mongo_client: MongoClient[dict[str, Any]] = MongoClient(
            resolved_settings.off_mongodb_uri,
            serverSelectionTimeoutMS=resolved_settings.off_mongodb_timeout_ms,
        )
        owned_mongo_clients.append(ingredient_mongo_client)
        resolved_ingredient_matching_database = ingredient_mongo_client[
            resolved_settings.off_mongodb_database
        ]
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
    resolved_product_lookup_metrics = (
        product_lookup_metrics or NoOpProductLookupMetrics()
    )
    resolved_package_search = package_search
    if resolved_package_search is None and isinstance(
        resolved_source, OpenFoodFactsDatasetSource
    ):
        resolved_package_search = MongoPackageSearch(resolved_source)
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
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(package_matches_router)
    app.include_router(package_search_router)
    app.include_router(open_food_facts_image_router)
    app.include_router(product_lookup_router)
    app.include_router(ingredient_matching_router)

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

    def provide_finder() -> Iterator[FindPackageMatches]:
        yield FindPackageMatches(
            resolved_source,
            allergen_evaluator=resolved_allergen_evaluator,
            halal_evaluator=resolved_halal_evaluator,
        )

    def provide_searcher() -> Iterator[SearchPackages]:
        yield SearchPackages(resolved_source)  # type: ignore[arg-type]

    app.dependency_overrides[get_finder] = provide_finder
    app.dependency_overrides[get_rate_limiter] = lambda: resolved_package_match_limiter
    app.dependency_overrides[get_package_match_searcher] = lambda: resolved_package_search
    app.dependency_overrides[get_package_match_search_rate_limiter] = (
        lambda: resolved_search_rate_limiter
    )
    app.dependency_overrides[get_searcher] = provide_searcher
    app.dependency_overrides[get_package_search_rate_limiter] = (
        lambda: resolved_package_search_limiter
    )
    app.dependency_overrides[get_image_source] = lambda: resolved_image_source
    app.dependency_overrides[get_product_lookup] = lambda: LookupProduct(
        resolved_product_lookup_source,
        resolved_product_lookup_cache,
        ingredient_matcher=resolved_ingredient_matcher,
    )
    app.dependency_overrides[get_product_lookup_rate_limiter] = (
        lambda: resolved_product_lookup_limiter
    )
    app.dependency_overrides[get_product_lookup_metrics] = (
        lambda: resolved_product_lookup_metrics
    )
    app.dependency_overrides[get_ingredient_matcher] = lambda: resolved_ingredient_matcher

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
        if request.url.path == "/api/v1/package-matches/search":
            has_missing_query = any(
                item.get("loc", [None])[-1] == "q" and item.get("type") == "missing"
                for item in _error.errors()
            )
            code = (
                ErrorCode.SEARCH_QUERY_REQUIRED
                if has_missing_query
                else ErrorCode.SEARCH_QUERY_INVALID
            )
            message = (
                "A search value is required."
                if has_missing_query
                else "The search value or paging values are invalid."
            )
            envelope = ErrorEnvelope(error=ErrorDetail(code=code, message=message))
            return JSONResponse(status_code=422, content=envelope.model_dump())
        if request.url.path == "/api/v1/package-search":
            envelope = ErrorEnvelope(
                error=ErrorDetail(
                    code=ErrorCode.PACKAGE_SEARCH_QUERY_INVALID,
                    message="Enter a search query from 2 to 80 characters.",
                )
            )
            return JSONResponse(status_code=422, content=envelope.model_dump())
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
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.IDENTIFIER_REQUIRED,
                message=ERROR_MESSAGES[ErrorCode.IDENTIFIER_REQUIRED],
            )
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())

    @app.exception_handler(SearchValidationError)
    async def search_validation_handler(
        _request: Request, error: SearchValidationError
    ) -> JSONResponse:
        envelope = ErrorEnvelope(
            error=ErrorDetail(code=ErrorCode.SEARCH_QUERY_INVALID, message=str(error))
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
