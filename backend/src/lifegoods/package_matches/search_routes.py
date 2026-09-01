import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from time import monotonic
from typing import Annotated, Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from lifegoods.core.errors import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.open_food_facts.models import SourcedValue
from lifegoods.package_matches.contracts import (
    ExternalDatasetVersionResponse,
    PackageMatchEvidenceResponse,
    PackageSearchAdditiveResponse,
    PackageSearchNameResponse,
    PackageSearchResponse,
    PackageSearchResultResponse,
)
from lifegoods.package_matches.dependencies import (
    client_identifier,
    get_search_rate_limiter,
    get_searcher,
)
from lifegoods.package_matches.models import (
    PackageMatchSourceUnavailableError,
    json_value,
)
from lifegoods.package_matches.rate_limit import PackageMatchRateLimiter
from lifegoods.package_matches.search import (
    PackageSearch,
    SearchHit,
    SearchValidationError,
    normalize_search_text,
)

router = APIRouter()
logger = logging.getLogger("lifegoods.package_matches.router")


@router.get(
    "/package-matches/search",
    operation_id="searchPackageMatches",
    summary="Search Package Match candidates",
    description=(
        "Searches the active local Open Food Facts Dataset Version by product name, "
        "brand, or explicit manufacturing country. Results are external Evidence and "
        "do not prove product origin or identity."
    ),
    response_model=PackageSearchResponse,
    responses={
        404: {
            "model": ErrorEnvelope,
            "description": "No Package Match candidates matched the search query.",
        },
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
)
def search_package_matches(
    request: Request,
    query: Annotated[
        str,
        Query(
            alias="q",
            min_length=2,
            max_length=100,
            description="Product name, brand, or manufacturing country to search for.",
        ),
    ],
    page: Annotated[int, Query(ge=1, le=100, description="Result page number.")] = 1,
    page_size: Annotated[int, Query(ge=1, le=50, description="Results per page.")] = 20,
    searcher: Annotated[PackageSearch, Depends(get_searcher)] = None,  # type: ignore[assignment]
    limiter: Annotated[PackageMatchRateLimiter, Depends(get_search_rate_limiter)] = None,  # type: ignore[assignment]
) -> PackageSearchResponse | JSONResponse:
    started_at = monotonic()
    normalized_query = normalize_search_text(query)
    if len(normalized_query) < 2:
        raise SearchValidationError("Search value must contain at least 2 characters")
    assert searcher is not None
    assert limiter is not None
    allowed, retry_after = limiter.try_acquire(client_identifier(request))
    if not allowed:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.RATE_LIMIT_EXCEEDED,
                message="Too many search requests. Please try again later.",
            )
        )
        return JSONResponse(
            status_code=429,
            content=envelope.model_dump(),
            headers={"Retry-After": str(retry_after)},
        )
    try:
        result = searcher.search(normalized_query, page=page, page_size=page_size)
    except PackageMatchSourceUnavailableError:
        raise
    logger.info(
        "Package Match search completed",
        extra={
            "event": "package_match_search_completed",
            "latency_ms": round((monotonic() - started_at) * 1000, 3),
            "candidate_count": len(result.results),
            "page": page,
            "matched_fields": ",".join(
                sorted({field for hit in result.results for field in hit.matched_fields})
            ),
            "dataset_version_id": result.dataset_version.id if result.dataset_version else None,
        },
    )
    if not result.results:
        envelope = ErrorEnvelope(
            error=ErrorDetail(
                code=ErrorCode.SEARCH_RESULTS_NOT_FOUND,
                message="No Package Match candidates were found for this search query.",
            )
        )
        return JSONResponse(status_code=404, content=envelope.model_dump())
    version = result.dataset_version
    return PackageSearchResponse(
        query=normalized_query,
        page=page,
        page_size=page_size,
        has_more=result.has_more,
        source="Open Food Facts",
        dataset_version=(
            ExternalDatasetVersionResponse(
                id=version.id,
                source_url=version.source_url,
                retrieved_at=version.retrieved_at,
                activated_at=version.activated_at,
                sha256=version.sha256,
            )
            if version is not None
            else None
        ),
        results=[_search_result_response(hit) for hit in result.results],
    )


def _search_result_response(hit: SearchHit) -> PackageSearchResultResponse:
    record = hit.record
    names = list(record.names)
    main_name = _preferred_value(names)
    other_names = [
        PackageSearchNameResponse(
            value=name.value,
            language=name.language,
            source_field=name.source_field,
        )
        for name in names
        if main_name is None or name.value != main_name.value
    ]
    ingredients = _preferred_value(list(record.ingredient_texts))
    return PackageSearchResultResponse(
        barcode=record.identifier,
        name=main_name.value if main_name is not None else record.identifier,
        other_names=other_names,
        brand=list(record.brands.value) if record.brands is not None else None,
        made_in=list(hit.made_in) if hit.made_in else None,
        quantity=record.quantity.value if record.quantity is not None else None,
        image_url=(
            f"/api/v1/open-food-facts-images?{urlencode({'url': record.selected_images[0].url})}"
            if record.selected_images
            else None
        ),
        ingredients=ingredients.value if ingredients is not None else None,
        allergens=_display_allergens(record),
        additives=_display_additives(record),
        matched_fields=list(hit.matched_fields),
        source_record_id=record.source_record_id,
        source_url=record.source_url,
        source_updated_at=_source_revision_datetime(record.source_revision),
        source_revision=record.source_revision,
        dataset_version_id=record.dataset_version.id,
        evidence=_search_evidence(record, made_in=hit.made_in),
    )


def _preferred_value[T](values: Sequence[SourcedValue[T]]) -> SourcedValue[T] | None:
    if not values:
        return None
    khmer = next(
        (value for value in values if getattr(value, "language", None) == "km"),
        None,
    )
    if khmer is not None:
        return khmer
    primary = values[0]
    if getattr(primary, "language", None) != "en":
        return primary
    english = next(
        (value for value in values if getattr(value, "language", None) == "en"),
        None,
    )
    return english or primary


def _display_tags(values: tuple[str, ...]) -> list[str]:
    return [value.split(":", 1)[1].replace("-", " ") if ":" in value else value for value in values]


def _display_allergens(record: object) -> list[str] | None:
    from lifegoods.open_food_facts.models import ExternalPackageRecord

    if not isinstance(record, ExternalPackageRecord):
        return None
    if record.allergen_tags is not None:
        return _display_tags(record.allergen_tags.value)
    if record.allergen_declaration is not None:
        return [record.allergen_declaration.value]
    return None


def _display_additives(
    record: object,
) -> list[PackageSearchAdditiveResponse] | None:
    from lifegoods.open_food_facts.models import ExternalPackageRecord

    if not isinstance(record, ExternalPackageRecord) or record.additives is None:
        return None
    return [
        PackageSearchAdditiveResponse(code=value, name=value)
        for value in _display_tags(record.additives.value)
    ]


def _source_revision_datetime(value: str | None) -> datetime | None:
    if value is None or not value.isdigit():
        return None
    return datetime.fromtimestamp(int(value), tz=UTC)


def _search_evidence(
    record: object, *, made_in: tuple[str, ...] = ()
) -> list[PackageMatchEvidenceResponse]:
    from lifegoods.open_food_facts.models import ExternalPackageRecord

    if not isinstance(record, ExternalPackageRecord):
        return []
    values: list[tuple[str, SourcedValue[Any]]] = [
        (
            "identifier",
            SourcedValue(value=record.identifier, source_field="code"),
        )
    ]
    _append_sequence_or_unknown(values, "name", "product_name", record.names)
    _append_optional_or_unknown(values, "brands", "brands", record.brands)
    _append_optional_or_unknown(values, "quantity", "quantity", record.quantity)
    _append_sequence_or_unknown(
        values, "ingredient_text", "ingredients_text", record.ingredient_texts
    )
    for field, source_field, value in (
        ("allergen_declaration", "allergens", record.allergen_declaration),
        ("allergen_tags", "allergens_tags", record.allergen_tags),
        ("trace_declaration", "traces", record.trace_declaration),
        ("trace_tags", "traces_tags", record.trace_tags),
        ("additive_tags", "additives_tags", record.additives),
        ("halal_label_claim", "labels_tags", record.halal_label_claim),
        ("packaging_languages", "languages_tags", record.packaging_languages),
        ("countries_sold", "countries_tags", record.countries_sold),
    ):
        _append_optional_or_unknown(values, field, source_field, value)
    if record.manufacturing_places is not None:
        values.append(("manufacturing_places", record.manufacturing_places))
    elif made_in:
        values.append(
            (
                "manufacturing_places",
                SourcedValue(value=made_in, source_field="manufacturing_places_tags"),
            )
        )
    else:
        values.append(
            (
                "manufacturing_places",
                SourcedValue(value=None, source_field="manufacturing_places"),
            )
        )
    _append_sequence_or_unknown(
        values,
        "storage_instructions",
        "conservation_conditions",
        record.storage_conditions,
    )
    nutrition_by_source = {value.source_field: value for value in record.nutrition}
    for source_field in (
        "nutriments",
        "nutrition_data_per",
        "nutrition_data_prepared_per",
        "serving_size",
    ):
        value = nutrition_by_source.get(source_field)
        _append_optional_or_unknown(values, "nutrition", source_field, value)
    return [
        PackageMatchEvidenceResponse(
            field=field,
            value=json_value(value.value),
            source_field=value.source_field,
            source_name=record.source.name,
            source_url=record.source_url,
            language=value.language,
            observed_at=None,
            retrieved_at=record.retrieved_at,
            source_revision=record.source_revision,
            dataset_version_id=record.dataset_version.id,
        )
        for field, value in values
    ]


def _append_optional_or_unknown(
    values: list[tuple[str, SourcedValue[Any]]],
    field: str,
    source_field: str,
    value: SourcedValue[Any] | None,
) -> None:
    values.append(
        (field, value)
        if value is not None
        else (field, SourcedValue(value=None, source_field=source_field))
    )


def _append_sequence_or_unknown(
    values: list[tuple[str, SourcedValue[Any]]],
    field: str,
    source_field: str,
    sourced_values: Sequence[SourcedValue[Any]],
) -> None:
    if sourced_values:
        values.extend((field, value) for value in sourced_values)
    else:
        values.append((field, SourcedValue(value=None, source_field=source_field)))
