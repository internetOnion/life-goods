from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query

from lifegoods.core.errors import ErrorEnvelope
from lifegoods.package_matches.contracts import (
    ExternalDatasetVersionResponse,
    OpenFoodFactsLookupResponse,
    PackageMatchCandidateResponse,
    PackageMatchesResponse,
    PackageMatchEvidenceResponse,
    PackageMatchReferenceImageResponse,
    PackageMatchSourceResponse,
)
from lifegoods.package_matches.models import (
    PackageMatchCandidate,
    PackageMatchSourceKind,
)
from lifegoods.package_matches.service import FindPackageMatches

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
        open_food_facts=OpenFoodFactsLookupResponse(
            status=result.open_food_facts.status,
            dataset_version=(
                ExternalDatasetVersionResponse(
                    id=result.open_food_facts.dataset_version.id,
                    source_url=result.open_food_facts.dataset_version.source_url,
                    retrieved_at=result.open_food_facts.dataset_version.retrieved_at,
                    activated_at=result.open_food_facts.dataset_version.activated_at,
                    sha256=result.open_food_facts.dataset_version.sha256,
                )
                if result.open_food_facts.dataset_version is not None
                else None
            ),
            error_code=result.open_food_facts.error_code,
        ),
    )


def _candidate_response(
    candidate: PackageMatchCandidate,
) -> PackageMatchCandidateResponse:
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
                source_revision=evidence.source_revision,
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
                source_revision=evidence.source_revision,
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
                source_revision=image.source_revision,
            )
            for image in candidate.reference_images
        ],
        retrieved_at=candidate.retrieved_at,
        is_current=candidate.is_current,
        source_revision=candidate.source_revision,
        dataset_version_id=(
            candidate.dataset_version.id
            if candidate.dataset_version is not None
            else None
        ),
        dataset_retrieved_at=(
            candidate.dataset_version.retrieved_at
            if candidate.dataset_version is not None
            else None
        ),
        dataset_activated_at=(
            candidate.dataset_version.activated_at
            if candidate.dataset_version is not None
            else None
        ),
        dataset_source_url=(
            candidate.dataset_version.source_url
            if candidate.dataset_version is not None
            else None
        ),
        dataset_sha256=(
            candidate.dataset_version.sha256
            if candidate.dataset_version is not None
            else None
        ),
    )
