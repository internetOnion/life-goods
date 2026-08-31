from enum import StrEnum

from pydantic import BaseModel


class ErrorCode(StrEnum):
    IDENTIFIER_REQUIRED = "IDENTIFIER_REQUIRED"
    IDENTIFIER_CHARACTERS_INVALID = "IDENTIFIER_CHARACTERS_INVALID"
    IDENTIFIER_LENGTH_UNSUPPORTED = "IDENTIFIER_LENGTH_UNSUPPORTED"
    IDENTIFIER_CHECK_DIGIT_INVALID = "IDENTIFIER_CHECK_DIGIT_INVALID"
    PACKAGE_MATCH_SOURCE_UNAVAILABLE = "PACKAGE_MATCH_SOURCE_UNAVAILABLE"
    PACKAGE_SEARCH_QUERY_INVALID = "PACKAGE_SEARCH_QUERY_INVALID"
    REFERENCE_IMAGE_URL_INVALID = "REFERENCE_IMAGE_URL_INVALID"
    REFERENCE_IMAGE_NOT_FOUND = "REFERENCE_IMAGE_NOT_FOUND"
    REFERENCE_IMAGE_SOURCE_UNAVAILABLE = "REFERENCE_IMAGE_SOURCE_UNAVAILABLE"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"


class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class LifeGoodsError(Exception):
    """Base domain error for LifeGoods application."""

    def __init__(self, code: ErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
