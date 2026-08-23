from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class PackageMatchCandidate:
    package_variant_id: str
    product_id: str


class PackageMatchRepository(Protocol):
    def find_candidates(self, normalized_identifier: str) -> list[PackageMatchCandidate]: ...
