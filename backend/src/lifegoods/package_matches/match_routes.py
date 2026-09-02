import logging
from time import monotonic
from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

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
from lifegoods.package_matches.dependencies import (
    client_identifier,
    get_finder,
    get_rate_limiter,
)
from lifegoods.package_matches.models import (
    PackageMatchCandidate,
    PackageMatchSourceKind,
    PackageMatchSourceUnavailableError,
)
from lifegoods.package_matches.rate_limit import PackageMatchRateLimiter
from lifegoods.package_matches.router import _halal_ingredient_assessment_response
from lifegoods.package_matches.service import FindPackageMatches
from lifegoods.reference_datasets import AllergenRelationshipType

router = APIRouter()
logger = logging.getLogger("lifegoods.package_matches.router")


@router.get(
    "/package-matches",
    operation_id="getPackageMatches",
    summary="Find Package Match candidates",
    description=(
        "Looks up candidate Package Matches using the active Open Food Facts Dataset "
        "Version. Open Food Facts fields are external Evidence, and a returned match "
        "does not prove identity with the physical package in a shopper's possession."
    ),
    response_model=PackageMatchesResponse,
    responses={
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
)
def get_package_matches(
    request: Request,
    identifier: Annotated[
        str,
        Query(
            min_length=1,
            description="GTIN, EAN, or UPC identifier used to find Package Match candidates.",
        ),
    ],
    finder: Annotated[FindPackageMatches, Depends(get_finder)],
    limiter: Annotated[PackageMatchRateLimiter, Depends(get_rate_limiter)],
) -> PackageMatchesResponse | JSONResponse:
    started_at = monotonic()
    allowed, retry_after = limiter.try_acquire(client_identifier(request))
    if not allowed:
        logger.info(
            "Package Match request rejected by rate limit",
            extra={
                "event": "package_match_rate_limit_rejected",
                "latency_ms": round((monotonic() - started_at) * 1000, 3),
            },
        )
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
    try:
        result = finder.execute(identifier)
    except PackageMatchSourceUnavailableError:
        logger.warning(
            "Package Match lookup dependency unavailable",
            extra={
                "event": "package_match_dependency_failure",
                "latency_ms": round((monotonic() - started_at) * 1000, 3),
                "dependency": "mongodb",
                "operation": "find_package_matches",
                "failure_category": "source_unavailable",
                "off_outcome": "UNAVAILABLE",
                "off_dataset_version_id": None,
            },
        )
        raise
    assessment_statuses = sorted(
        {str(candidate.allergen_assessment.status) for candidate in result.candidates}
    )
    assessment_reasons = sorted(
        {
            str(candidate.allergen_assessment.reason)
            for candidate in result.candidates
            if candidate.allergen_assessment.reason is not None
        }
    )
    logger.info(
        "Package Match lookup completed",
        extra={
            "event": "package_match_lookup_completed",
            "latency_ms": round((monotonic() - started_at) * 1000, 3),
            "candidate_count": len(result.candidates),
            "off_outcome": str(result.open_food_facts.status),
            "off_dataset_version_id": (
                result.open_food_facts.dataset_version.id
                if result.open_food_facts.dataset_version is not None
                else None
            ),
            "assessment_status": ",".join(assessment_statuses) or "NO_CANDIDATE",
            "assessment_reason": ",".join(assessment_reasons) or None,
        },
    )
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
        status=assessment.status,
        reason=assessment.reason,
        evidence_coverage=assessment.evidence_coverage,
        engine_version=assessment.engine_version,
        reference_dataset_version=ref_version,
        concepts=[
            AllergenConceptOutcomeResponse(
                concept_id=concept.concept_id,
                name=concept.name,
                outcome=concept.outcome,
                reason=str(concept.reason) if concept.reason is not None else None,
                finding_ids=list(concept.finding_ids),
                parent_ids=list(concept.parent_ids),
                rule_ids=list(concept.rule_ids),
            )
            for concept in assessment.concepts
        ],
        findings=[
            AllergenFindingResponse(
                id=finding.id,
                concept_id=finding.concept_id,
                mapping_id=finding.mapping_id,
                rule_id=finding.rule_id,
                relationship_type=AllergenRelationshipType(finding.relationship_type),
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
        allergen_assessment=_allergen_assessment_response(candidate.allergen_assessment),
        halal_ingredient_assessment=_halal_ingredient_assessment_response(
            candidate.halal_ingredient_assessment
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
