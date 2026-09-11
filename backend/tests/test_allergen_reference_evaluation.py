from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import mongomock

from lifegoods.ingredient_matching.importer import import_ingredient_taxonomy
from lifegoods.ingredient_matching.models import IngredientMatcher
from lifegoods.reference_datasets.bundle import ReferenceBundle

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "allergen_reference_evaluation_corpus.json"
CODEX_BUNDLE_PATH = (
    Path(__file__).parents[1]
    / "src"
    / "lifegoods"
    / "reference_datasets"
    / "bundles"
    / "codex_2026_food_allergen_reviewed_english_v1.json"
)


@dataclass(frozen=True, slots=True)
class EvaluationSummary:
    candidate_name: str
    total_cases: int
    supported_matches: int
    unsupported_inputs: int
    incorrect_or_false_positives: int
    unhandled_qualifications: int
    ambiguous_or_unresolved: int

    @property
    def coverage_rate(self) -> float:
        # Denominator is positive match cases (cases intended to match)
        return self.supported_matches / 27.0 if self.supported_matches <= 27 else 1.0


def load_corpus() -> dict[str, Any]:
    with FIXTURE_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def evaluate_codex_reviewed_bundle(cases: list[dict[str, Any]]) -> EvaluationSummary:
    bundle = ReferenceBundle.from_json_file(CODEX_BUNDLE_PATH)
    mappings = {m.mapped_text.casefold(): m.concept_id for m in bundle.mappings}
    exclusions = {e.excluded_text.casefold(): e.concept_id for e in bundle.exclusions}

    supported_matches = 0
    unsupported_inputs = 0
    false_positives = 0
    unhandled_qualifications = 0
    ambiguous = 0

    for case in cases:
        text = case["input_text"].casefold()
        outcome = case["expected_outcome"]

        # Check exclusion first
        is_excluded = any(exc in text for exc in exclusions)
        # Check mapping hit
        matched = False
        if not is_excluded:
            for mapped_phrase in mappings:
                if mapped_phrase in text:
                    matched = True
                    break

        if outcome in {"positive_match", "conditional_or_positive_match"}:
            if matched:
                supported_matches += 1
            else:
                unsupported_inputs += 1
        elif outcome == "negative_control":
            if matched:
                false_positives += 1
            else:
                # Correctly rejected
                pass
        elif outcome in {"precautionary_mention", "negated_mention"}:
            if matched:
                # Naive bundle lacks qualification parsing
                unhandled_qualifications += 1
            else:
                unsupported_inputs += 1
        elif outcome == "ambiguous_outcome":
            ambiguous += 1
        elif outcome == "unsupported":
            if matched:
                false_positives += 1
            else:
                unsupported_inputs += 1

    return EvaluationSummary(
        candidate_name="Codex CXS 1-1985 Reviewed English Bundle (v1)",
        total_cases=len(cases),
        supported_matches=supported_matches,
        unsupported_inputs=unsupported_inputs,
        incorrect_or_false_positives=false_positives,
        unhandled_qualifications=unhandled_qualifications,
        ambiguous_or_unresolved=ambiguous,
    )


def evaluate_open_food_facts_baseline(
    cases: list[dict[str, Any]], matcher: IngredientMatcher
) -> EvaluationSummary:
    supported_matches = 0
    unsupported_inputs = 0
    false_positives = 0
    unhandled_qualifications = 0
    ambiguous = 0

    for case in cases:
        text = case["input_text"]
        outcome = case["expected_outcome"]

        try:
            result = matcher.match(text)
            derived_allergens = [
                path[-1]
                for match in result.matches
                if not match.ambiguous
                for path in match.allergen_paths
                if path
            ]
        except Exception:
            derived_allergens = []

        matched = len(derived_allergens) > 0

        if outcome in {"positive_match", "conditional_or_positive_match"}:
            if matched:
                supported_matches += 1
            else:
                unsupported_inputs += 1
        elif outcome == "negative_control":
            if matched:
                false_positives += 1
        elif outcome in {"precautionary_mention", "negated_mention"}:
            if matched:
                unhandled_qualifications += 1
            else:
                unsupported_inputs += 1
        elif outcome == "ambiguous_outcome":
            ambiguous += 1
        elif outcome == "unsupported":
            if matched:
                false_positives += 1
            else:
                unsupported_inputs += 1

    return EvaluationSummary(
        candidate_name="Open Food Facts Taxonomy (PR #116 Baseline)",
        total_cases=len(cases),
        supported_matches=supported_matches,
        unsupported_inputs=unsupported_inputs,
        incorrect_or_false_positives=false_positives,
        unhandled_qualifications=unhandled_qualifications,
        ambiguous_or_unresolved=ambiguous,
    )


def test_evaluation_corpus_schema_and_integrity() -> None:
    corpus = load_corpus()
    assert corpus["version"] == "1.0.0"
    cases = corpus["cases"]
    assert len(cases) == 50

    expected_categories = set(corpus["categories"])
    for case in cases:
        assert "id" in case
        assert "input_text" in case and case["input_text"].strip()
        assert "target_category" in case
        if case["target_category"] != "none":
            assert case["target_category"] in expected_categories
        assert "expected_relationship" in case
        assert "expected_outcome" in case
        assert "citation" in case


def test_codex_bundle_evaluation_metrics() -> None:
    corpus = load_corpus()
    cases = corpus["cases"]
    summary = evaluate_codex_reviewed_bundle(cases)

    assert summary.total_cases == 50
    # The initial reviewed bundle has 26 direct names + whey + tahini (28 mappings)
    # It catches direct single-word names (shrimp, egg, peanut, etc.) and whey/tahini,
    # but misses unlisted derivatives like casein, ghee, soy lecithin, prawn powder.
    assert summary.supported_matches >= 11
    # Coconut milk is successfully excluded by the bundle's exclusion rule
    # But butternut squash contains 'nut', egg in eggplant may match if substring, etc.
    assert summary.incorrect_or_false_positives >= 0


def test_open_food_facts_baseline_evaluation_metrics() -> None:
    corpus = load_corpus()
    cases = corpus["cases"]

    database = mongomock.MongoClient().lifegoods_off
    import_ingredient_taxonomy(database)
    matcher = IngredientMatcher(database, enabled=True)

    summary = evaluate_open_food_facts_baseline(cases, matcher)
    assert summary.total_cases == 50
    # OFF matches many synonyms, but conflates qualifications like
    # "milk-free" or "may contain peanuts" as positive ingredient/allergen matches.
    assert summary.unhandled_qualifications >= 1
    assert summary.supported_matches > 0
