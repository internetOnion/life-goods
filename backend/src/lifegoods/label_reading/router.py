"""HTTP route for Read This Label (docs/SPEC.md section 29.3)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from lifegoods.label_reading.contracts import (
    MAX_RENDERING_REQUEST_BYTES,
    KhmerRenderingRequest,
    KhmerRenderingResponse,
    LabelReading,
    PhotoRole,
)
from lifegoods.label_reading.khmer_rendering import KhmerRenderingService
from lifegoods.label_reading.service import LabelReadingService
from lifegoods.photo_comparison.contracts import (
    MAX_PHOTOS_PER_PRODUCT,
    PhotoComparisonErrorCode,
    PhotoComparisonErrorResponse,
)
from lifegoods.photo_comparison.images import PreparedImage
from lifegoods.photo_comparison.router import (
    client_address,
    error_response,
    photo_error_response,
    prepare_uploads,
    success_response,
)

_RENDERING_REQUEST_SCHEMA = KhmerRenderingRequest.model_json_schema(
    ref_template="#/components/schemas/{model}"
)
_RENDERING_REQUEST_DEFS = _RENDERING_REQUEST_SCHEMA.pop("$defs", {})

_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status: {"model": PhotoComparisonErrorResponse}
    for status in (413, 415, 422, 429, 500, 502, 503, 504)
}


def build_label_reading_router(
    service: LabelReadingService,
    rendering_service: KhmerRenderingService,
    *,
    path: str,
) -> APIRouter:
    router = APIRouter(tags=["Read This Label"])

    @router.post(
        path,
        operation_id="createLabelReading",
        response_model=LabelReading,
        summary="Read one Product's printed label from package photos",
        description=(
            "Returns a Label Reading: Photo Evidence transcribed from the Shopper's photos by "
            "the configured AI provider. It is not an Open Food Facts Source Record, is not "
            "verified, and is not retained. The request carries no Product or Barcode "
            "identifier."
        ),
        responses={
            200: {"description": "Label Reading: complete, partial, or retake-required."},
            **_ERROR_RESPONSES,
        },
    )
    def create_label_reading(
        request: Request,
        photos: Annotated[
            list[UploadFile],
            File(
                description=(
                    f"One to {MAX_PHOTOS_PER_PRODUCT} JPEG, PNG or HEIC photos of one "
                    "Product's package, in capture order."
                )
            ),
        ],
        photo_roles: Annotated[
            list[PhotoRole] | None,
            Form(description="Capture role of each photo, in the same order as photos."),
        ] = None,
    ) -> JSONResponse:
        uploads = photos
        prepared: list[PreparedImage] = []
        try:
            roles = list(photo_roles) if photo_roles else [PhotoRole.UNSPECIFIED] * len(uploads)
            if len(roles) != len(uploads):
                return error_response(
                    PhotoComparisonErrorCode.REQUEST_INVALID,
                    "Submit one capture role for each photo.",
                    422,
                )
            rate_limit_key = client_address(request)
            service.ensure_available()
            # Admit before decoding so rate-limited clients cannot force image work.
            with service.admission.admit(rate_limit_key) as admission:
                outcome = prepare_uploads(request, uploads)
                if isinstance(outcome, JSONResponse):
                    return outcome
                prepared = outcome
                reading = service.read(
                    prepared, roles, rate_limit_key=rate_limit_key, admission=admission
                )
            return success_response(reading)
        except Exception as error:
            return photo_error_response(error)
        finally:
            for upload in uploads:
                upload.file.close()
            prepared.clear()

    @router.post(
        f"{path}/khmer-renderings",
        operation_id="renderLabelReadingKhmer",
        response_model=KhmerRenderingResponse,
        summary="Render a Label Reading's Printed Text into Khmer",
        description=(
            "Returns a machine-generated Khmer Rendering of Printed Text read from the "
            "Shopper's photos. It is not Khmer Translation and not verified label wording, "
            "and nothing is stored. Text already in Khmer script is not_needed; a block "
            "that fails validation is unavailable."
        ),
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/KhmerRenderingRequest"}
                    }
                },
            }
        },
        responses={
            200: {"description": "Per-block Khmer Rendering states."},
            **_ERROR_RESPONSES,
        },
    )
    async def render_label_reading_khmer(request: Request) -> JSONResponse:
        content_length = request.headers.get("content-length")
        if (
            content_length is not None
            and content_length.isdigit()
            and int(content_length) > MAX_RENDERING_REQUEST_BYTES
        ):
            return _rendering_too_large()
        body = bytearray()
        try:
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > MAX_RENDERING_REQUEST_BYTES:
                    return _rendering_too_large()
            parsed = KhmerRenderingRequest.model_validate_json(bytes(body))
        except (ValidationError, ValueError, UnicodeDecodeError):
            return error_response(
                PhotoComparisonErrorCode.REQUEST_INVALID,
                "The Khmer Rendering request is invalid.",
                422,
            )
        try:
            rendering = await run_in_threadpool(
                rendering_service.render, parsed, rate_limit_key=client_address(request)
            )
            return success_response(rendering)
        except Exception as error:
            return photo_error_response(error)

    return router


def install_label_reading_openapi(app: FastAPI) -> None:
    """Register the hand-parsed Khmer Rendering request body in OpenAPI components."""

    original_openapi = app.openapi

    def openapi() -> dict[str, Any]:
        schema = original_openapi()
        schemas = schema.setdefault("components", {}).setdefault("schemas", {})
        for name, definition in _RENDERING_REQUEST_DEFS.items():
            schemas.setdefault(name, definition)
        schemas.setdefault("KhmerRenderingRequest", _RENDERING_REQUEST_SCHEMA)
        return schema

    app.openapi = openapi


def _rendering_too_large() -> JSONResponse:
    return error_response(
        PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
        "The Khmer Rendering request must be 64 KiB or smaller.",
        413,
    )


__all__ = ["build_label_reading_router", "install_label_reading_openapi"]
