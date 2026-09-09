from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import re
from dataclasses import dataclass
from enum import StrEnum

from lifegoods.identifiers import (
    InvalidIdentifierError,
    NormalizedIdentifier,
    normalize_identifier,
)
from lifegoods.open_food_facts.search_index import (
    SearchCursor,
    extract_terms,
    normalize_search_value,
)

__all__ = [
    "MAX_CURSOR_CODE_LENGTH",
    "MAX_NAME_SORT_LENGTH",
    "MAX_QUERY_LENGTH",
    "MAX_QUERY_TERMS",
    "MIN_QUERY_LENGTH",
    "SUPPORTED_BARCODE_LENGTHS",
    "InvalidCursorError",
    "ParsedSearchQuery",
    "QueryClassification",
    "QueryValidationError",
    "SearchCursor",
    "decode_and_validate_cursor",
    "encode_cursor",
    "extract_terms",
    "normalize_search_value",
    "parse_and_validate_query",
    "query_fingerprint",
]

MIN_QUERY_LENGTH = 2
MAX_QUERY_LENGTH = 200
MAX_QUERY_TERMS = 10
SUPPORTED_BARCODE_LENGTHS = {8, 12, 13, 14}
MAX_NAME_SORT_LENGTH = 200
MAX_CURSOR_CODE_LENGTH = 30
MAX_CURSOR_LENGTH = 4096


class QueryClassification(StrEnum):
    BARCODE = "barcode"
    TEXT = "text"


class QueryValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class InvalidCursorError(ValueError):
    def __init__(self, message: str = "Pagination cursor is invalid") -> None:
        super().__init__(message)
        self.code = "invalid_cursor"
        self.message = message


def query_fingerprint(terms: tuple[str, ...]) -> str:
    """Compute a deterministic hash for a query term sequence."""
    return hashlib.sha256(" ".join(terms).encode("utf-8")).hexdigest()[:16]


def encode_cursor(
    *,
    terms: tuple[str, ...],
    rank: int,
    name_sort: str,
    code: str,
) -> str:
    """Encode pagination state into an opaque URL-safe cursor token."""
    fp = query_fingerprint(terms)
    bounded_name_sort = name_sort[:MAX_NAME_SORT_LENGTH]
    payload = {
        "f": fp,
        "r": rank,
        "n": bounded_name_sort,
        "c": code,
    }
    raw_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw_bytes).decode("ascii").rstrip("=")


def decode_and_validate_cursor(
    cursor: str,
    *,
    expected_terms: tuple[str, ...],
) -> SearchCursor:
    """Decode and validate an opaque cursor token against expected query terms."""
    if (
        not isinstance(cursor, str)
        or not cursor
        or len(cursor) > MAX_CURSOR_LENGTH
        or re.fullmatch(r"[A-Za-z0-9_-]+", cursor) is None
    ):
        raise InvalidCursorError("Pagination cursor is invalid")

    try:
        padding = "=" * ((4 - len(cursor) % 4) % 4)
        raw_bytes = base64.b64decode(
            (cursor + padding).encode("ascii"), altchars=b"-_", validate=True
        )
        if base64.urlsafe_b64encode(raw_bytes).decode("ascii").rstrip("=") != cursor:
            raise InvalidCursorError()
        data = json.loads(raw_bytes.decode("utf-8"))
    except (ValueError, UnicodeError, binascii.Error, RecursionError) as err:
        raise InvalidCursorError("Pagination cursor is invalid") from err

    if not isinstance(data, dict):
        raise InvalidCursorError("Pagination cursor is invalid")

    expected_keys = {"f", "r", "n", "c"}
    if set(data.keys()) != expected_keys:
        raise InvalidCursorError("Pagination cursor is invalid")

    fp = data.get("f")
    rank = data.get("r")
    name_sort = data.get("n")
    code = data.get("c")

    if (
        not isinstance(fp, str)
        or re.fullmatch(r"[0-9a-f]{16}", fp) is None
        or not isinstance(name_sort, str)
        or not isinstance(code, str)
    ):
        raise InvalidCursorError("Pagination cursor is invalid")
    if not isinstance(rank, int) or isinstance(rank, bool):
        raise InvalidCursorError("Pagination cursor is invalid")
    if rank not in (0, 1, 2, 3):
        raise InvalidCursorError("Pagination cursor is invalid")
    try:
        name_sort.encode("utf-8")
    except UnicodeEncodeError as error:
        raise InvalidCursorError() from error
    if len(name_sort) > MAX_NAME_SORT_LENGTH:
        raise InvalidCursorError("Pagination cursor is invalid")
    if len(code) > MAX_CURSOR_CODE_LENGTH or not code or not code.isascii() or not code.isdigit():
        raise InvalidCursorError("Pagination cursor is invalid")

    expected_fp = query_fingerprint(expected_terms)
    if not hmac.compare_digest(fp, expected_fp):
        raise InvalidCursorError("Pagination cursor is invalid")

    return SearchCursor(
        rank=rank,
        name_sort=name_sort,
        code=code,
    )


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
