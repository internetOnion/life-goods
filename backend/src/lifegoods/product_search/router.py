from __future__ import annotations

import logging
from time import monotonic
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from lifegoods.product_lookup.contracts import (
    DatasetSnapshotResponse,
    ProductLookupErrorMetaResponse,
    SourceAttributionResponse,
)
from lifegoods.product_lookup.models import DatasetUnavailableError
from lifegoods.product_search.contracts import (
    ProductSearchDataResponse,
    ProductSearchErrorCode,
    ProductSearchErrorDetail,
    ProductSearchErrorResponse,
    ProductSearchMetaResponse,
    ProductSearchResponse,
    SearchPaginationMetaResponse,
)
from lifegoods.product_search.metrics import ProductSearchMetrics
from lifegoods.product_search.query import (
    InvalidCursorError,
    QueryValidationError,
    parse_and_validate_query,
)
from lifegoods.product_search.rate_limit import ProductSearchRateLimiter
from lifegoods.product_search.service import (
    SearchProducts,
    SearchTimeoutError,
    SearchUnavailableError,
)

router = APIRouter(tags=["Products"])
logger = logging.getLogger(__name__)


def get_product_search() -> SearchProducts:
    raise RuntimeError("Product Search application dependency is not configured")


def get_product_search_rate_limiter() -> ProductSearchRateLimiter:
    raise RuntimeError("Product Search rate limiter dependency is not configured")


def get_product_search_metrics() -> ProductSearchMetrics:
    raise RuntimeError("Product Search metrics dependency is not configured")


@router.get(
    "/api/v1/products/search",
    operation_id="searchProducts",
    summary="Search Products",
    description=(
        "Searches Products in the selected local Open Food Facts Dataset Snapshot "
        "by Barcode, name, or brand."
    ),
    response_model=ProductSearchResponse,
    responses={
        422: {"model": ProductSearchErrorResponse},
        429: {"model": ProductSearchErrorResponse},
        500: {"model": ProductSearchErrorResponse},
        503: {"model": ProductSearchErrorResponse},
    },
)
def search_products(
    request: Request,
    q: Annotated[
        str,
        Query(
            description="Search query: Barcode, product name, or brand.",
        ),
    ],
    search: Annotated[SearchProducts, Depends(get_product_search)],
    limiter: Annotated[ProductSearchRateLimiter, Depends(get_product_search_rate_limiter)],
    metrics: Annotated[ProductSearchMetrics, Depends(get_product_search_metrics)],
    cursor: Annotated[
        str | None,
        Query(
            description="Optional continuation token for pagination.",
        ),
    ] = None,
) -> ProductSearchResponse | JSONResponse:
    started_at = monotonic()
    try:
        allowed, retry_after = limiter.try_acquire(_client_address(request))
        if not allowed:
            return _error_response(
                status_code=429,
                code=ProductSearchErrorCode.RATE_LIMIT_EXCEEDED,
                message="Too many requests. Please try again later.",
                started_at=started_at,
                metrics=metrics,
                headers={"Retry-After": str(retry_after)},
            )

        try:
            parsed_query = parse_and_validate_query(q)
        except QueryValidationError as error:
            return _error_response(
                status_code=422,
                code=ProductSearchErrorCode(error.code),
                message=error.message,
                started_at=started_at,
                metrics=metrics,
            )

        try:
            result = search.execute(parsed_query, cursor=cursor)
        except InvalidCursorError as error:
            return _error_response(
                status_code=422,
                code=ProductSearchErrorCode.INVALID_CURSOR,
                message=error.message,
                started_at=started_at,
                metrics=metrics,
            )
        except SearchTimeoutError as error:
            dataset_response = (
                DatasetSnapshotResponse(
                    version=error.dataset.version,
                    retrieved_at=error.dataset.retrieved_at,
                )
                if error.dataset is not None
                else None
            )
            return _error_response(
                status_code=503,
                code=ProductSearchErrorCode.SEARCH_TIMEOUT,
                message=error.message,
                started_at=started_at,
                metrics=metrics,
                dataset=dataset_response,
            )
        except SearchUnavailableError as error:
            dataset_response = (
                DatasetSnapshotResponse(
                    version=error.dataset.version,
                    retrieved_at=error.dataset.retrieved_at,
                )
                if error.dataset is not None
                else None
            )
            return _error_response(
                status_code=503,
                code=ProductSearchErrorCode.SEARCH_UNAVAILABLE,
                message="Text search is temporarily unavailable",
                started_at=started_at,
                metrics=metrics,
                dataset=dataset_response,
            )
        except DatasetUnavailableError:
            return _error_response(
                status_code=503,
                code=ProductSearchErrorCode.DATASET_UNAVAILABLE,
                message="Dataset Snapshot is temporarily unavailable",
                started_at=started_at,
                metrics=metrics,
            )

        dataset = DatasetSnapshotResponse(
            version=result.dataset.version,
            retrieved_at=result.dataset.retrieved_at,
        )
        latency_ms = round((monotonic() - started_at) * 1000, 3)
        _record_outcome(
            outcome="found" if result.products else "empty",
            latency_ms=latency_ms,
            dataset_version=result.dataset.version,
            metrics=metrics,
        )
        return ProductSearchResponse(
            data=ProductSearchDataResponse(products=result.products),
            meta=ProductSearchMetaResponse(
                source=SourceAttributionResponse(
                    name="Open Food Facts",
                    product_url="https://world.openfoodfacts.org",
                ),
                dataset=dataset,
                pagination=SearchPaginationMetaResponse(next_cursor=result.next_cursor),
            ),
        )
    except Exception as error:
        logger.error(
            "Product Search failed unexpectedly",
            extra={
                "event": "product_search_internal_error",
                "error_category": type(error).__name__,
            },
        )
        return _internal_error_response(started_at=started_at, metrics=metrics)


def _client_address(request: Request) -> str:
    return request.client.host if request.client is not None else "unknown"


def _internal_error_response(
    *,
    started_at: float,
    metrics: ProductSearchMetrics,
) -> JSONResponse:
    latency_ms = round((monotonic() - started_at) * 1000, 3)
    try:
        _record_outcome(
            outcome=ProductSearchErrorCode.INTERNAL_ERROR.value,
            latency_ms=latency_ms,
            dataset_version=None,
            metrics=metrics,
        )
    except Exception as error:
        logger.error(
            "Product Search metrics unavailable during internal failure",
            extra={
                "event": "product_search_metrics_failure",
                "dependency": "metrics",
                "error_category": type(error).__name__,
            },
        )
    return _build_error_response(
        status_code=500,
        code=ProductSearchErrorCode.INTERNAL_ERROR,
        message="Product Search failed unexpectedly",
    )


def _error_response(
    *,
    status_code: int,
    code: ProductSearchErrorCode,
    message: str,
    started_at: float,
    metrics: ProductSearchMetrics,
    dataset: DatasetSnapshotResponse | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    latency_ms = round((monotonic() - started_at) * 1000, 3)
    _record_outcome(
        outcome=code.value,
        latency_ms=latency_ms,
        dataset_version=dataset.version if dataset is not None else None,
        metrics=metrics,
    )
    return _build_error_response(
        status_code=status_code,
        code=code,
        message=message,
        dataset=dataset,
        headers=headers,
    )


def _build_error_response(
    *,
    status_code: int,
    code: ProductSearchErrorCode,
    message: str,
    dataset: DatasetSnapshotResponse | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    envelope = ProductSearchErrorResponse(
        error=ProductSearchErrorDetail(code=code, message=message),
        meta=(ProductLookupErrorMetaResponse(dataset=dataset) if dataset is not None else None),
    )
    return JSONResponse(
        status_code=status_code,
        content=envelope.model_dump(mode="json", exclude_none=True),
        headers=headers,
    )


def _record_outcome(
    *,
    outcome: str,
    latency_ms: float,
    dataset_version: str | None,
    metrics: ProductSearchMetrics,
) -> None:
    metrics.observe(
        outcome=outcome,
        latency_ms=latency_ms,
        dataset_version=dataset_version,
    )
    logger.info(
        "Product Search completed",
        extra={
            "event": "product_search_completed",
            "outcome": outcome,
            "latency_ms": latency_ms,
            "dataset_version": dataset_version,
        },
    )
