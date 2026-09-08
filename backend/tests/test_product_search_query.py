import pytest

from lifegoods.product_search.query import (
    InvalidCursorError,
    SearchCursor,
    decode_and_validate_cursor,
    encode_cursor,
    normalize_search_value,
    query_fingerprint,
)


def test_normalize_search_value_preserves_khmer_combining_marks() -> None:
    khmer = "តែបៃតង ទឹកដោះគោ"
    normalized = normalize_search_value(khmer)
    assert normalized == "តែបៃតង ទឹកដោះគោ"

    # Accented Latin characters
    assert normalize_search_value("Café  Crème—100%") == "café crème 100"

    # Numeric brand names
    assert normalize_search_value("1664 Blanc") == "1664 blanc"


def test_query_fingerprint_is_deterministic_and_term_based() -> None:
    terms1 = ("coca", "cola")
    terms2 = ("coca", "cola")
    assert query_fingerprint(terms1) == query_fingerprint(terms2)
    assert query_fingerprint(terms1) != query_fingerprint(("pepsi", "cola"))


def test_cursor_round_trip() -> None:
    terms = ("coca", "cola")
    cursor = encode_cursor(
        terms=terms,
        rank=1,
        name_sort="coca cola zero",
        code="5449000000996",
    )
    assert isinstance(cursor, str)
    assert len(cursor) > 0

    decoded = decode_and_validate_cursor(cursor, expected_terms=terms)
    assert decoded == SearchCursor(
        rank=1,
        name_sort="coca cola zero",
        code="5449000000996",
    )


def test_cursor_rejects_query_mismatch() -> None:
    cursor = encode_cursor(
        terms=("coca", "cola"),
        rank=0,
        name_sort="coca cola",
        code="5449000000996",
    )
    with pytest.raises(InvalidCursorError, match="Pagination cursor is invalid"):
        decode_and_validate_cursor(cursor, expected_terms=("pepsi", "cola"))


@pytest.mark.parametrize(
    "corrupted_cursor",
    [
        "not-base64!@#",
        "",
        "e30",  # '{}' in base64 - missing required keys
        # rank=9 out of bounds
        "eyJmIjogInRlc3QiLCAiciI6IDksICJuIjogIiIsICJjIjogIjEyMyJ9",
        # invalid code or extra keys
        "eyJmIjogInRlc3QiLCAiciI6IDAsICJuIjogIiIsICJjIjogIm5vdC1kaWdpdHMiLCB4IjogMX0",
    ],
)
def test_cursor_rejects_malformed_and_tampered_input(corrupted_cursor: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_and_validate_cursor(corrupted_cursor, expected_terms=("coca", "cola"))
