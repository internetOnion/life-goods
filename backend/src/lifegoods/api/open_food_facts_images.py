from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response

from lifegoods.api.contracts import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.matching.external_images import (
    ExternalImageNotFoundError,
    ExternalImageSource,
    ExternalImageUnavailableError,
    ExternalImageUrlInvalidError,
)

router = APIRouter(prefix="/api/v1", tags=["Open Food Facts Images"])


def get_image_source() -> ExternalImageSource:
    raise RuntimeError("Open Food Facts image dependency is not configured")


@router.get(
    "/open-food-facts-images",
    operation_id="getOpenFoodFactsImage",
    responses={
        200: {
            "content": {
                media_type: {"schema": {"type": "string", "format": "binary"}}
                for media_type in ("image/gif", "image/jpeg", "image/png", "image/webp")
            }
        },
        400: {"model": ErrorEnvelope},
        404: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        502: {"model": ErrorEnvelope},
    },
    response_class=Response,
)
def get_open_food_facts_image(
    source: Annotated[ExternalImageSource, Depends(get_image_source)],
    url: Annotated[str, Query(min_length=1)],
) -> Response:
    try:
        image = source.fetch(url)
    except ExternalImageUrlInvalidError:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.REFERENCE_IMAGE_URL_INVALID,
                message="The reference image URL is not allowed.",
            )
        )
        return JSONResponse(status_code=400, content=envelope.model_dump())
    except ExternalImageNotFoundError:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.REFERENCE_IMAGE_NOT_FOUND,
                message="The reference image is no longer available.",
            )
        )
        return JSONResponse(status_code=404, content=envelope.model_dump())
    except ExternalImageUnavailableError:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.REFERENCE_IMAGE_SOURCE_UNAVAILABLE,
                message="The reference image is temporarily unavailable.",
            )
        )
        return JSONResponse(status_code=502, content=envelope.model_dump())

    return Response(
        content=image.content,
        media_type=image.media_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )
