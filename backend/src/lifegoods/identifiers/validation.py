from lifegoods.identifiers.models import (
    SUPPORTED_SCHEMES,
    IdentifierErrorCode,
    InvalidIdentifierError,
    NormalizedIdentifier,
)


def calculate_check_digit(body: str) -> int:
    weighted_sum = sum(
        int(digit) * (3 if index % 2 == 0 else 1)
        for index, digit in enumerate(reversed(body))
    )
    return (10 - weighted_sum % 10) % 10


def normalize_identifier(entered: str) -> NormalizedIdentifier:
    stripped = entered.strip()
    if not stripped:
        raise InvalidIdentifierError(IdentifierErrorCode.REQUIRED)

    normalized = stripped.replace(" ", "").replace("-", "")
    if not normalized.isascii() or not normalized.isdigit():
        raise InvalidIdentifierError(IdentifierErrorCode.CHARACTERS_INVALID)

    scheme = SUPPORTED_SCHEMES.get(len(normalized))
    if scheme is None:
        raise InvalidIdentifierError(IdentifierErrorCode.LENGTH_UNSUPPORTED)

    body, supplied_check_digit = normalized[:-1], int(normalized[-1])
    expected_check_digit = calculate_check_digit(body)
    if supplied_check_digit != expected_check_digit:
        raise InvalidIdentifierError(IdentifierErrorCode.CHECK_DIGIT_INVALID)

    return NormalizedIdentifier(value=normalized, scheme=scheme)
