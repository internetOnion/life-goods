from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from lifegoods.identifiers.models import NormalizedIdentifier
from lifegoods.open_food_facts.models import ExternalDatasetVersion, JsonValue
from lifegoods.package_matches.assessments import AllergenAssessmentEvaluation


def json_value(value: object) -> JsonValue:
    if value is None or isinstance(value, bool | int | float | str):
        return value
    if isinstance(value, tuple | list):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): json_value(item) for key, item in value.items()}
    raise TypeError(f"Unsupported external evidence value: {type(value).__name__}")


class PackageMatchSourceKind(StrEnum):
    REVIEWED_CATALOG = "REVIEWED_CATALOG"
    OPEN_FOOD_FACTS = "OPEN_FOOD_FACTS"


class OpenFoodFactsLookupStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    NOT_FOUND = "NOT_FOUND"
    UNAVAILABLE = "UNAVAILABLE"


class PackageMatchSourceUnavailableError(Exception):
    pass


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
    source_revision: str | None = None
    dataset_version_id: str | None = None


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
    retrieved_at: datetime
    source_revision: str | None = None
    original_url: str | None = None
    image_revision: str | None = None
    dataset_version_id: str | None = None


@dataclass(frozen=True, slots=True)
class PackageMatchCandidate:
    source_kind: PackageMatchSourceKind = PackageMatchSourceKind.OPEN_FOOD_FACTS
    package_variant_id: str | None = None
    product_id: str | None = None
    external_record_id: str | None = None
    source: PackageMatchSourceMetadata | None = None
    identity_evidence: tuple[PackageMatchEvidence, ...] = ()
    label_evidence: tuple[PackageMatchEvidence, ...] = ()
    reference_images: tuple[PackageMatchReferenceImage, ...] = ()
    allergen_assessment: AllergenAssessmentEvaluation = (
        AllergenAssessmentEvaluation()
    )
    retrieved_at: datetime | None = None
    is_current: bool | None = None
    source_revision: str | None = None
    dataset_version: ExternalDatasetVersion | None = None


@dataclass(frozen=True, slots=True)
class OpenFoodFactsLookup:
    status: OpenFoodFactsLookupStatus
    dataset_version: ExternalDatasetVersion | None
    error_code: str | None = None


@dataclass(frozen=True, slots=True)
class PackageMatchResult:
    identifier: NormalizedIdentifier
    candidates: list[PackageMatchCandidate]
    open_food_facts: OpenFoodFactsLookup
