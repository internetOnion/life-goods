from __future__ import annotations

from dataclasses import dataclass

from lifegoods.ingredient_matching.models import (
    IngredientMatch,
    IngredientMatchResult,
    IngredientUnmatchedSpan,
)
from lifegoods.product_lookup.allergen_analysis import ProductAllergenAnalyzer


@dataclass
class StubMatcher:
    result: IngredientMatchResult

    def match(self, ingredient_text: str) -> IngredientMatchResult:
        del ingredient_text
        return self.result


def test_analysis_keeps_off_tags_and_derives_allergens_independently() -> None:
    matcher = StubMatcher(
        IngredientMatchResult(
            ingredient_tags=("en:milk-powder", "en:peanut"),
            matches=(
                IngredientMatch(
                    matched_text="milk powder",
                    start=0,
                    end=11,
                    alias="milk powder",
                    tags=("en:milk-powder",),
                    name="milk powder",
                    parents=("en:dairy",),
                    allergen_paths=(
                        ("en:milk-powder", "en:dairy", "en:milk"),
                    ),
                ),
                IngredientMatch(
                    matched_text="peanut",
                    start=13,
                    end=19,
                    alias="peanut",
                    tags=("en:peanut",),
                    name="peanut",
                    parents=("en:nut",),
                    allergen_paths=(("en:peanut", "en:peanuts"),),
                ),
            ),
            taxonomy_sha256="ingredient-hash",
        )
    )

    record = {
        "ingredients_text_en": "Milk powder, sugar, peanut",
        "allergens_tags": ["en:milk"],
        "code": "4006381333931",
    }

    result = ProductAllergenAnalyzer(matcher).analyze(record)

    assert result["off"] == {
        "state": "available",
        "tags": ["en:milk"],
    }
    assert result["ingredient_matching"]["state"] == "completed"
    assert result["ingredient_matching"]["tags"] == ["en:milk", "en:peanuts"]
    assert result["comparison"] == {
        "state": "available",
        "in_both": ["en:milk"],
        "off_only": [],
        "ingredient_matching_only": ["en:peanuts"],
        "sets_equal": False,
    }
    assert record["allergens_tags"] == ["en:milk"]


def test_analysis_runs_when_off_tags_are_empty_and_reports_missing_text() -> None:
    matcher = StubMatcher(
        IngredientMatchResult(
            ingredient_tags=("en:peanut",),
            matches=(),
            taxonomy_sha256="ingredient-hash",
        )
    )

    result = ProductAllergenAnalyzer(matcher).analyze(
        {"ingredients_text_en": "peanut", "allergens_tags": []}
    )

    assert result["off"] == {"state": "empty", "tags": []}
    assert result["ingredient_matching"]["state"] == "completed"
    assert result["comparison"]["ingredient_matching_only"] == []

    missing = ProductAllergenAnalyzer(matcher).analyze({"allergens_tags": []})
    assert missing["ingredient_matching"]["state"] == "unavailable"
    assert missing["ingredient_matching"]["reason"] == "ingredient_text_unavailable"
    assert missing["comparison"]["state"] == "unavailable"


def test_analysis_marks_partial_text_evidence_as_insufficient() -> None:
    result = IngredientMatchResult(
        ingredient_tags=("en:peanut",),
        matches=(),
        taxonomy_sha256="ingredient-hash",
        unmatched_texts=("mystery",),
    )

    analysis = ProductAllergenAnalyzer(StubMatcher(result)).analyze(
        {"ingredients_text_en": "peanut, mystery", "allergens_tags": []}
    )

    assert analysis["ingredient_matching"]["quality"] == "insufficient"
    assert analysis["ingredient_matching"]["unmatched_texts"] == ["mystery"]
    assert "unmatched_ingredient_text" in analysis["ingredient_matching"]["limitations"]


def test_analysis_excludes_qualified_and_unresolved_matches_from_positive_tags() -> None:
    result = IngredientMatchResult(
        ingredient_tags=("en:wheat-flour", "en:peanut", "en:milk"),
        matches=(
            IngredientMatch(
                matched_text="wheat flour",
                start=0,
                end=11,
                alias="wheat flour",
                tags=("en:wheat-flour",),
                name="wheat flour",
                parents=(),
                allergen_paths=(("en:wheat-flour", "en:gluten"),),
            ),
            IngredientMatch(
                matched_text="peanuts",
                start=24,
                end=31,
                alias="peanuts",
                tags=("en:peanut",),
                name="peanut",
                parents=(),
                allergen_paths=(("en:peanut", "en:peanuts"),),
                qualification="precautionary_statement",
            ),
            IngredientMatch(
                matched_text="milk",
                start=33,
                end=37,
                alias="milk",
                tags=("en:milk",),
                name="milk",
                parents=(),
                allergen_paths=(("en:milk", "en:milk"),),
                qualification="negated_mention",
            ),
            IngredientMatch(
                matched_text="natural flavors",
                start=39,
                end=55,
                alias="natural flavors",
                tags=("en:natural-flavouring",),
                name="natural flavors",
                parents=(),
                qualification="unresolved_context",
            ),
        ),
        taxonomy_sha256="ingredient-hash",
        unmatched_spans=(IngredientUnmatchedSpan("mystery", 57, 64),),
        unmatched_texts=("mystery",),
    )

    analysis = ProductAllergenAnalyzer(StubMatcher(result)).analyze(
        {
            "ingredients_text_en": (
                "wheat flour, may contain peanuts, milk-free, "
                "natural flavors, mystery"
            ),
            "allergens_tags": [],
        }
    )

    matching = analysis["ingredient_matching"]
    assert matching["tags"] == ["en:gluten"]
    assert [item["qualification"] for item in matching["qualifications"]] == [
        "precautionary_statement",
        "negated_mention",
        "unresolved_context",
    ]
    assert matching["unmatched_spans"] == [
        {"text": "mystery", "start": 57, "end": 64}
    ]
    assert "qualified_mentions_excluded" in matching["limitations"]


def test_analysis_keeps_ambiguous_evidence_visible_without_inventing_allergens() -> None:
    result = IngredientMatchResult(
        ingredient_tags=("en:wheat-flour", "en:ambiguous-a", "en:ambiguous-b"),
        matches=(
            IngredientMatch(
                matched_text="wheat flour",
                start=0,
                end=11,
                alias="wheat flour",
                tags=("en:wheat-flour",),
                name="wheat flour",
                parents=(),
                allergen_paths=(("en:wheat-flour", "en:gluten"),),
            ),
            IngredientMatch(
                matched_text="gelatin",
                start=13,
                end=20,
                alias="gelatin",
                tags=("en:ambiguous-a", "en:ambiguous-b"),
                name="gelatin",
                parents=(),
                qualification="unresolved_context",
            ),
        ),
        taxonomy_sha256="ingredient-hash",
    )

    matching = ProductAllergenAnalyzer(StubMatcher(result)).analyze(
        {"ingredients_text_en": "wheat flour, gelatin", "allergens_tags": []}
    )["ingredient_matching"]

    assert matching["tags"] == ["en:gluten"]
    assert matching["evidence"][1]["ambiguous"] is True
    assert matching["evidence"][1]["allergens"] == []
    assert matching["qualifications"][0]["matched_text"] == "gelatin"
    assert "ambiguous_matches_excluded" in matching["limitations"]
