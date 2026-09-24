"""HTTP routes shared by the normal API and standalone photo-comparison app."""

from __future__ import annotations

import json
from typing import Annotated, Any

from fastapi import APIRouter, FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from lifegoods.photo_comparison.contracts import (
    MAX_COMPARISON_REQUEST_BYTES,
    MAX_PHOTOS_PER_PRODUCT,
    ComparisonRequest,
    ComparisonResponse,
    Extraction,
    PhotoComparisonErrorCode,
    PhotoComparisonErrorDetail,
    PhotoComparisonErrorResponse,
)
from lifegoods.photo_comparison.gemini import (
    MAX_EXTRACTION_RESPONSE_BYTES,
    PhotoProviderOutputInvalid,
    PhotoProviderTimeout,
    PhotoProviderUnavailable,
)
from lifegoods.photo_comparison.images import (
    MAX_PHOTO_BYTES,
    MAX_UPLOAD_BYTES,
    ImageValidationError,
    PreparedImage,
    prepare_image,
)
from lifegoods.photo_comparison.normalization import ProviderOutputError
from lifegoods.photo_comparison.service import (
    ExtractionCapacityError,
    ExtractionRateLimitError,
    MissingCredentialsError,
    PhotoComparisonService,
    PhotoExtractionService,
)

EXTRACTION_PATH = "/api/v1/photo-comparison/extractions"
COMPARISON_PATH = "/api/v1/photo-comparison/comparisons"
EXPERIMENTAL_PREFIX = "/api/experimental/photo-comparison"
LABEL_READING_PATH = "/api/v1/label-readings"
EXPERIMENTAL_LABEL_READING_PATH = "/api/experimental/label-readings"
# Multipart photo-upload routes. Each one gets the pre-parse body cap and the
# typed photo error envelope; new upload routes must be added here.
PHOTO_UPLOAD_PATHS: frozenset[str] = frozenset(
    {
        EXTRACTION_PATH,
        f"{EXPERIMENTAL_PREFIX}/extractions",
        LABEL_READING_PATH,
        EXPERIMENTAL_LABEL_READING_PATH,
    }
)


def is_photo_upload_path(path: str) -> bool:
    return path in PHOTO_UPLOAD_PATHS

_ERROR_EXAMPLES = {
    "validation": {
        "summary": "Invalid comparison request",
        "value": {
            "error": {
                "code": "request_invalid",
                "message": "The comparison request is invalid.",
            }
        },
    },
    "upload_limit": {
        "summary": "Upload limit",
        "value": {
            "error": {
                "code": "size_limit_exceeded",
                "message": "The upload request must be 32 MiB or smaller.",
            }
        },
    },
    "unsupported_format": {
        "summary": "Unsupported image format",
        "value": {
            "error": {
                "code": "unsupported_image_format",
                "message": "Only JPEG, PNG and HEIC photos are supported.",
            }
        },
    },
    "rate_limit": {
        "summary": "Extraction rate limit",
        "value": {
            "error": {
                "code": "rate_limit_exceeded",
                "message": "The extraction limit is 10 requests per minute.",
            }
        },
    },
    "comparison_limit": {
        "summary": "Comparison request limit",
        "value": {
            "error": {
                "code": "size_limit_exceeded",
                "message": "The comparison request must be 1 MiB or smaller.",
            }
        },
    },
    "capacity": {
        "summary": "Provider capacity",
        "value": {
            "error": {
                "code": "capacity_limit_exceeded",
                "message": "Another extraction is already in progress. Retry when it finishes.",
            }
        },
    },
    "provider": {
        "summary": "Provider failure",
        "value": {
            "error": {
                "code": "provider_unavailable",
                "message": "The extraction provider could not be reached.",
            }
        },
    },
}

_PARTIAL_EXTRACTION_EXAMPLE = {
    "summary": "Partial extraction",
    "value": {
        "schema_version": 1,
        "product_id": "left",
        "images": [
            {
                "image_id": "img-example",
                "original_image_id": "original-example",
                "processed_image_id": "processed-example",
                "role": "submitted_photo",
                "width": 1200,
                "height": 1600,
            }
        ],
        "package_quantity": None,
        "nutrition_columns": [],
        "outcome": "retake_required",
        "retake_reasons": ["Add a clear package-weight photo."],
        "provider": "google",
        "model": "gemini-3.8-flash",
        "configuration_version": "photo-extraction-v3",
    },
}

_COMPARISON_EXAMPLE = {
    "summary": "Conditional partial comparison",
    "value": {
        "schema_version": 1,
        "calculated_from_submitted_evidence": True,
        "left_product_id": "left",
        "right_product_id": "right",
        "rows": [
            {
                "nutrient": "sodium",
                "left": None,
                "right": None,
                "normalized_left": None,
                "normalized_right": None,
                "derived_difference": None,
                "calculation_basis": None,
                "assumptions": [],
                "state": "not_comparable",
                "reason": "A selected nutrition column is unavailable.",
            }
        ],
    },
}

_COMPARISON_REQUEST_SCHEMA = ComparisonRequest.model_json_schema(
    ref_template="#/components/schemas/{model}"
)
_COMPARISON_REQUEST_SCHEMA.pop("$defs", None)

def error_response(
    code: PhotoComparisonErrorCode,
    message: str,
    status_code: int,
    *,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    response = PhotoComparisonErrorResponse(
        error=PhotoComparisonErrorDetail(code=code, message=message)
    )
    return JSONResponse(
        status_code=status_code,
        content=json.loads(response.model_dump_json()),
        headers={
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            **(headers or {}),
        },
    )


class PhotoComparisonUploadLimitMiddleware:
    """Reject oversized multipart bodies before FastAPI parses or spools uploads."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope.get("type") != "http"
            or scope.get("method") != "POST"
            or not is_photo_upload_path(str(scope.get("path", "")))
        ):
            await self.app(scope, receive, send)
            return

        content_length = _header_value(scope, b"content-length")
        if content_length is not None:
            try:
                if int(content_length) > MAX_UPLOAD_BYTES:
                    await _send_error_response(scope, receive, send)
                    return
            except ValueError:
                pass

        messages: list[Message] = []
        total_bytes = 0
        while True:
            message = await receive()
            if message["type"] == "http.request":
                total_bytes += len(message.get("body", b""))
                if total_bytes > MAX_UPLOAD_BYTES:
                    await _send_error_response(scope, receive, send)
                    return
                messages.append(message)
                if not message.get("more_body", False):
                    break
            else:
                messages.append(message)
                break

        replay = iter(messages)

        async def replay_receive() -> Message:
            try:
                return next(replay)
            except StopIteration:
                return {"type": "http.disconnect"}

        await self.app(scope, replay_receive, send)


def install_photo_comparison_openapi(app: FastAPI) -> None:
    """Expose multipart uploads as browser file values in OpenAPI 3.1."""

    original_openapi = app.openapi

    def openapi() -> dict[str, Any]:
        schema = original_openapi()
        schemas = schema.get("components", {}).get("schemas", {})
        for body_name in ("Body_extractPhotoComparison", "Body_createLabelReading"):
            photos = schemas.get(body_name, {}).get("properties", {}).get("photos", {})
            items = photos.get("items")
            if isinstance(items, dict):
                items.pop("contentMediaType", None)
                items["format"] = "binary"
            if isinstance(photos, dict) and photos:
                photos["minItems"] = 1
                photos["maxItems"] = MAX_PHOTOS_PER_PRODUCT
        return schema

    app.openapi = openapi


def _header_value(scope: Scope, name: bytes) -> str | None:
    for header_name, header_value in scope.get("headers", []):
        if header_name.lower() == name:
            return header_value.decode("latin-1")
    return None


async def _send_error_response(scope: Scope, receive: Receive, send: Send) -> None:
    response = error_response(
        PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
        "The upload request must be 32 MiB or smaller.",
        413,
    )
    await response(scope, receive, send)


def photo_comparison_http_exception_response(
    path: str, status_code: int
) -> JSONResponse | None:
    if not is_photo_upload_path(path):
        return None
    if status_code == 413:
        return error_response(
            PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
            "The upload request must be 32 MiB or smaller.",
            413,
        )
    return error_response(
        PhotoComparisonErrorCode.REQUEST_INVALID,
        "The photo-comparison request is invalid.",
        422,
    )


def success_response(model: BaseModel) -> JSONResponse:
    body = model.model_dump_json().encode("utf-8")
    if len(body) > MAX_EXTRACTION_RESPONSE_BYTES:
        return error_response(
            PhotoComparisonErrorCode.INTERNAL_ERROR,
            "The photo-comparison response exceeded the local response limit.",
            500,
        )
    return JSONResponse(
        status_code=200,
        content=json.loads(body),
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


def _content_length(request: Request) -> int | None:
    value = request.headers.get("content-length")
    if value is None:
        return None
    try:
        parsed = int(value)
    except ValueError:
        return None
    return parsed if parsed >= 0 else None


def _read_upload(upload: UploadFile, remaining: int) -> bytes:
    if remaining <= 0:
        raise ImageValidationError(
            "The upload request must be 32 MiB or smaller.", size_limit=True
        )
    chunks: list[bytes] = []
    total = 0
    while total <= MAX_PHOTO_BYTES:
        chunk = upload.file.read(
            min(1024 * 1024, MAX_PHOTO_BYTES + 1 - total, remaining + 1 - total)
        )
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_PHOTO_BYTES:
            raise ImageValidationError("Each photo must be 10 MiB or smaller.", size_limit=True)
        chunks.append(chunk)
    if total > remaining:
        raise ImageValidationError(
            "The upload request must be 32 MiB or smaller.", size_limit=True
        )
    return b"".join(chunks)


def prepare_uploads(
    request: Request, uploads: list[UploadFile]
) -> list[PreparedImage] | JSONResponse:
    """Enforce photo count and size limits, then prepare each image for a provider.

    Image validation errors propagate to ``photo_error_response``.
    """
    content_length = _content_length(request)
    if content_length is not None and content_length > MAX_UPLOAD_BYTES:
        return error_response(
            PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
            "The upload request must be 32 MiB or smaller.",
            413,
        )
    if not 1 <= len(uploads) <= MAX_PHOTOS_PER_PRODUCT:
        return error_response(
            PhotoComparisonErrorCode.REQUEST_INVALID,
            f"Submit between one and {MAX_PHOTOS_PER_PRODUCT} photos for one Product.",
            422,
        )
    prepared: list[PreparedImage] = []
    total_bytes = 0
    for upload in uploads:
        data = _read_upload(upload, MAX_UPLOAD_BYTES - total_bytes)
        total_bytes += len(data)
        if total_bytes > MAX_UPLOAD_BYTES:
            return error_response(
                PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
                "The upload request must be 32 MiB or smaller.",
                413,
            )
        prepared.append(prepare_image(data, declared_content_type=upload.content_type))
    return prepared


def photo_error_response(error: Exception) -> JSONResponse:
    """Map a photo-operation failure to the typed, sanitized error envelope."""
    if isinstance(error, ImageValidationError):
        if error.unsupported_format:
            return error_response(
                PhotoComparisonErrorCode.UNSUPPORTED_IMAGE_FORMAT, str(error), 415
            )
        if error.size_limit:
            return error_response(PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED, str(error), 413)
        return error_response(PhotoComparisonErrorCode.REQUEST_INVALID, str(error), 422)
    if isinstance(error, MissingCredentialsError):
        return error_response(PhotoComparisonErrorCode.PROVIDER_UNAVAILABLE, str(error), 503)
    if isinstance(error, ExtractionRateLimitError):
        return error_response(
            PhotoComparisonErrorCode.RATE_LIMIT_EXCEEDED,
            str(error),
            429,
            headers={"Retry-After": str(error.retry_after)},
        )
    if isinstance(error, ExtractionCapacityError):
        return error_response(PhotoComparisonErrorCode.CAPACITY_LIMIT_EXCEEDED, str(error), 429)
    if isinstance(error, PhotoProviderTimeout):
        return error_response(PhotoComparisonErrorCode.PROVIDER_TIMEOUT, str(error), 504)
    if isinstance(error, (PhotoProviderUnavailable, OSError)):
        return error_response(PhotoComparisonErrorCode.PROVIDER_UNAVAILABLE, str(error), 503)
    if isinstance(error, (PhotoProviderOutputInvalid, ProviderOutputError, ValidationError)):
        return error_response(PhotoComparisonErrorCode.PROVIDER_OUTPUT_INVALID, str(error), 502)
    return error_response(
        PhotoComparisonErrorCode.INTERNAL_ERROR,
        "The photo-comparison request could not be completed.",
        500,
    )


def build_router(
    extraction_service: PhotoExtractionService,
    comparison_service: PhotoComparisonService,
    *,
    prefix: str = "/api/v1/photo-comparison",
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=["Photo comparison"])

    @router.post(
        "/extractions",
        operation_id="extractPhotoComparison",
        response_model=Extraction,
        summary="Extract visible nutrition evidence from Product photos",
        responses={
            200: {
                "description": (
                    "Validated visible-evidence extraction, complete, partial, or retake-required."
                ),
                "content": {
                    "application/json": {"examples": {"partial": _PARTIAL_EXTRACTION_EXAMPLE}}
                },
            },
            413: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {
                        "examples": {"upload_limit": _ERROR_EXAMPLES["upload_limit"]}
                    }
                },
            },
            422: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {"examples": {"validation": _ERROR_EXAMPLES["validation"]}}
                },
            },
            415: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {
                        "examples": {"unsupported_format": _ERROR_EXAMPLES["unsupported_format"]}
                    }
                },
            },
            429: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {
                        "examples": {
                            "rate_limit": _ERROR_EXAMPLES["rate_limit"],
                            "capacity": _ERROR_EXAMPLES["capacity"],
                        }
                    }
                },
            },
            500: {"model": PhotoComparisonErrorResponse},
            502: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {
                        "examples": {
                            "provider_output": {
                                "summary": "Invalid provider output",
                                "value": {
                                    "error": {
                                        "code": "provider_output_invalid",
                                        "message": "The provider returned invalid evidence.",
                                    }
                                },
                            }
                        }
                    }
                },
            },
            503: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {"examples": {"provider": _ERROR_EXAMPLES["provider"]}}
                },
            },
            504: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {
                        "examples": {
                            "timeout": {
                                "summary": "Provider timeout",
                                "value": {
                                    "error": {
                                        "code": "provider_timeout",
                                        "message": "The extraction provider timed out.",
                                    }
                                },
                            }
                        }
                    }
                },
            },
        },
    )
    def extract_photos(
        request: Request,
        product_id: Annotated[
            str, Form(description="Local Product panel identifier.")
        ],
        photos: Annotated[
            list[UploadFile],
            File(
                description=(
                    f"One to {MAX_PHOTOS_PER_PRODUCT} JPEG, PNG or HEIC photos, "
                    "submitted in preview order."
                )
            ),
        ],
    ) -> JSONResponse:
        uploads = photos
        if not product_id or len(product_id) > 128:
            for upload in uploads:
                upload.file.close()
            return error_response(
                PhotoComparisonErrorCode.REQUEST_INVALID,
                "A Product panel identifier is required.",
                422,
            )
        prepared: list[PreparedImage] = []
        try:
            outcome = prepare_uploads(request, uploads)
            if isinstance(outcome, JSONResponse):
                return outcome
            prepared = outcome
            extraction = extraction_service.extract(
                product_id,
                prepared,
                rate_limit_key=client_address(request),
            )
            return success_response(extraction)
        except Exception as error:
            return photo_error_response(error)
        finally:
            for upload in uploads:
                upload.file.close()
            prepared.clear()

    @router.post(
        "/comparisons",
        operation_id="comparePhotoComparison",
        response_model=ComparisonResponse,
        summary="Compare two submitted nutrition extractions",
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {"schema": _COMPARISON_REQUEST_SCHEMA}
                },
            }
        },
        responses={
            200: {
                "description": "Reported and deterministic comparison rows.",
                "content": {"application/json": {"examples": {"partial": _COMPARISON_EXAMPLE}}},
            },
            413: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {
                        "examples": {
                            "comparison_limit": _ERROR_EXAMPLES["comparison_limit"]
                        }
                    }
                },
            },
            422: {
                "model": PhotoComparisonErrorResponse,
                "content": {
                    "application/json": {"examples": {"validation": _ERROR_EXAMPLES["validation"]}}
                },
            },
            500: {"model": PhotoComparisonErrorResponse},
        },
    )
    async def compare_extractions(request: Request) -> JSONResponse:
        content_length = _content_length(request)
        if content_length is not None and content_length > MAX_COMPARISON_REQUEST_BYTES:
            return error_response(
                PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
                "The comparison request must be 1 MiB or smaller.",
                413,
            )
        body = bytearray()
        try:
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > MAX_COMPARISON_REQUEST_BYTES:
                    return error_response(
                        PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
                        "The comparison request must be 1 MiB or smaller.",
                        413,
                    )
            parsed = ComparisonRequest.model_validate_json(bytes(body))
        except (ValidationError, ValueError, UnicodeDecodeError):
            return error_response(
                PhotoComparisonErrorCode.REQUEST_INVALID,
                "The comparison request is invalid.",
                422,
            )
        try:
            return success_response(comparison_service.compare(parsed))
        except Exception:
            return error_response(
                PhotoComparisonErrorCode.INTERNAL_ERROR,
                "The comparison request could not be completed.",
                500,
            )

    return router


def client_address(request: Request) -> str:
    return request.client.host if request.client is not None else "unknown"


__all__ = [
    "COMPARISON_PATH",
    "EXPERIMENTAL_PREFIX",
    "EXPERIMENTAL_LABEL_READING_PATH",
    "EXTRACTION_PATH",
    "LABEL_READING_PATH",
    "PHOTO_UPLOAD_PATHS",
    "PhotoComparisonUploadLimitMiddleware",
    "build_router",
    "error_response",
    "client_address",
    "photo_error_response",
    "prepare_uploads",
    "success_response",
    "install_photo_comparison_openapi",
    "is_photo_upload_path",
    "photo_comparison_http_exception_response",
]
