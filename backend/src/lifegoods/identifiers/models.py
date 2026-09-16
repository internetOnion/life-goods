from dataclasses import dataclass
from enum import StrEnum


class IdentifierScheme(StrEnum):
    GTIN_8 = "GTIN_8"
    UPC_A = "UPC_A"
    EAN_13 = "EAN_13"
    GTIN_14 = "GTIN_14"


class IdentifierErrorCode(StrEnum):
    REQUIRED = "IDENTIFIER_REQUIRED"
    CHARACTERS_INVALID = "IDENTIFIER_CHARACTERS_INVALID"
    LENGTH_UNSUPPORTED = "IDENTIFIER_LENGTH_UNSUPPORTED"
    CHECK_DIGIT_INVALID = "IDENTIFIER_CHECK_DIGIT_INVALID"


SUPPORTED_SCHEMES: dict[int, IdentifierScheme] = {
    8: IdentifierScheme.GTIN_8,
    12: IdentifierScheme.UPC_A,
    13: IdentifierScheme.EAN_13,
    14: IdentifierScheme.GTIN_14,
}


class InvalidIdentifierError(ValueError):
    def __init__(self, code: IdentifierErrorCode) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True, slots=True)
class NormalizedIdentifier:
    value: str
    scheme: IdentifierScheme
