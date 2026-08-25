from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol

from lifegoods.matching.external_source import JsonValue
from lifegoods.matching.identifier import NormalizedIdentifier


class PackageMatchSourceKind(StrEnum):
    REVIEWED_CATALOG = "REVIEWED_CATALOG"
    OPEN_FOOD_FACTS = "OPEN_FOOD_FACTS"


@dataclass(frozen=True, slots=True)
class PackageMatchSourceMetadata:
    name: str
    source_type: str
    base_url: str
    record_url: str
    attribution: str
    database_license: str
    contents_license: str
    image_license: str
    terms_version: str | None


@dataclass(frozen=True, slots=True)
class PackageMatchEvidence:
    field: str
    value: JsonValue
    source_field: str
    source_name: str
    source_url: str
    language: str | None
    observed_at: datetime | None
    retrieved_at: datetime


@dataclass(frozen=True, slots=True)
class PackageMatchReferenceImage:
    role: str
    url: str
    source_field: str
    source_name: str
    source_url: str
    attribution: str
    license_name: str
    language: str | None


@dataclass(frozen=True, slots=True)
class PackageMatchCandidate:
    source_kind: PackageMatchSourceKind = PackageMatchSourceKind.REVIEWED_CATALOG
    package_variant_id: str | None = None
    product_id: str | None = None
    external_record_id: str | None = None
    source: PackageMatchSourceMetadata | None = None
    identity_evidence: tuple[PackageMatchEvidence, ...] = ()
    label_evidence: tuple[PackageMatchEvidence, ...] = ()
    reference_images: tuple[PackageMatchReferenceImage, ...] = ()
    retrieved_at: datetime | None = None
    is_current: bool | None = None
    source_revision: str | None = None


class PackageMatchRepository(Protocol):
    def find_candidates(self, identifier: NormalizedIdentifier) -> list[PackageMatchCandidate]: ...
