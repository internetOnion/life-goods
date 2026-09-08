from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from enum import StrEnum

from lifegoods.identifiers import (
    InvalidIdentifierError,
    NormalizedIdentifier,
    normalize_identifier,
)

MIN_QUERY_LENGTH = 2
MAX_QUERY_LENGTH = 200
MAX_QUERY_TERMS = 10
SUPPORTED_BARCODE_LENGTHS = {8, 12, 13, 14}


class QueryClassification(StrEnum):
    BARCODE = "barcode"
    TEXT = "text"


class QueryValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def extract_terms(text: str) -> tuple[str, ...]:
    """Extract normalized terms while preserving Unicode combining marks.

    NFKC normalizes and casefolds the text, then groups consecutive word
    characters (Unicode categories L: Letter, M: Mark, N: Number).
    """
    normalized = unicodedata.normalize("NFKC", text).casefold()
    terms: list[str] = []
    current: list[str] = []
    for char in normalized:
        cat = unicodedata.category(char)
        if cat[0] in ("L", "M", "N"):
            current.append(char)
        else:
            if current:
                token = "".join(current)
                if any(unicodedata.category(c)[0] in ("L", "N") for c in token):
                    terms.append(token)
                current = []
    if current:
        token = "".join(current)
        if any(unicodedata.category(c)[0] in ("L", "N") for c in token):
            terms.append(token)
    return tuple(terms)


@dataclass(frozen=True, slots=True)
class ParsedSearchQuery:
    raw: str
    classification: QueryClassification
    terms: tuple[str, ...]
    normalized_barcode: NormalizedIdentifier | None = None


def parse_and_validate_query(raw_query: str) -> ParsedSearchQuery:
    """Validate query limits, classify as Barcode or Text, and extract terms."""
    stripped = raw_query.strip()
    if len(stripped) < MIN_QUERY_LENGTH or len(raw_query) > MAX_QUERY_LENGTH:
        raise QueryValidationError(
            "invalid_query",
            f"Query must be between {MIN_QUERY_LENGTH} and {MAX_QUERY_LENGTH} characters",
        )

    terms = extract_terms(raw_query)
    if not terms:
        raise QueryValidationError(
            "invalid_query",
            "Query cannot be empty or contain only punctuation",
        )
    if len(terms) > MAX_QUERY_TERMS:
        raise QueryValidationError(
            "invalid_query",
            f"Query must contain at most {MAX_QUERY_TERMS} terms",
        )

    digits_candidate = stripped.replace(" ", "").replace("-", "")

    if digits_candidate.isascii() and digits_candidate.isdigit():
        if len(digits_candidate) in SUPPORTED_BARCODE_LENGTHS:
            try:
                normalized_id = normalize_identifier(stripped)
                return ParsedSearchQuery(
                    raw=raw_query,
                    classification=QueryClassification.BARCODE,
                    terms=terms,
                    normalized_barcode=normalized_id,
                )
            except InvalidIdentifierError as err:
                raise QueryValidationError(
                    "invalid_barcode",
                    "Barcode is invalid",
                ) from err

        return ParsedSearchQuery(
            raw=raw_query,
            classification=QueryClassification.TEXT,
            terms=terms,
            normalized_barcode=None,
        )

    return ParsedSearchQuery(
        raw=raw_query,
        classification=QueryClassification.TEXT,
        terms=terms,
        normalized_barcode=None,
    )
