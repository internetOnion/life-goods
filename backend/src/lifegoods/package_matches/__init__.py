"""Package match feature: use cases, contracts, PostgreSQL repository, and API router."""

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
    OpenFoodFactsLookup,
    OpenFoodFactsLookupStatus,
    PackageMatchCandidate,
    PackageMatchEvidence,
    PackageMatchReferenceImage,
    PackageMatchRepository,
    PackageMatchResult,
    PackageMatchSourceKind,
    PackageMatchSourceMetadata,
    PackageMatchSourceUnavailableError,
)
from lifegoods.package_matches.repository import SqlAlchemyPackageMatchRepository
from lifegoods.package_matches.router import get_finder, router
from lifegoods.package_matches.service import FindPackageMatches

__all__ = [
    "ExternalDatasetVersionResponse",
    "FindPackageMatches",
    "OpenFoodFactsLookup",
    "OpenFoodFactsLookupResponse",
    "OpenFoodFactsLookupStatus",
    "PackageMatchCandidate",
    "PackageMatchCandidateResponse",
    "PackageMatchEvidence",
    "PackageMatchEvidenceResponse",
    "PackageMatchReferenceImage",
    "PackageMatchReferenceImageResponse",
    "PackageMatchRepository",
    "PackageMatchResult",
    "PackageMatchSourceKind",
    "PackageMatchSourceMetadata",
    "PackageMatchSourceResponse",
    "PackageMatchSourceUnavailableError",
    "PackageMatchesResponse",
    "SqlAlchemyPackageMatchRepository",
    "get_finder",
    "router",
]
