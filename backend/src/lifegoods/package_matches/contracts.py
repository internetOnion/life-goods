from datetime import datetime

from pydantic import BaseModel, Field

from lifegoods.identifiers.models import IdentifierScheme
from lifegoods.open_food_facts.models import JsonValue
from lifegoods.package_matches.assessments import (
    AllergenAssessmentOutcome,
    AllergenAssessmentReason,
    AllergenAssessmentStatus,
    EvidenceCoverageState,
)
from lifegoods.package_matches.models import (
    OpenFoodFactsLookupStatus,
    PackageMatchSourceKind,
)
from lifegoods.reference_datasets import AllergenRelationshipType


class PackageMatchSourceResponse(BaseModel):
    name: str
    source_type: str
    base_url: str
    record_url: str
    attribution: str
    database_license: str
    contents_license: str
    image_license: str
    terms_version: str | None


class PackageMatchEvidenceResponse(BaseModel):
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


class PackageMatchReferenceImageResponse(BaseModel):
    role: str
    url: str
    original_url: str
    source_field: str
    source_name: str
    source_url: str
    attribution: str
    license_name: str
    language: str | None
    retrieved_at: datetime
    source_revision: str | None = None
    image_revision: str | None = None
    dataset_version_id: str | None = None


class ExternalDatasetVersionResponse(BaseModel):
    id: str
    source_url: str
    retrieved_at: datetime
    activated_at: datetime
    sha256: str


class AssessmentReferenceDatasetVersionResponse(BaseModel):
    id: str
    source_url: str
    retrieved_at: datetime
    activated_at: datetime
    sha256: str
    review_kind: str
    dataset_kind: str = "FOOD_ALLERGEN"


class AllergenFindingResponse(BaseModel):
    id: str
    concept_id: str
    mapping_id: str | None = None
    rule_id: str | None = None
    relationship_type: AllergenRelationshipType
    matched_text: str
    source_text: str | None = None
    start_index: int
    end_index: int
    language: str | None = None
    source_field: str
    source_url: str
    source_revision: str | None = None
    off_dataset_version_id: str | None = None
    reference_dataset_version_id: str | None = None
    engine_version: str | None = None


class AllergenConceptOutcomeResponse(BaseModel):
    concept_id: str
    name: str
    outcome: AllergenAssessmentOutcome
    reason: str | None = None
    finding_ids: list[str] = Field(default_factory=list)
    parent_ids: list[str] = Field(default_factory=list)
    rule_ids: list[str] = Field(default_factory=list)


class AllergenAssessmentResponse(BaseModel):
    status: AllergenAssessmentStatus
    reason: AllergenAssessmentReason | None
    evidence_coverage: EvidenceCoverageState
    engine_version: str | None = None
    reference_dataset_version: AssessmentReferenceDatasetVersionResponse | None = (
        None
    )
    concepts: list[AllergenConceptOutcomeResponse] = Field(default_factory=list)
    findings: list[AllergenFindingResponse] = Field(default_factory=list)
    source_signals: list[PackageMatchEvidenceResponse] = Field(default_factory=list)


class PackageMatchCandidateResponse(BaseModel):
    source_kind: PackageMatchSourceKind
    allergen_assessment: AllergenAssessmentResponse
    package_variant_id: str | None = None
    product_id: str | None = None
    external_record_id: str | None = None
    source: PackageMatchSourceResponse | None = None
    identity_evidence: list[PackageMatchEvidenceResponse] = Field(default_factory=list)
    label_evidence: list[PackageMatchEvidenceResponse] = Field(default_factory=list)
    reference_images: list[PackageMatchReferenceImageResponse] = Field(default_factory=list)
    retrieved_at: datetime | None = None
    source_revision: str | None = None
    dataset_version: ExternalDatasetVersionResponse | None = None


class OpenFoodFactsLookupResponse(BaseModel):
    status: OpenFoodFactsLookupStatus
    dataset_version: ExternalDatasetVersionResponse | None
    error_code: str | None


class PackageMatchesResponse(BaseModel):
    normalized_identifier: str
    scheme: IdentifierScheme
    candidates: list[PackageMatchCandidateResponse] = Field(
        description=(
            "Candidate Package Matches only; a result does not prove identity with the "
            "physical package in a shopper's possession."
        )
    )
    open_food_facts: OpenFoodFactsLookupResponse


class PackageSearchNameResponse(BaseModel):
    value: str
    language: str | None
    source_field: str


class PackageSearchAdditiveResponse(BaseModel):
    code: str
    name: str


class PackageSearchResultResponse(BaseModel):
    barcode: str
    name: str
    other_names: list[PackageSearchNameResponse] = Field(default_factory=list)
    brand: list[str] | None = None
    made_in: list[str] | None = None
    quantity: str | None = None
    image_url: str | None = None
    ingredients: str | None = None
    allergens: list[str] | None = None
    additives: list[PackageSearchAdditiveResponse] | None = None
    matched_fields: list[str] = Field(default_factory=list)
    source_record_id: str
    source_url: str
    source_updated_at: datetime | None
    source_revision: str | None = None
    dataset_version_id: str
    evidence: list[PackageMatchEvidenceResponse] = Field(default_factory=list)


class PackageSearchResponse(BaseModel):
    query: str
    page: int
    page_size: int
    has_more: bool
    source: str
    dataset_version: ExternalDatasetVersionResponse | None
    results: list[PackageSearchResultResponse] = Field(default_factory=list)
