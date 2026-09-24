"""Standalone development app for the shared photo-comparison capability."""

from __future__ import annotations

from typing import Any

import httpx2 as httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from scalar_fastapi import get_scalar_api_reference
from starlette.exceptions import HTTPException as StarletteHTTPException

from lifegoods.core.security import SecurityHeadersMiddleware, TrustedProxyClientMiddleware
from lifegoods.core.settings import Settings
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
from lifegoods.label_reading.service import LabelReadingService
from lifegoods.photo_comparison.contracts import (
    PhotoComparisonErrorCode,
    PhotoComparisonErrorDetail,
    PhotoComparisonErrorResponse,
)
from lifegoods.photo_comparison.gemini import (
    PHOTO_TIMEOUT_SECONDS,
    create_photo_extraction_provider,
)
from lifegoods.photo_comparison.router import (
    EXPERIMENTAL_LABEL_READING_PATH,
    EXPERIMENTAL_PREFIX,
    PhotoComparisonUploadLimitMiddleware,
    build_router,
    install_photo_comparison_openapi,
    photo_comparison_http_exception_response,
)
from lifegoods.photo_comparison.service import (
    PhotoComparisonService,
    PhotoExtractionService,
    PhotoProviderAdmission,
)
from lifegoods.photo_comparison.web import photo_comparison_page


def _error_response(code: PhotoComparisonErrorCode, message: str, status_code: int) -> JSONResponse:
    body = PhotoComparisonErrorResponse(
        error=PhotoComparisonErrorDetail(code=code, message=message)
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())


def create_photo_comparison_app(
    *,
    settings: Settings | None = None,
    provider: Any | None = None,
    label_reading_provider: Any | None = None,
    khmer_rendering_provider: Any | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    owned_clients: list[httpx.Client] = []
    resolved_provider = provider
    if resolved_provider is None and resolved_settings.gemini_api_key:
        client = httpx.Client(timeout=PHOTO_TIMEOUT_SECONDS)
        owned_clients.append(client)
        resolved_provider = create_photo_extraction_provider(
            resolved_settings.gemini_api_key,
            http_client=client,
        )

    photo_admission = PhotoProviderAdmission()
    extraction_service = PhotoExtractionService(resolved_provider, admission=photo_admission)
    resolved_label_provider = label_reading_provider
    if resolved_label_provider is None and resolved_settings.gemini_api_key:
        label_client = httpx.Client(timeout=PHOTO_TIMEOUT_SECONDS)
        owned_clients.append(label_client)
        resolved_label_provider = create_label_reading_provider(
            resolved_settings.gemini_api_key,
            http_client=label_client,
        )
    resolved_rendering_provider = khmer_rendering_provider
    if resolved_rendering_provider is None and resolved_settings.gemini_api_key:
        rendering_client = httpx.Client(timeout=KHMER_RENDERING_DEADLINE_SECONDS)
        owned_clients.append(rendering_client)
        resolved_rendering_provider = create_khmer_rendering_provider(
            resolved_settings.gemini_api_key,
            http_client=rendering_client,
        )
    khmer_rendering_service = KhmerRenderingService(
        resolved_rendering_provider, admission=photo_admission
    )
    label_reading_service = LabelReadingService(
        resolved_label_provider, admission=photo_admission
    )
    comparison_service = PhotoComparisonService()
    app = FastAPI(
        title="Life Goods Photo Comparison Lab",
        version="0.1.0",
        description=(
            "Development entry point for photo evidence extraction and deterministic comparison. "
            "It delegates to the same services and contracts as the ordinary Life Goods API."
        ),
    )
    app.add_middleware(
        TrustedProxyClientMiddleware,
        trusted_proxy_cidrs=resolved_settings.trusted_proxy_cidrs,
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(PhotoComparisonUploadLimitMiddleware)
    app.include_router(
        build_router(
            extraction_service,
            comparison_service,
            prefix=EXPERIMENTAL_PREFIX,
        )
    )
    app.include_router(
        build_label_reading_router(
            label_reading_service,
            khmer_rendering_service,
            path=EXPERIMENTAL_LABEL_READING_PATH,
        )
    )
    install_photo_comparison_openapi(app)
    install_label_reading_openapi(app)

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def index() -> HTMLResponse:
        return HTMLResponse(photo_comparison_page())

    @app.get("/scalar", include_in_schema=False)
    async def scalar_html() -> HTMLResponse:
        return get_scalar_api_reference(
            openapi_url=app.openapi_url or "/openapi.json",
            title=f"{app.title} - Scalar Reference",
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        _request: Request, _error: RequestValidationError
    ) -> JSONResponse:
        return _error_response(
            PhotoComparisonErrorCode.REQUEST_INVALID,
            "The photo-comparison request is invalid.",
            422,
        )

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

    for client in owned_clients:
        app.router.add_event_handler("shutdown", client.close)
    if resolved_provider is not None and hasattr(resolved_provider, "close") and not owned_clients:
        app.router.add_event_handler("shutdown", resolved_provider.close)
    return app


app = create_photo_comparison_app()
