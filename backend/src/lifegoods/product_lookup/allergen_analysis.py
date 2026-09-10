from __future__ import annotations

import logging
from typing import Any, Protocol

from lifegoods.ingredient_matching.models import (
    MAX_INGREDIENT_TEXT_LENGTH,
    IngredientMatchingUnavailableError,
    IngredientMatchResult,
)

logger = logging.getLogger(__name__)


class IngredientMatcherProtocol(Protocol):
    def match(self, ingredient_text: str) -> IngredientMatchResult: ...


class ProductAllergenAnalyzer:
    def __init__(self, matcher: IngredientMatcherProtocol) -> None:
        self._matcher = matcher

    def analyze(self, source_record: dict[str, Any]) -> dict[str, Any]:
        off = _off_analysis(source_record)
        ingredient_input = _ingredient_input(source_record)
        if ingredient_input is None:
            ingredient_matching = {
                "state": "unavailable",
                "reason": _ingredient_unavailable_reason(source_record),
                "tags": [],
                "evidence": [],
                "limitations": [],
                "unmatched_texts": [],
            }
        elif len(ingredient_input["text"]) > MAX_INGREDIENT_TEXT_LENGTH:
            ingredient_matching = {
                "state": "unavailable",
                "reason": "ingredient_text_too_long",
                "tags": [],
                "evidence": [],
                "limitations": ["ingredient_text_exceeds_matcher_limit"],
                "unmatched_texts": [],
                "input": _input_response(ingredient_input),
            }
        else:
            ingredient_matching = self._match(ingredient_input)

        comparison = _comparison(off, ingredient_matching)
        return {
            "off": off,
            "ingredient_matching": ingredient_matching,
            "comparison": comparison,
        }

    def _match(self, ingredient_input: dict[str, str]) -> dict[str, Any]:
        try:
            result = self._matcher.match(ingredient_input["text"])
        except IngredientMatchingUnavailableError:
            return {
                "state": "unavailable",
                "reason": "matcher_unavailable",
                "tags": [],
                "evidence": [],
                "limitations": [],
                "unmatched_texts": [],
                "input": _input_response(ingredient_input),
            }
        except (TypeError, KeyError, ValueError) as error:
            logger.info(
                "Ingredient matching could not analyze Product text",
                extra={
                    "event": "ingredient_matching_unavailable",
                    "error_category": type(error).__name__,
                },
            )
            return {
                "state": "unavailable",
                "reason": "matcher_input_invalid",
                "tags": [],
                "evidence": [],
                "limitations": [],
                "unmatched_texts": [],
                "input": _input_response(ingredient_input),
            }
        except Exception as error:
            logger.warning(
                "Ingredient matching dependency is unavailable",
                extra={
                    "event": "ingredient_matching_unavailable",
                    "error_category": type(error).__name__,
                },
            )
            return {
                "state": "unavailable",
                "reason": "matcher_unavailable",
                "tags": [],
                "evidence": [],
                "limitations": [],
                "unmatched_texts": [],
                "input": _input_response(ingredient_input),
            }

        derived_tags = sorted(
            {
                path[-1]
                for match in result.matches
                if not match.ambiguous
                for path in match.allergen_paths
                if path
            }
        )
        evidence = [
            {
                "matched_text": match.matched_text,
                "start": match.start,
                "end": match.end,
                "alias": match.alias,
                "ingredient_tags": list(match.tags),
                "name": match.name,
                "parents": list(match.parents),
                "ambiguous": match.ambiguous,
                "allergens": [
                    {"tag": path[-1], "path": list(path)}
                    for path in match.allergen_paths
                    if path
                ],
            }
            for match in result.matches
        ]
        limitations: list[str] = []
        if not result.matches:
            limitations.append("no_taxonomy_matches")
        if any(match.ambiguous for match in result.matches):
            limitations.append("ambiguous_matches_excluded")
        if result.unmatched_texts:
            limitations.append("unmatched_ingredient_text")
        if not derived_tags:
            limitations.append("no_reliable_allergen_relationships")
        return {
            "state": "completed",
            "quality": (
                "ambiguous"
                if any(match.ambiguous for match in result.matches)
                else "insufficient"
                if result.unmatched_texts or not derived_tags
                else "clear"
            ),
            "tags": derived_tags,
            "evidence": evidence,
            "limitations": limitations,
            "unmatched_texts": list(result.unmatched_texts),
            "input": _input_response(ingredient_input),
            "taxonomy_sha256": result.taxonomy_sha256,
            "allergen_taxonomy_sha256": result.allergen_taxonomy_sha256,
        }


def _off_analysis(source_record: dict[str, Any]) -> dict[str, Any]:
    if "allergens_tags" not in source_record:
        return {"state": "missing", "tags": []}
    raw_tags = source_record["allergens_tags"]
    if not isinstance(raw_tags, list):
        return {"state": "invalid", "tags": []}
    tags = [tag for tag in raw_tags if isinstance(tag, str)]
    if len(tags) != len(raw_tags):
        return {"state": "invalid", "tags": tags}
    return {"state": "empty" if not tags else "available", "tags": tags}


def _ingredient_input(source_record: dict[str, Any]) -> dict[str, str] | None:
    english_text = source_record.get("ingredients_text_en")
    if isinstance(english_text, str) and english_text.strip():
        return {
            "source_field": "ingredients_text_en",
            "language": "en",
            "text": english_text,
        }
    generic_text = source_record.get("ingredients_text")
    if (
        isinstance(generic_text, str)
        and generic_text.strip()
        and source_record.get("lang") == "en"
    ):
        return {
            "source_field": "ingredients_text",
            "language": "en",
            "text": generic_text,
        }
    return None


def _ingredient_unavailable_reason(source_record: dict[str, Any]) -> str:
    english_text = source_record.get("ingredients_text_en")
    generic_text = source_record.get("ingredients_text")
    if isinstance(generic_text, str) and generic_text.strip():
        if source_record.get("lang") is None:
            return "ingredient_language_unknown"
        return "ingredient_language_unsupported"
    if english_text is not None and not isinstance(english_text, str):
        return "ingredient_text_invalid"
    return "ingredient_text_unavailable"


def _input_response(ingredient_input: dict[str, str]) -> dict[str, str]:
    return {
        "source_field": ingredient_input["source_field"],
        "language": ingredient_input["language"],
    }


def _comparison(
    off: dict[str, Any], ingredient_matching: dict[str, Any]
) -> dict[str, Any]:
    if off["state"] not in {"available", "empty"}:
        return {
            "state": "unavailable",
            "in_both": [],
            "off_only": [],
            "ingredient_matching_only": [],
            "sets_equal": None,
        }
    if ingredient_matching["state"] != "completed":
        return {
            "state": "unavailable",
            "in_both": [],
            "off_only": [],
            "ingredient_matching_only": [],
            "sets_equal": None,
        }
    off_tags = set(off["tags"])
    ingredient_tags = set(ingredient_matching["tags"])
    return {
        "state": "available",
        "in_both": sorted(off_tags & ingredient_tags),
        "off_only": sorted(off_tags - ingredient_tags),
        "ingredient_matching_only": sorted(ingredient_tags - off_tags),
        "sets_equal": off_tags == ingredient_tags,
    }
