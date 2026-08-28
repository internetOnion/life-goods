from pathlib import Path

import pytest

from lifegoods.reference_datasets.bundle import AllergenRuleKind, ReferenceBundle
from lifegoods.reference_datasets.validation import validate_bundle

BUNDLE_PATH = (
    Path(__file__).parents[1]
    / "src"
    / "lifegoods"
    / "reference_datasets"
    / "bundles"
    / "codex_2026_food_allergen_direct_names_v1.json"
)

EXPECTED_DIRECT_NAMES = {
    "concept-food-allergen-almond": "almond",
    "concept-food-allergen-anchovy": "anchovy",
    "concept-food-allergen-brazil-nut": "Brazil nut",
    "concept-food-allergen-buckwheat": "buckwheat",
    "concept-food-allergen-cashew": "cashew",
    "concept-food-allergen-celery": "celery",
    "concept-food-allergen-cod": "cod",
    "concept-food-allergen-crustacea": "crustacea",
    "concept-food-allergen-egg": "egg",
    "concept-food-allergen-fish": "fish",
    "concept-food-allergen-hazelnut": "hazelnut",
    "concept-food-allergen-lupin": "lupin",
    "concept-food-allergen-macadamia": "macadamia",
    "concept-food-allergen-mackerel": "mackerel",
    "concept-food-allergen-milk": "milk",
    "concept-food-allergen-mustard": "mustard",
    "concept-food-allergen-peanut": "peanut",
    "concept-food-allergen-pecan": "pecan",
    "concept-food-allergen-pine-nut": "pine nut",
    "concept-food-allergen-pistachio": "pistachio",
    "concept-food-allergen-salmon": "salmon",
    "concept-food-allergen-sardine": "sardine",
    "concept-food-allergen-sesame": "sesame",
    "concept-food-allergen-soy": "soy",
    "concept-food-allergen-tuna": "tuna",
    "concept-food-allergen-walnut": "walnut",
}


def load_bundle() -> ReferenceBundle:
    return ReferenceBundle.from_json_file(BUNDLE_PATH)


def unhashed_bundle(data: dict) -> ReferenceBundle:
    data["manifest"]["sha256"] = ""
    return ReferenceBundle.from_dict(data)


def test_reviewed_release_has_exactly_26_leaf_direct_names_and_three_parents() -> None:
    bundle = load_bundle()
    report = validate_bundle(bundle)

    assert report.is_valid, report.errors
    assert bundle.manifest.id == "codex-food-allergen-2026-direct-names-v1"
    assert report.sha256 == bundle.manifest.sha256
    assert len(bundle.concepts) == 29
    assert len(bundle.mappings) == 26
    assert len(bundle.rules) == 27

    leaves = {concept.id: concept for concept in bundle.concepts if concept.is_leaf}
    parents = {concept.id: concept for concept in bundle.concepts if not concept.is_leaf}
    assert set(leaves) == set(EXPECTED_DIRECT_NAMES)
    assert set(parents) == {
        "concept-food-allergen-root",
        "concept-food-allergen-fish-group",
        "concept-food-allergen-specific-tree-nuts",
    }

    mappings = {mapping.concept_id: mapping for mapping in bundle.mappings}
    assert {concept_id: mapping.mapped_text for concept_id, mapping in mappings.items()} == (
        EXPECTED_DIRECT_NAMES
    )
    assert all(mapping.language == "en" for mapping in mappings.values())
    assert all(mapping.relationship_type == "EXACT_NAME" for mapping in mappings.values())

    declaration_rules = [rule for rule in bundle.rules if rule.rule_kind != "EXEMPTION"]
    assert len(declaration_rules) == 26
    assert {rule.concept_id for rule in declaration_rules} == set(leaves)
    assert sum(
        rule.rule_kind == AllergenRuleKind.REGIONAL_OR_NATIONAL_DECLARATION
        for rule in declaration_rules
    ) == 8
    exemptions = [rule for rule in bundle.rules if rule.rule_kind == "EXEMPTION"]
    assert [rule.concept_id for rule in exemptions] == ["concept-food-allergen-root"]


@pytest.mark.parametrize(
    ("mutation", "error_text"),
    [
        (
            lambda data: data["rules"][0].update(rule_kind="UNKNOWN_RULE_KIND"),
            "invalid rule kind 'UNKNOWN_RULE_KIND'",
        ),
        (
            lambda data: data["concepts"][0].update(is_leaf=True),
            "has children but is marked as a leaf",
        ),
        (
            lambda data: data["mappings"][0].update(
                concept_id="concept-food-allergen-root"
            ),
            "targets non-leaf concept 'concept-food-allergen-root'",
        ),
        (
            lambda data: data["mappings"].pop(),
            "does not have exactly one reviewed English EXACT_NAME mapping",
        ),
        (
            lambda data: data["rules"].pop(0),
            "does not have an applicable declaration rule",
        ),
    ],
)
def test_release_invariants_are_rejected(mutation, error_text: str) -> None:
    data = load_bundle().to_dict()
    mutation(data)

    report = validate_bundle(unhashed_bundle(data))

    assert not report.is_valid
    assert any(error_text in error for error in report.errors)


def test_new_release_excludes_unreviewed_or_out_of_scope_terms() -> None:
    bundle = load_bundle()
    mapped_terms = {mapping.mapped_text.casefold() for mapping in bundle.mappings}
    serialized = str(bundle.to_dict()).casefold()

    assert mapped_terms.isdisjoint(
        {"whey", "lactose", "wheat", "rye", "barley", "oats", "sulphite", "sulfite"}
    )
    assert "coeliac_gluten" not in serialized
    assert "sulphite_sensitivity" not in serialized
    assert "intolerance" not in serialized
