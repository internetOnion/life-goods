from datetime import datetime
from typing import Any

from pydantic import BaseModel

from lifegoods.identifiers.models import IdentifierScheme
from lifegoods.package_matches.models import (
    OpenFoodFactsLookupStatus,
    PackageMatchSourceKind,
)


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
    value: Any
    source_field: str
    source_name: str
    source_url: str
    language: str | None
    observed_at: datetime | None
    retrieved_at: datetime
    source_revision: str | None = None


class PackageMatchReferenceImageResponse(BaseModel):
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


class PackageMatchCandidateResponse(BaseModel):
    source_kind: PackageMatchSourceKind
    package_variant_id: str | None
    product_id: str | None
    external_record_id: str | None
    source: PackageMatchSourceResponse | None
    identity_evidence: list[PackageMatchEvidenceResponse]
    label_evidence: list[PackageMatchEvidenceResponse]
    reference_images: list[PackageMatchReferenceImageResponse]
    retrieved_at: datetime | None
    is_current: bool | None
    source_revision: str | None
    dataset_version_id: str | None = None
    dataset_retrieved_at: datetime | None = None
    dataset_activated_at: datetime | None = None
    dataset_source_url: str | None = None
    dataset_sha256: str | None = None


class ExternalDatasetVersionResponse(BaseModel):
    id: str
    source_url: str
    retrieved_at: datetime
    activated_at: datetime
    sha256: str


class OpenFoodFactsLookupResponse(BaseModel):
    status: OpenFoodFactsLookupStatus
    dataset_version: ExternalDatasetVersionResponse | None
    error_code: str | None


class PackageMatchesResponse(BaseModel):
    normalized_identifier: str
    scheme: IdentifierScheme
    candidates: list[PackageMatchCandidateResponse]
    open_food_facts: OpenFoodFactsLookupResponse
