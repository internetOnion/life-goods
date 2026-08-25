from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel

from lifegoods.matching.identifier import IdentifierScheme
from lifegoods.matching.repository import PackageMatchSourceKind


class ErrorCode(StrEnum):
    IDENTIFIER_REQUIRED = "IDENTIFIER_REQUIRED"
    IDENTIFIER_CHARACTERS_INVALID = "IDENTIFIER_CHARACTERS_INVALID"
    IDENTIFIER_LENGTH_UNSUPPORTED = "IDENTIFIER_LENGTH_UNSUPPORTED"
    IDENTIFIER_CHECK_DIGIT_INVALID = "IDENTIFIER_CHECK_DIGIT_INVALID"
    PACKAGE_MATCH_SOURCE_UNAVAILABLE = "PACKAGE_MATCH_SOURCE_UNAVAILABLE"


class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


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


class PackageMatchReferenceImageResponse(BaseModel):
    role: str
    url: str
    source_field: str
    source_name: str
    source_url: str
    attribution: str
    license_name: str
    language: str | None


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


class PackageMatchesResponse(BaseModel):
    normalized_identifier: str
    scheme: IdentifierScheme
    candidates: list[PackageMatchCandidateResponse]
