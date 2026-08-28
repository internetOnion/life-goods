from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from lifegoods.core.concurrency import KeyedSlidingWindowLimiter
from lifegoods.core.errors import ErrorCode, ErrorDetail, ErrorEnvelope
from lifegoods.package_matches.assessments import AllergenAssessmentEvaluation
from lifegoods.package_matches.contracts import (
    AllergenAssessmentResponse,
    AllergenConceptOutcomeResponse,
    AllergenFindingResponse,
    AssessmentReferenceDatasetVersionResponse,
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


def get_rate_limiter() -> KeyedSlidingWindowLimiter:
    raise RuntimeError("Package Match rate limiter dependency is not configured")


def _client_identifier(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


@router.get(
    "/package-matches",
    operation_id="getPackageMatches",
    response_model=PackageMatchesResponse,
    responses={
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
)
def get_package_matches(
    request: Request,
    identifier: Annotated[str, Query(min_length=1)],
    finder: Annotated[FindPackageMatches, Depends(get_finder)],
    limiter: Annotated[KeyedSlidingWindowLimiter, Depends(get_rate_limiter)],
) -> PackageMatchesResponse | JSONResponse:
    client_ip = _client_identifier(request)
    allowed, retry_after = limiter.try_acquire(client_ip)
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


def _allergen_assessment_response(
    assessment: AllergenAssessmentEvaluation,
) -> AllergenAssessmentResponse:
    ref_version = (
        AssessmentReferenceDatasetVersionResponse(
            id=assessment.reference_dataset_version.id,
            source_url=assessment.reference_dataset_version.source_url,
            retrieved_at=assessment.reference_dataset_version.retrieved_at,
            activated_at=assessment.reference_dataset_version.activated_at,
            sha256=assessment.reference_dataset_version.sha256,
            review_kind=assessment.reference_dataset_version.review_kind,
            dataset_kind=assessment.reference_dataset_version.dataset_kind,
        )
        if assessment.reference_dataset_version is not None
        else None
    )
    return AllergenAssessmentResponse(
        status=str(assessment.status),
        reason=str(assessment.reason) if assessment.reason is not None else None,
        evidence_coverage=str(assessment.evidence_coverage),
        engine_version=assessment.engine_version,
        reference_dataset_version=ref_version,
        concepts=[
            AllergenConceptOutcomeResponse(
                concept_id=concept.concept_id,
                name=concept.name,
                outcome=str(concept.outcome),
                reason=str(concept.reason) if concept.reason is not None else None,
                finding_ids=list(concept.finding_ids),
            )
            for concept in assessment.concepts
        ],
        findings=[
            AllergenFindingResponse(
                id=finding.id,
                concept_id=finding.concept_id,
                mapping_id=finding.mapping_id,
                rule_id=finding.rule_id,
                relationship_type=str(finding.relationship_type),
                matched_text=finding.matched_text,
                source_text=finding.source_text,
                start_index=finding.start_index,
                end_index=finding.end_index,
                language=finding.language,
                source_field=finding.source_field,
                source_url=finding.source_url,
                source_revision=finding.source_revision,
                off_dataset_version_id=finding.off_dataset_version_id,
                reference_dataset_version_id=finding.reference_dataset_version_id,
                engine_version=finding.engine_version,
            )
            for finding in assessment.findings
        ],
        source_signals=[
            PackageMatchEvidenceResponse(
                field=signal.field,
                value=signal.value,
                source_field=signal.source_field,
                source_name=signal.source_name,
                source_url=signal.source_url,
                language=signal.language,
                observed_at=signal.observed_at,
                retrieved_at=signal.retrieved_at,
                source_revision=signal.source_revision,
                dataset_version_id=signal.dataset_version_id,
            )
            for signal in assessment.source_signals
        ],
    )


def _candidate_response(
    candidate: PackageMatchCandidate,
) -> PackageMatchCandidateResponse:
    if (
        candidate.source_kind is PackageMatchSourceKind.OPEN_FOOD_FACTS
        and candidate.dataset_version is None
    ):
        raise RuntimeError("OFF candidates require dataset version metadata")
    source = candidate.source
    dataset_version = (
        ExternalDatasetVersionResponse(
            id=candidate.dataset_version.id,
            source_url=candidate.dataset_version.source_url,
            retrieved_at=candidate.dataset_version.retrieved_at,
            activated_at=candidate.dataset_version.activated_at,
            sha256=candidate.dataset_version.sha256,
        )
        if candidate.dataset_version is not None
        else None
    )
    return PackageMatchCandidateResponse(
        source_kind=candidate.source_kind,
        allergen_assessment=_allergen_assessment_response(
            candidate.allergen_assessment
        ),
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
                dataset_version_id=evidence.dataset_version_id,
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
                dataset_version_id=evidence.dataset_version_id,
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
                original_url=image.original_url or image.url,
                source_field=image.source_field,
                source_name=image.source_name,
                source_url=image.source_url,
                attribution=image.attribution,
                license_name=image.license_name,
                language=image.language,
                retrieved_at=image.retrieved_at,
                source_revision=image.source_revision,
                image_revision=image.image_revision,
                dataset_version_id=image.dataset_version_id,
            )
            for image in candidate.reference_images
        ],
        retrieved_at=candidate.retrieved_at,
        source_revision=candidate.source_revision,
        dataset_version=dataset_version,
    )
