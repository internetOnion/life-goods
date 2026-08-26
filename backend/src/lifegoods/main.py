from collections.abc import Callable, Iterator
from datetime import datetime

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from lifegoods.adapters.database import create_session_factory
from lifegoods.adapters.external_snapshot_repository import (
    SqlAlchemyExternalSnapshotRepository,
)
from lifegoods.adapters.open_food_facts import OpenFoodFactsPackageSource
from lifegoods.adapters.open_food_facts_images import OpenFoodFactsImageSource
from lifegoods.adapters.package_match_repository import SqlAlchemyPackageMatchRepository
from lifegoods.api.contracts import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.api.open_food_facts_images import get_image_source
from lifegoods.api.open_food_facts_images import router as open_food_facts_images_router
from lifegoods.api.package_matches import get_finder, router
from lifegoods.application.package_matches import (
    FindPackageMatches,
    PackageMatchSourceUnavailableError,
)
from lifegoods.matching.external_images import ExternalImageSource
from lifegoods.matching.external_requests import ExternalLookupLocks, SlidingWindowRequestBudget
from lifegoods.matching.external_source import ExternalPackageSource
from lifegoods.matching.identifier import InvalidIdentifierError
from lifegoods.settings import Settings

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
    request_budget: SlidingWindowRequestBudget | None = None,
    lookup_locks: ExternalLookupLocks | None = None,
    utc_now: Callable[[], datetime] | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    resolved_factory = session_factory or create_session_factory(resolved_settings)
    owned_http_clients: list[httpx.Client] = []
    if external_source is None:
        package_http_client = httpx.Client()
        owned_http_clients.append(package_http_client)
        resolved_source: ExternalPackageSource = OpenFoodFactsPackageSource(
            package_http_client,
            base_url=resolved_settings.open_food_facts_base_url,
            user_agent=resolved_settings.open_food_facts_user_agent,
            timeout_seconds=resolved_settings.open_food_facts_timeout_seconds,
            utc_now=utc_now,
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
            timeout_seconds=resolved_settings.open_food_facts_timeout_seconds,
            requests_per_minute=resolved_settings.open_food_facts_image_requests_per_minute,
        )
    else:
        resolved_image_source = image_source
    resolved_budget = request_budget or SlidingWindowRequestBudget(
        resolved_settings.open_food_facts_requests_per_minute
    )
    resolved_locks = lookup_locks or ExternalLookupLocks()
    app = FastAPI(title="LifeGoods API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.include_router(open_food_facts_images_router)
    for owned_http_client in owned_http_clients:
        app.router.add_event_handler("shutdown", owned_http_client.close)

    def provide_finder() -> Iterator[FindPackageMatches]:
        with resolved_factory() as session:
            yield FindPackageMatches(
                SqlAlchemyPackageMatchRepository(session),
                SqlAlchemyExternalSnapshotRepository(session),
                resolved_source,
                resolved_budget,
                resolved_locks,
                utc_now=utc_now,
            )

    app.dependency_overrides[get_finder] = provide_finder
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
