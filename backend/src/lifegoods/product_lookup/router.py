from __future__ import annotations

import logging
from time import monotonic
from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse

if TYPE_CHECKING:
    from lifegoods.generated_data.coordinator import TranslationCoordinator
from lifegoods.product_lookup.barcode import InvalidBarcodeError
from lifegoods.product_lookup.contracts import (
    DatasetSnapshotResponse,
    ProductLookupDataResponse,
    ProductLookupErrorCode,
    ProductLookupErrorDetail,
    ProductLookupErrorMetaResponse,
    ProductLookupErrorResponse,
    ProductLookupMetadataResponse,
    ProductLookupMetaResponse,
    ProductLookupResponse,
    ProductProjectionData,
    ProductProjectionMetaResponse,
    ProductProjectionResponse,
    SourceAttributionResponse,
    TranslationMetaResponse,
    TranslationOverallStatus,
)
from lifegoods.product_lookup.metrics import ProductLookupMetrics
from lifegoods.product_lookup.models import DatasetUnavailableError
from lifegoods.product_lookup.rate_limit import ProductLookupRateLimiter
from lifegoods.product_lookup.service import LookupProduct

router = APIRouter(tags=["Products"])
logger = logging.getLogger(__name__)


def get_product_lookup() -> LookupProduct:
    raise RuntimeError("Product Lookup application dependency is not configured")


def get_product_lookup_rate_limiter() -> ProductLookupRateLimiter:
    raise RuntimeError("Product Lookup rate limiter dependency is not configured")


def get_product_lookup_metrics() -> ProductLookupMetrics:
    raise RuntimeError("Product Lookup metrics dependency is not configured")


def get_translation_coordinator() -> TranslationCoordinator:
    raise RuntimeError("Translation coordinator application dependency is not configured")


@router.get(
    "/api/v1/products/{barcode}",
    operation_id="getProduct",
    summary="Look up a Product",
    description=(
        "Looks up a Barcode in the selected local Open Food Facts Dataset Snapshot "
        "and returns a stable Product projection."
    ),
    response_model=ProductProjectionResponse,
    responses={
        404: {"model": ProductLookupErrorResponse},
        422: {"model": ProductLookupErrorResponse},
        429: {"model": ProductLookupErrorResponse},
        500: {"model": ProductLookupErrorResponse},
        503: {"model": ProductLookupErrorResponse},
    },
)
def get_product(
    request: Request,
    barcode: Annotated[
        str,
        Path(description="GTIN-8, UPC-A, EAN-13, or GTIN-14 Product Barcode."),
    ],
    lookup: Annotated[LookupProduct, Depends(get_product_lookup)],
    limiter: Annotated[ProductLookupRateLimiter, Depends(get_product_lookup_rate_limiter)],
    metrics: Annotated[ProductLookupMetrics, Depends(get_product_lookup_metrics)],
    language: Annotated[
        str | None,
        Query(
            description=(
                "Optional target language for product translation. "
                "Only 'kh' is supported; 'km' returns unsupported_language. "
                "Omit to skip generation. External source language tags remain unchanged."
            )
        ),
    ] = None,
) -> ProductProjectionResponse | JSONResponse:
    started_at = monotonic()
    try:
        allowed, retry_after = limiter.try_acquire(_client_address(request))
        if not allowed:
            return _error_response(
                status_code=429,
                code=ProductLookupErrorCode.RATE_LIMIT_EXCEEDED,
                message="Too many requests. Please try again later.",
                started_at=started_at,
                metrics=metrics,
                headers={"Retry-After": str(retry_after)},
            )
        if language is not None and language != "kh":
            return _error_response(
                status_code=422,
                code=ProductLookupErrorCode.UNSUPPORTED_LANGUAGE,
                message=f"Language '{language}' is not supported",
                started_at=started_at,
                metrics=metrics,
            )
        try:
            result = lookup.execute(barcode, language=language)
        except InvalidBarcodeError:
            return _error_response(
                status_code=422,
                code=ProductLookupErrorCode.INVALID_BARCODE,
                message="Barcode is invalid",
                started_at=started_at,
                metrics=metrics,
            )
        except DatasetUnavailableError:
            return _error_response(
                status_code=503,
                code=ProductLookupErrorCode.DATASET_UNAVAILABLE,
                message="Dataset Snapshot is temporarily unavailable",
                started_at=started_at,
                metrics=metrics,
            )

        dataset = DatasetSnapshotResponse(
            version=result.dataset.version,
            retrieved_at=result.dataset.retrieved_at,
        )
        if result.source_record is None or result.product is None:
            return _error_response(
                status_code=404,
                code=ProductLookupErrorCode.PRODUCT_NOT_FOUND,
                message="Product not found",
                started_at=started_at,
                metrics=metrics,
                cache_status=result.cache_status,
                dataset=dataset,
            )

        latency_ms = round((monotonic() - started_at) * 1000, 3)
        _record_outcome(
            outcome="found",
            latency_ms=latency_ms,
            cache_status=result.cache_status,
            dataset_version=result.dataset.version,
            metrics=metrics,
        )
        return ProductProjectionResponse(
            data=ProductProjectionData(product=result.product),
            meta=ProductProjectionMetaResponse(
                lookup=ProductLookupMetadataResponse(barcode=result.barcode),
                source=SourceAttributionResponse(
                    name="Open Food Facts",
                    product_url=("https://world.openfoodfacts.org/product/" + result.barcode),
                ),
                dataset=dataset,
                translation=result.translation
                or TranslationMetaResponse(status=TranslationOverallStatus.NOT_REQUESTED),
            ),
        )
    except Exception as error:
        logger.error(
            "Product Lookup failed unexpectedly",
            extra={
                "event": "product_lookup_internal_error",
                "error_category": type(error).__name__,
            },
        )
        return _internal_error_response(started_at=started_at, metrics=metrics)


@router.get(
    "/api/experimental/products/{barcode}",
    operation_id="getExperimentalProduct",
    deprecated=True,
    summary="Look up an experimental raw Product",
    description=(
        "Looks up a Barcode in the selected local Open Food Facts Dataset Snapshot "
        "and returns the raw Source Record. This experimental contract is deprecated."
    ),
    response_model=ProductLookupResponse,
    responses={
        404: {"model": ProductLookupErrorResponse},
        422: {"model": ProductLookupErrorResponse},
        429: {"model": ProductLookupErrorResponse},
        500: {"model": ProductLookupErrorResponse},
        503: {"model": ProductLookupErrorResponse},
    },
)
def get_experimental_product(
    request: Request,
    barcode: Annotated[
        str,
        Path(description="GTIN-8, UPC-A, EAN-13, or GTIN-14 Product Barcode."),
    ],
    lookup: Annotated[LookupProduct, Depends(get_product_lookup)],
    limiter: Annotated[ProductLookupRateLimiter, Depends(get_product_lookup_rate_limiter)],
    metrics: Annotated[ProductLookupMetrics, Depends(get_product_lookup_metrics)],
) -> ProductLookupResponse | JSONResponse:
    started_at = monotonic()
    try:
        allowed, retry_after = limiter.try_acquire(_client_address(request))
        if not allowed:
            return _error_response(
                status_code=429,
                code=ProductLookupErrorCode.RATE_LIMIT_EXCEEDED,
                message="Too many requests. Please try again later.",
                started_at=started_at,
                metrics=metrics,
                headers={"Retry-After": str(retry_after)},
            )
        try:
            result = lookup.execute(barcode)
        except InvalidBarcodeError:
            return _error_response(
                status_code=422,
                code=ProductLookupErrorCode.INVALID_BARCODE,
                message="Barcode is invalid",
                started_at=started_at,
                metrics=metrics,
            )
        except DatasetUnavailableError:
            return _error_response(
                status_code=503,
                code=ProductLookupErrorCode.DATASET_UNAVAILABLE,
                message="Dataset Snapshot is temporarily unavailable",
                started_at=started_at,
                metrics=metrics,
            )

        dataset = DatasetSnapshotResponse(
            version=result.dataset.version,
            retrieved_at=result.dataset.retrieved_at,
        )
        if result.source_record is None:
            return _error_response(
                status_code=404,
                code=ProductLookupErrorCode.PRODUCT_NOT_FOUND,
                message="Product not found",
                started_at=started_at,
                metrics=metrics,
                cache_status=result.cache_status,
                dataset=dataset,
            )

        latency_ms = round((monotonic() - started_at) * 1000, 3)
        _record_outcome(
            outcome="found",
            latency_ms=latency_ms,
            cache_status=result.cache_status,
            dataset_version=result.dataset.version,
            metrics=metrics,
        )
        return ProductLookupResponse(
            data=ProductLookupDataResponse(source_record=result.source_record),
            meta=ProductLookupMetaResponse(
                lookup=ProductLookupMetadataResponse(barcode=result.barcode),
                source=SourceAttributionResponse(
                    name="Open Food Facts",
                    product_url=("https://world.openfoodfacts.org/product/" + result.barcode),
                ),
                dataset=dataset,
            ),
        )
    except Exception as error:
        logger.error(
            "Product Lookup failed unexpectedly",
            extra={
                "event": "product_lookup_internal_error",
                "error_category": type(error).__name__,
            },
        )
        return _internal_error_response(started_at=started_at, metrics=metrics)


def _client_address(request: Request) -> str:
    return request.client.host if request.client is not None else "unknown"


def _internal_error_response(
    *,
    started_at: float,
    metrics: ProductLookupMetrics,
) -> JSONResponse:
    latency_ms = round((monotonic() - started_at) * 1000, 3)
    try:
        _record_outcome(
            outcome=ProductLookupErrorCode.INTERNAL_ERROR.value,
            latency_ms=latency_ms,
            cache_status=None,
            dataset_version=None,
            metrics=metrics,
        )
    except Exception as error:
        logger.error(
            "Product Lookup metrics unavailable during internal failure",
            extra={
                "event": "product_lookup_metrics_failure",
                "dependency": "metrics",
                "error_category": type(error).__name__,
            },
        )
    return _build_error_response(
        status_code=500,
        code=ProductLookupErrorCode.INTERNAL_ERROR,
        message="Product Lookup failed unexpectedly",
    )


def _error_response(
    *,
    status_code: int,
    code: ProductLookupErrorCode,
    message: str,
    started_at: float,
    metrics: ProductLookupMetrics,
    cache_status: str | None = None,
    dataset: DatasetSnapshotResponse | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    latency_ms = round((monotonic() - started_at) * 1000, 3)
    _record_outcome(
        outcome=code.value,
        latency_ms=latency_ms,
        cache_status=cache_status,
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
    code: ProductLookupErrorCode,
    message: str,
    dataset: DatasetSnapshotResponse | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    envelope = ProductLookupErrorResponse(
        error=ProductLookupErrorDetail(code=code, message=message),
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
    cache_status: str | None,
    dataset_version: str | None,
    metrics: ProductLookupMetrics,
) -> None:
    metrics.observe(
        outcome=outcome,
        latency_ms=latency_ms,
        cache_status=cache_status,
        dataset_version=dataset_version,
    )
    logger.info(
        "Product Lookup completed",
        extra={
            "event": "product_lookup_completed",
            "outcome": outcome,
            "latency_ms": latency_ms,
            "cache_status": cache_status,
            "dataset_version": dataset_version,
        },
    )
