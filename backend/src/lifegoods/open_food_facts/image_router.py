import logging
from collections.abc import Callable
from time import monotonic as system_monotonic
from typing import Annotated, Protocol

import redis
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, Response

from lifegoods.core.errors import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.core.rate_limit import RedisSlidingWindowRateLimiter
from lifegoods.open_food_facts.models import (
    ExternalImageNotFoundError,
    ExternalImageRateLimitError,
    ExternalImageSource,
    ExternalImageUnavailableError,
    ExternalImageUrlInvalidError,
)

router = APIRouter(prefix="/api/v1", tags=["Open Food Facts Images"])


def get_image_source() -> ExternalImageSource:
    raise RuntimeError("Open Food Facts image dependency is not configured")


class ImageProxyRateLimiter(Protocol):
    def try_acquire(self, key: str) -> tuple[bool, int]: ...


class RedisImageProxyRateLimiter(RedisSlidingWindowRateLimiter):
    """Per-client limit on uncached fetches, so one client cannot spend the shared
    upstream image budget."""

    def __init__(
        self,
        client: redis.Redis,
        requests_per_minute: int,
        *,
        monotonic: Callable[[], float] = system_monotonic,
    ) -> None:
        super().__init__(
            client,
            requests_per_minute,
            key_prefix="off-image:rate-limit",
            display_name="Open Food Facts image",
            event_prefix="off_image",
            logger=logging.getLogger(__name__),
            monotonic=monotonic,
        )


def get_image_rate_limiter() -> ImageProxyRateLimiter:
    raise RuntimeError("Open Food Facts image rate limiter dependency is not configured")


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
        429: {"model": ErrorEnvelope},
        502: {"model": ErrorEnvelope},
    },
    response_class=Response,
)
def get_open_food_facts_image(
    request: Request,
    source: Annotated[ExternalImageSource, Depends(get_image_source)],
    limiter: Annotated[ImageProxyRateLimiter, Depends(get_image_rate_limiter)],
    url: Annotated[str, Query(min_length=1)],
) -> Response:
    client = request.client.host if request.client is not None else "unknown"
    try:
        # Cached images are free; the per-client limit is charged only for upstream fetches.
        image = source.fetch(url, admit=lambda: limiter.try_acquire(client))
    except ExternalImageRateLimitError as error:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.RATE_LIMIT_EXCEEDED,
                message="Too many requests. Please try again later.",
            )
        )
        return JSONResponse(
            status_code=429,
            content=envelope.model_dump(),
            headers={"Retry-After": str(error.retry_after)},
        )
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
