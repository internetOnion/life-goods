import json
from pathlib import Path

import pytest

from lifegoods.identifiers import InvalidIdentifierError, normalize_identifier

CASES = json.loads(
    (Path(__file__).parents[2] / "evaluation/datasets/identifier_cases.json").read_text()
)


@pytest.mark.parametrize(
    ("entered", "value", "scheme"),
    [(case["entered"], case["value"], case["scheme"]) for case in CASES["valid"]],
)
def test_supported_identifiers_are_normalized(entered: str, value: str, scheme: str) -> None:
    identifier = normalize_identifier(entered)

    assert identifier.value == value
    assert identifier.scheme == scheme


@pytest.mark.parametrize(
    ("entered", "code"),
    [(case["entered"], case["backendCode"]) for case in CASES["invalid"]],
)
def test_invalid_identifiers_report_a_stable_reason(entered: str, code: str) -> None:
    with pytest.raises(InvalidIdentifierError) as error:
        normalize_identifier(entered)

    assert error.value.code == code
