import json
from dataclasses import replace
from pathlib import Path

import pytest

from lifegoods.reference_datasets.bundle import (
    FoodAllergenReferenceBundle,
    ReferenceBundle,
    load_reference_bundle,
    parse_reference_bundle,
)
from lifegoods.reference_datasets.validation import validate_bundle

BUNDLES_PATH = Path(__file__).parents[1] / "src" / "lifegoods" / "reference_datasets" / "bundles"


@pytest.mark.parametrize(
    ("filename", "expected_sha256"),
    [
        (
            "codex_2026_food_allergen_minimal.json",
            "cb3208c1e6f324a6b289f921800224db8e55a7d1728f5b6092da28e1d9d770ee",
        ),
        (
            "codex_2026_food_allergen_reviewed_english_v1.json",
            "faa4f24d111684e29f8352696594cea60e3fa98a65e7a17db3000118c5783292",
        ),
    ],
)
def test_food_allergen_bundle_payload_and_hash_remain_unchanged(
    filename: str, expected_sha256: str
) -> None:
    bundle_path = BUNDLES_PATH / filename
    raw_payload = json.loads(bundle_path.read_text(encoding="utf-8"))

    bundle = load_reference_bundle(bundle_path)
    serialized_payload = bundle.to_dict()
    reparsed_bundle = parse_reference_bundle(serialized_payload)

    assert isinstance(bundle, FoodAllergenReferenceBundle)
    assert ReferenceBundle is FoodAllergenReferenceBundle
    assert set(raw_payload) == {
        "manifest",
        "sources",
        "concepts",
        "mappings",
        "exclusions",
        "rules",
    }
    assert reparsed_bundle.to_dict() == serialized_payload
    assert bundle.compute_sha256() == expected_sha256
    assert reparsed_bundle.compute_sha256() == expected_sha256
    assert bundle.manifest.sha256 == expected_sha256


def test_manifest_first_dispatch_rejects_missing_manifest() -> None:
    with pytest.raises(ValueError, match="Reference dataset bundle must contain a manifest object"):
        parse_reference_bundle({"sources": []})


def test_manifest_first_dispatch_rejects_missing_dataset_kind() -> None:
    with pytest.raises(
        ValueError,
        match="Reference dataset manifest is missing required field 'dataset_kind'",
    ):
        parse_reference_bundle({"manifest": {}, "sources": []})


def test_manifest_first_dispatch_rejects_unsupported_dataset_kind() -> None:
    with pytest.raises(
        ValueError,
        match="Unsupported dataset kind 'HALAL_INGREDIENT'.*FOOD_ALLERGEN",
    ):
        parse_reference_bundle(
            {
                "manifest": {"dataset_kind": "HALAL_INGREDIENT"},
                "sources": [],
            }
        )


def test_food_allergen_dispatch_rejects_foreign_domain_sections() -> None:
    bundle_path = BUNDLES_PATH / "codex_2026_food_allergen_minimal.json"
    payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    payload["halal_ingredient_mappings"] = []

    with pytest.raises(
        ValueError,
        match=(
            "Dataset kind 'FOOD_ALLERGEN' does not support top-level section.*"
            "halal_ingredient_mappings"
        ),
    ):
        parse_reference_bundle(payload)


def test_food_allergen_compatibility_parser_rejects_other_kinds() -> None:
    bundle_path = BUNDLES_PATH / "codex_2026_food_allergen_minimal.json"
    payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    payload["manifest"]["dataset_kind"] = "COELIAC_GLUTEN"

    with pytest.raises(
        ValueError,
        match="Dataset kind 'COELIAC_GLUTEN' cannot be parsed as a FOOD_ALLERGEN bundle",
    ):
        ReferenceBundle.from_dict(payload)


def test_unsupported_dataset_kind_does_not_run_food_allergen_invariants() -> None:
    bundle = load_reference_bundle(BUNDLES_PATH / "codex_2026_food_allergen_minimal.json")
    assert isinstance(bundle, FoodAllergenReferenceBundle)
    unsupported_bundle = replace(
        bundle,
        manifest=replace(bundle.manifest, dataset_kind="COELIAC_GLUTEN", sha256=""),
        mappings=[],
        rules=[],
    )

    report = validate_bundle(unsupported_bundle)

    assert not report.is_valid
    assert report.errors == [
        "Unsupported dataset kind 'COELIAC_GLUTEN'. Must be one of ['FOOD_ALLERGEN']"
    ]
