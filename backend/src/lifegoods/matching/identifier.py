from dataclasses import dataclass

SUPPORTED_SCHEMES = {
    8: "GTIN_8",
    12: "UPC_A",
    13: "EAN_13",
    14: "GTIN_14",
}


class InvalidIdentifierError(ValueError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True, slots=True)
class ExternalIdentifier:
    value: str
    scheme: str


def normalize_identifier(entered: str) -> ExternalIdentifier:
    stripped = entered.strip()
    if not stripped:
        raise InvalidIdentifierError("IDENTIFIER_REQUIRED")

    normalized = stripped.replace(" ", "").replace("-", "")
    if not normalized.isascii() or not normalized.isdigit():
        raise InvalidIdentifierError("IDENTIFIER_CHARACTERS_INVALID")

    scheme = SUPPORTED_SCHEMES.get(len(normalized))
    if scheme is None:
        raise InvalidIdentifierError("IDENTIFIER_LENGTH_UNSUPPORTED")

    body, supplied_check_digit = normalized[:-1], int(normalized[-1])
    weighted_sum = sum(
        int(digit) * (3 if index % 2 == 0 else 1) for index, digit in enumerate(reversed(body))
    )
    expected_check_digit = (10 - weighted_sum % 10) % 10
    if supplied_check_digit != expected_check_digit:
        raise InvalidIdentifierError("IDENTIFIER_CHECK_DIGIT_INVALID")

    return ExternalIdentifier(value=normalized, scheme=scheme)
