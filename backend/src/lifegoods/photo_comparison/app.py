"""Standalone app for the opt-in local photo-comparison experiment."""

from __future__ import annotations

from typing import Any

import httpx2 as httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from scalar_fastapi import get_scalar_api_reference

from lifegoods.core.security import SecurityHeadersMiddleware
from lifegoods.core.settings import Settings
from lifegoods.photo_comparison.contracts import (
    PhotoComparisonErrorCode,
    PhotoComparisonErrorDetail,
    PhotoComparisonErrorResponse,
)
from lifegoods.photo_comparison.gemini import (
    PHOTO_MODEL,
    PHOTO_TIMEOUT_SECONDS,
    GeminiPhotoExtractionAdapter,
)
from lifegoods.photo_comparison.router import build_router
from lifegoods.photo_comparison.service import (
    PhotoComparisonService,
    PhotoExtractionService,
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
) -> FastAPI:
    resolved_settings = settings or Settings()
    owned_clients: list[httpx.Client] = []
    resolved_provider = provider
    if resolved_provider is None and resolved_settings.gemini_api_key:
        client = httpx.Client(timeout=PHOTO_TIMEOUT_SECONDS)
        owned_clients.append(client)
        resolved_provider = GeminiPhotoExtractionAdapter(
            resolved_settings.gemini_api_key,
            model=PHOTO_MODEL,
            timeout_seconds=PHOTO_TIMEOUT_SECONDS,
            http_client=client,
        )

    extraction_service = PhotoExtractionService(resolved_provider)
    comparison_service = PhotoComparisonService()
    app = FastAPI(
        title="Life Goods Photo Comparison Lab",
        version="0.1.0",
        description=(
            "Local-only experimental photo evidence extraction and deterministic comparison. "
            "This app is separate from the ordinary Life Goods API."
        ),
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.include_router(build_router(extraction_service, comparison_service))

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

    for client in owned_clients:
        app.router.add_event_handler("shutdown", client.close)
    if resolved_provider is not None and hasattr(resolved_provider, "close") and not owned_clients:
        app.router.add_event_handler("shutdown", resolved_provider.close)
    return app


app = create_photo_comparison_app()
