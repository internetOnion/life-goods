import pytest

from lifegoods.matching.identifier import InvalidIdentifierError, normalize_identifier


@pytest.mark.parametrize(
    ("entered", "value", "scheme"),
    [
        ("9638 5074", "96385074", "GTIN_8"),
        ("0-12345-67890-5", "012345678905", "UPC_A"),
        ("4 006381 333931", "4006381333931", "EAN_13"),
        ("1 0012345 000017", "10012345000017", "GTIN_14"),
    ],
)
def test_supported_identifiers_are_normalized(entered: str, value: str, scheme: str) -> None:
    identifier = normalize_identifier(entered)

    assert identifier.value == value
    assert identifier.scheme == scheme


@pytest.mark.parametrize(
    ("entered", "code"),
    [
        ("", "IDENTIFIER_REQUIRED"),
        ("1234", "IDENTIFIER_LENGTH_UNSUPPORTED"),
        ("4006381333932", "IDENTIFIER_CHECK_DIGIT_INVALID"),
        ("40063813A3931", "IDENTIFIER_CHARACTERS_INVALID"),
    ],
)
def test_invalid_identifiers_report_a_stable_reason(entered: str, code: str) -> None:
    with pytest.raises(InvalidIdentifierError) as error:
        normalize_identifier(entered)

    assert error.value.code == code
