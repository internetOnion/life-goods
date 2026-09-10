"""Standalone HTTP routes for the local photo-comparison workflow."""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from lifegoods.photo_comparison.contracts import (
    MAX_COMPARISON_REQUEST_BYTES,
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

EXTRACTION_PATH = "/api/experimental/photo-comparison/extractions"
COMPARISON_PATH = "/api/experimental/photo-comparison/comparisons"

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
                "message": "Only JPEG and PNG photos are supported.",
            }
        },
    },
    "rate_limit": {
        "summary": "Extraction rate limit",
        "value": {
            "error": {
                "code": "rate_limit_exceeded",
                "message": "The local extraction limit is 10 requests per minute.",
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
        "configuration_version": "photo-extraction-v1",
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


def _error(code: PhotoComparisonErrorCode, message: str, status_code: int) -> JSONResponse:
    response = PhotoComparisonErrorResponse(
        error=PhotoComparisonErrorDetail(code=code, message=message)
    )
    return JSONResponse(
        status_code=status_code,
        content=json.loads(response.model_dump_json()),
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


def _success(model: Extraction | ComparisonResponse) -> JSONResponse:
    body = model.model_dump_json().encode("utf-8")
    if len(body) > MAX_EXTRACTION_RESPONSE_BYTES:
        return _error(
            PhotoComparisonErrorCode.INTERNAL_ERROR,
            "The extraction response exceeded the local response limit.",
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
        raise ImageValidationError("The upload request must be 32 MiB or smaller.")
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
            raise ImageValidationError("Each photo must be 10 MiB or smaller.")
        chunks.append(chunk)
    if total > remaining:
        raise ImageValidationError("The upload request must be 32 MiB or smaller.")
    return b"".join(chunks)


def build_router(
    extraction_service: PhotoExtractionService,
    comparison_service: PhotoComparisonService,
) -> APIRouter:
    router = APIRouter(prefix="/api/experimental/photo-comparison", tags=["Photo comparison"])

    @router.post(
        "/extractions",
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
            str | None, Form(description="Local Product panel identifier.")
        ] = None,
        photos: Annotated[
            list[UploadFile] | None,
            File(description="One to six JPEG or PNG photos, submitted in preview order."),
        ] = None,
    ) -> JSONResponse:
        uploads = photos or []
        content_length = _content_length(request)
        if content_length is not None and content_length > MAX_UPLOAD_BYTES:
            return _error(
                PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
                "The upload request must be 32 MiB or smaller.",
                413,
            )
        if not product_id or len(product_id) > 128:
            return _error(
                PhotoComparisonErrorCode.REQUEST_INVALID,
                "A Product panel identifier is required.",
                422,
            )
        if not 1 <= len(uploads) <= 6:
            return _error(
                PhotoComparisonErrorCode.REQUEST_INVALID,
                "Submit between one and six photos for one Product.",
                422,
            )

        prepared = []
        total_bytes = 0
        try:
            for upload in uploads:
                data = _read_upload(upload, MAX_UPLOAD_BYTES - total_bytes)
                total_bytes += len(data)
                if total_bytes > MAX_UPLOAD_BYTES:
                    return _error(
                        PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
                        "The upload request must be 32 MiB or smaller.",
                        413,
                    )
                prepared.append(prepare_image(data, declared_content_type=upload.content_type))
            extraction = extraction_service.extract(product_id, prepared)
            return _success(extraction)
        except ImageValidationError as error:
            code = (
                PhotoComparisonErrorCode.UNSUPPORTED_IMAGE_FORMAT
                if error.unsupported_format
                else PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED
            )
            status = 415 if code is PhotoComparisonErrorCode.UNSUPPORTED_IMAGE_FORMAT else 413
            return _error(code, str(error), status)
        except MissingCredentialsError as error:
            return _error(PhotoComparisonErrorCode.PROVIDER_UNAVAILABLE, str(error), 503)
        except ExtractionRateLimitError as error:
            return _error(PhotoComparisonErrorCode.RATE_LIMIT_EXCEEDED, str(error), 429)
        except ExtractionCapacityError as error:
            return _error(PhotoComparisonErrorCode.CAPACITY_LIMIT_EXCEEDED, str(error), 429)
        except PhotoProviderTimeout as error:
            return _error(PhotoComparisonErrorCode.PROVIDER_TIMEOUT, str(error), 504)
        except (PhotoProviderUnavailable, OSError) as error:
            return _error(PhotoComparisonErrorCode.PROVIDER_UNAVAILABLE, str(error), 503)
        except (PhotoProviderOutputInvalid, ProviderOutputError, ValidationError) as error:
            return _error(PhotoComparisonErrorCode.PROVIDER_OUTPUT_INVALID, str(error), 502)
        except Exception:
            return _error(
                PhotoComparisonErrorCode.INTERNAL_ERROR,
                "The photo-comparison request could not be completed.",
                500,
            )
        finally:
            for upload in uploads:
                upload.file.close()
            prepared.clear()

    @router.post(
        "/comparisons",
        response_model=ComparisonResponse,
        summary="Compare two submitted nutrition extractions",
        responses={
            200: {
                "description": "Reported and deterministic comparison rows.",
                "content": {"application/json": {"examples": {"partial": _COMPARISON_EXAMPLE}}},
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
            500: {"model": PhotoComparisonErrorResponse},
        },
    )
    async def compare_extractions(request: Request) -> JSONResponse:
        content_length = _content_length(request)
        if content_length is not None and content_length > MAX_COMPARISON_REQUEST_BYTES:
            return _error(
                PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
                "The comparison request must be 1 MiB or smaller.",
                413,
            )
        body = bytearray()
        try:
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > MAX_COMPARISON_REQUEST_BYTES:
                    return _error(
                        PhotoComparisonErrorCode.SIZE_LIMIT_EXCEEDED,
                        "The comparison request must be 1 MiB or smaller.",
                        413,
                    )
            parsed = ComparisonRequest.model_validate_json(bytes(body))
        except (ValidationError, ValueError, UnicodeDecodeError):
            return _error(
                PhotoComparisonErrorCode.REQUEST_INVALID,
                "The comparison request is invalid.",
                422,
            )
        try:
            return _success(comparison_service.compare(parsed))
        except Exception:
            return _error(
                PhotoComparisonErrorCode.INTERNAL_ERROR,
                "The comparison request could not be completed.",
                500,
            )

    return router


__all__ = ["COMPARISON_PATH", "EXTRACTION_PATH", "build_router"]
