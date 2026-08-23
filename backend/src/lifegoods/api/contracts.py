from enum import StrEnum

from pydantic import BaseModel

from lifegoods.matching.identifier import IdentifierScheme


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


class PackageMatchCandidateResponse(BaseModel):
    package_variant_id: str
    product_id: str


class PackageMatchesResponse(BaseModel):
    normalized_identifier: str
    scheme: IdentifierScheme
    candidates: list[PackageMatchCandidateResponse]
