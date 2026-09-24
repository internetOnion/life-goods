"""HTTP route for Read This Label (docs/SPEC.md section 29.3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from lifegoods.label_reading.contracts import LabelReading, PhotoRole
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

_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status: {"model": PhotoComparisonErrorResponse}
    for status in (413, 415, 422, 429, 500, 502, 503, 504)
}


def build_label_reading_router(
    service: LabelReadingService,
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
            outcome = prepare_uploads(request, uploads)
            if isinstance(outcome, JSONResponse):
                return outcome
            prepared = outcome
            reading = service.read(prepared, roles, rate_limit_key=client_address(request))
            return success_response(reading)
        except Exception as error:
            return photo_error_response(error)
        finally:
            for upload in uploads:
                upload.file.close()
            prepared.clear()

    return router


__all__ = ["build_label_reading_router"]
