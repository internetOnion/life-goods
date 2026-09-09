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


def test_cursor_round_trip_rank_3_prefix() -> None:
    terms = ("coca", "col")
    cursor = encode_cursor(
        terms=terms,
        rank=3,
        name_sort="coca cold",
        code="5449000000996",
    )
    assert isinstance(cursor, str)
    decoded = decode_and_validate_cursor(cursor, expected_terms=terms)
    assert decoded == SearchCursor(
        rank=3,
        name_sort="coca cold",
        code="5449000000996",
    )


@pytest.mark.parametrize(
    "corrupted_cursor",
    [
        "not-base64!@#",
        "",
        "e30",  # '{}' in base64 - missing required keys
        # rank=9 out of bounds
        "eyJmIjogInRlc3QiLCAiciI6IDksICJuIjogIiIsICJjIjogIjEyMyJ9",
        # rank=4 out of bounds
        "eyJmIjogInRlc3QiLCAiciI6IDQsICJuIjogIiIsICJjIjogIjEyMyJ9",
        # invalid code or extra keys
        "eyJmIjogInRlc3QiLCAiciI6IDAsICJuIjogIiIsICJjIjogIm5vdC1kaWdpdHMiLCB4IjogMX0",
    ],
)
def test_cursor_rejects_malformed_and_tampered_input(corrupted_cursor: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_and_validate_cursor(corrupted_cursor, expected_terms=("coca", "cola"))


@pytest.mark.parametrize(
    "suffix",
    ["!!!!", "!" * 100_000, "=", "\n", " "],
    ids=["garbage", "oversized", "padding", "newline", "space"],
)
def test_cursor_rejects_noncanonical_encoding(suffix: str) -> None:
    cursor = encode_cursor(terms=("milk",), rank=2, name_sort="milk", code="4006381333931")
    with pytest.raises(InvalidCursorError):
        decode_and_validate_cursor(cursor + suffix, expected_terms=("milk",))


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("r", True),
        ("r", "2"),
        ("r", -1),
        ("f", "é"),
        ("f", "A" * 16),
        ("n", []),
        ("n", "\ud800"),
        ("n", "a" * 201),
        ("c", "١٢٣"),
        ("c", ""),
        ("c", "1" * 31),
    ],
)
def test_cursor_rejects_invalid_fields(key: str, value: object) -> None:
    import base64
    import json

    payload = {"f": query_fingerprint(("milk",)), "r": 2, "n": "milk", "c": "4006381333931"}
    payload[key] = value
    cursor = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    with pytest.raises(InvalidCursorError):
        decode_and_validate_cursor(cursor, expected_terms=("milk",))


def test_cursor_bounds_and_unicode_name_round_trip() -> None:
    terms = ("ទឹកដោះគោ",)
    name = "ទឹកដោះគោ😀" * 20
    cursor = encode_cursor(terms=terms, rank=3, name_sort=name, code="4006381333931")
    assert decode_and_validate_cursor(cursor, expected_terms=terms).name_sort == name[:200]
    with pytest.raises(InvalidCursorError):
        decode_and_validate_cursor("a" * 4097, expected_terms=terms)
