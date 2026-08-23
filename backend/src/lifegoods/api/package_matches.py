from typing import Annotated

from fastapi import APIRouter, Depends, Query

from lifegoods.api.contracts import (
    ErrorEnvelope,
    PackageMatchCandidateResponse,
    PackageMatchesResponse,
)
from lifegoods.application.package_matches import FindPackageMatches
from lifegoods.matching.repository import PackageMatchRepository

router = APIRouter(prefix="/api/v1", tags=["Package Matches"])


def get_repository() -> PackageMatchRepository:
    raise RuntimeError("Package Match repository dependency is not configured")


@router.get(
    "/package-matches",
    operation_id="getPackageMatches",
    response_model=PackageMatchesResponse,
    responses={422: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}},
)
def get_package_matches(
    identifier: Annotated[str, Query(min_length=1)],
    repository: Annotated[PackageMatchRepository, Depends(get_repository)],
) -> PackageMatchesResponse:
    result = FindPackageMatches(repository).execute(identifier)
    return PackageMatchesResponse(
        normalized_identifier=result.identifier.value,
        scheme=result.identifier.scheme,
        candidates=[
            PackageMatchCandidateResponse(
                package_variant_id=candidate.package_variant_id,
                product_id=candidate.product_id,
            )
            for candidate in result.candidates
        ],
    )
