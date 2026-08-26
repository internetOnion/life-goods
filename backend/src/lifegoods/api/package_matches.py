from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query

from lifegoods.api.contracts import (
    ErrorEnvelope,
    PackageMatchCandidateResponse,
    PackageMatchesResponse,
    PackageMatchEvidenceResponse,
    PackageMatchReferenceImageResponse,
    PackageMatchSourceResponse,
)
from lifegoods.application.package_matches import FindPackageMatches
from lifegoods.matching.repository import PackageMatchCandidate, PackageMatchSourceKind

router = APIRouter(prefix="/api/v1", tags=["Package Matches"])


def get_finder() -> FindPackageMatches:
    raise RuntimeError("Package Match application dependency is not configured")


@router.get(
    "/package-matches",
    operation_id="getPackageMatches",
    response_model=PackageMatchesResponse,
    responses={422: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}},
)
def get_package_matches(
    identifier: Annotated[str, Query(min_length=1)],
    finder: Annotated[FindPackageMatches, Depends(get_finder)],
) -> PackageMatchesResponse:
    result = finder.execute(identifier)
    return PackageMatchesResponse(
        normalized_identifier=result.identifier.value,
        scheme=result.identifier.scheme,
        candidates=[_candidate_response(candidate) for candidate in result.candidates],
    )


def _candidate_response(candidate: PackageMatchCandidate) -> PackageMatchCandidateResponse:
    source = candidate.source
    return PackageMatchCandidateResponse(
        source_kind=candidate.source_kind,
        package_variant_id=candidate.package_variant_id,
        product_id=candidate.product_id,
        external_record_id=candidate.external_record_id,
        source=(
            PackageMatchSourceResponse(
                name=source.name,
                source_type=source.source_type,
                base_url=source.base_url,
                record_url=source.record_url,
                attribution=source.attribution,
                database_license=source.database_license,
                contents_license=source.contents_license,
                image_license=source.image_license,
                terms_version=source.terms_version,
            )
            if source is not None
            else None
        ),
        identity_evidence=[
            PackageMatchEvidenceResponse(
                field=evidence.field,
                value=evidence.value,
                source_field=evidence.source_field,
                source_name=evidence.source_name,
                source_url=evidence.source_url,
                language=evidence.language,
                observed_at=evidence.observed_at,
                retrieved_at=evidence.retrieved_at,
            )
            for evidence in candidate.identity_evidence
        ],
        label_evidence=[
            PackageMatchEvidenceResponse(
                field=evidence.field,
                value=evidence.value,
                source_field=evidence.source_field,
                source_name=evidence.source_name,
                source_url=evidence.source_url,
                language=evidence.language,
                observed_at=evidence.observed_at,
                retrieved_at=evidence.retrieved_at,
            )
            for evidence in candidate.label_evidence
        ],
        reference_images=[
            PackageMatchReferenceImageResponse(
                role=image.role,
                url=(
                    f"/api/v1/open-food-facts-images?{urlencode({'url': image.url})}"
                    if candidate.source_kind is PackageMatchSourceKind.OPEN_FOOD_FACTS
                    else image.url
                ),
                source_field=image.source_field,
                source_name=image.source_name,
                source_url=image.source_url,
                attribution=image.attribution,
                license_name=image.license_name,
                language=image.language,
                retrieved_at=image.retrieved_at,
            )
            for image in candidate.reference_images
        ],
        retrieved_at=candidate.retrieved_at,
        is_current=candidate.is_current,
        source_revision=candidate.source_revision,
    )
