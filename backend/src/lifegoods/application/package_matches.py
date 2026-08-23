from dataclasses import dataclass

from lifegoods.matching.identifier import ExternalIdentifier, normalize_identifier
from lifegoods.matching.repository import PackageMatchCandidate, PackageMatchRepository


@dataclass(frozen=True, slots=True)
class PackageMatchResult:
    identifier: ExternalIdentifier
    candidates: list[PackageMatchCandidate]


class FindPackageMatches:
    def __init__(self, repository: PackageMatchRepository) -> None:
        self._repository = repository

    def execute(self, entered_identifier: str) -> PackageMatchResult:
        identifier = normalize_identifier(entered_identifier)
        candidates = self._repository.find_candidates(identifier.value)
        return PackageMatchResult(identifier=identifier, candidates=candidates)
