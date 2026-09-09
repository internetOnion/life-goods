from typing import Annotated, Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from lifegoods.core.concurrency import KeyedSlidingWindowLimiter
from lifegoods.core.errors import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.open_food_facts.models import (
    ExternalDatasetVersion,
    ExternalPackageRecord,
    ExternalPackageSearchUnavailableError,
    SourcedValue,
)
from lifegoods.package_matches.contracts import (
    ExternalDatasetVersionResponse,
    PackageMatchReferenceImageResponse,
)
from lifegoods.package_search.contracts import (
    PackageSearchEvidenceResponse,
    PackageSearchResponse,
    PackageSearchResultResponse,
)
from lifegoods.package_search.service import SearchPackages

router = APIRouter(prefix="/api/v1", tags=["Package Search"])


def get_searcher() -> SearchPackages:
    raise RuntimeError("Package search application dependency is not configured")


def get_rate_limiter() -> KeyedSlidingWindowLimiter:
    raise RuntimeError("Package search rate limiter dependency is not configured")


def _client_identifier(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


@router.get(
    "/package-search",
    operation_id="searchPackages",
    summary="Search Products",
    description=(
        "Searches the active local Open Food Facts Dataset Snapshot by Product name, "
        "brand, or country. Results remain attributed Source data and do not prove "
        "Product identity or origin."
    ),
    response_model=PackageSearchResponse,
    responses={
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
)
def search_packages(
    request: Request,
    query: Annotated[str, Query(min_length=2, max_length=80)],
    searcher: Annotated[SearchPackages, Depends(get_searcher)],
    limiter: Annotated[KeyedSlidingWindowLimiter, Depends(get_rate_limiter)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=24)] = 12,
) -> PackageSearchResponse | JSONResponse:
    allowed, retry_after = limiter.try_acquire(_client_identifier(request))
    if not allowed:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.RATE_LIMIT_EXCEEDED,
                message="Too many requests. Please try again later.",
            )
        )
        return JSONResponse(
            status_code=429,
            content=envelope.model_dump(),
            headers={"Retry-After": str(retry_after)},
        )

    normalized_query = " ".join(query.split())
    if len(normalized_query) < 2:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.PACKAGE_SEARCH_QUERY_INVALID,
                message="Enter at least two non-space characters to search.",
            )
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())

    try:
        page = searcher.execute(
            normalized_query,
            offset=offset,
            limit=limit,
        )
    except ExternalPackageSearchUnavailableError:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.PACKAGE_MATCH_SOURCE_UNAVAILABLE,
                message="Package search is temporarily unavailable.",
            )
        )
        return JSONResponse(status_code=503, content=envelope.model_dump())

    return PackageSearchResponse(
        normalized_query=page.normalized_query,
        dataset_version=_dataset_version_response(page.dataset_version),
        results=[_result_response(record) for record in page.records],
        next_offset=page.next_offset,
    )


def _result_response(record: ExternalPackageRecord) -> PackageSearchResultResponse:
    front_image = next(
        (image for image in record.selected_images if image.role == "front"),
        record.selected_images[0] if record.selected_images else None,
    )
    reference_image = (
        PackageMatchReferenceImageResponse(
            role=front_image.role,
            url=f"/api/v1/open-food-facts-images?{urlencode({'url': front_image.url})}",
            original_url=front_image.url,
            source_field=front_image.source_field,
            source_name=record.source.name,
            source_url=record.source_url,
            attribution=record.source.attribution,
            license_name=record.source.image_license,
            language=front_image.language,
            retrieved_at=record.retrieved_at,
            source_revision=record.source_revision,
            image_revision=front_image.image_revision,
            dataset_version_id=record.dataset_version.id,
        )
        if front_image is not None
        else None
    )
    return PackageSearchResultResponse(
        identifier=record.identifier,
        names=[_evidence_response(record, name) for name in record.names],
        brands=(
            _evidence_response(record, record.brands)
            if record.brands is not None
            else None
        ),
        quantity=(
            _evidence_response(record, record.quantity)
            if record.quantity is not None
            else None
        ),
        manufacturing_place=(
            _evidence_response(record, record.manufacturing_places)
            if record.manufacturing_places is not None
            else None
        ),
        reference_image=reference_image,
    )


def _evidence_response(
    record: ExternalPackageRecord,
    value: SourcedValue[Any],
) -> PackageSearchEvidenceResponse:
    return PackageSearchEvidenceResponse(
        value=value.value,
        source_field=value.source_field,
        language=value.language,
        source_name=record.source.name,
        source_url=record.source_url,
        retrieved_at=record.retrieved_at,
        source_revision=record.source_revision,
        dataset_version_id=record.dataset_version.id,
    )


def _dataset_version_response(
    version: ExternalDatasetVersion,
) -> ExternalDatasetVersionResponse:
    return ExternalDatasetVersionResponse(
        id=version.id,
        source_url=version.source_url,
        retrieved_at=version.retrieved_at,
        activated_at=version.activated_at,
        sha256=version.sha256,
    )
