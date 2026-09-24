"""Deterministic allergen mentions for a Label Reading (ADR 0005, SPEC section 29.3).

The existing ingredient matcher runs on English Printed Text only. It reports what
was found in the text that was read; it never establishes that an allergen is absent.
No provider call is involved, so the photo admission budget is not spent.
"""

from __future__ import annotations

from typing import Any

from lifegoods.ingredient_matching.models import MAX_INGREDIENT_TEXT_LENGTH
from lifegoods.label_reading.contracts import (
    AllergenMentionsState,
    LabelAllergenMention,
    LabelAllergenMentions,
    LabelReading,
    PrintedTextBlock,
)
from lifegoods.photo_comparison.contracts import FieldState
from lifegoods.product_lookup.allergen_analysis import (
    IngredientMatcherProtocol,
    match_ingredient_text,
)

MAX_MENTIONS = 128


def _is_english(language: str) -> bool:
    primary = language.strip().casefold().replace("_", "-").split("-", 1)[0]
    return primary == "en"


def _mentions_for(block: PrintedTextBlock, evidence: list[dict[str, Any]]) -> list[
    LabelAllergenMention
]:
    mentions: list[LabelAllergenMention] = []
    for item in evidence:
        if item.get("ambiguous"):
            continue
        tags = sorted({allergen["tag"] for allergen in item.get("allergens", [])})
        if not tags:
            continue
        mentions.append(
            LabelAllergenMention(
                block_id=block.block_id,
                matched_text=str(item["matched_text"])[:256],
                allergen_tags=tags[:16],
                qualification=item["qualification"],
            )
        )
    return mentions


def analyze_label_allergens(
    reading: LabelReading, matcher: IngredientMatcherProtocol | None
) -> LabelAllergenMentions:
    blocks = [
        block
        for block in (*reading.ingredients, *reading.allergen_statements)
        if block.state is FieldState.READABLE and block.original_script
    ]
    limitations: list[str] = []
    eligible: list[PrintedTextBlock] = []
    for block in blocks:
        if not _is_english(block.language):
            if "non_english_text_not_checked" not in limitations:
                limitations.append("non_english_text_not_checked")
        elif len(block.original_script or "") > MAX_INGREDIENT_TEXT_LENGTH:
            if "text_exceeds_matcher_limit" not in limitations:
                limitations.append("text_exceeds_matcher_limit")
        else:
            eligible.append(block)

    if not eligible:
        return LabelAllergenMentions(
            state=AllergenMentionsState.NOT_CHECKED,
            reason="no_english_printed_text" if blocks else "no_readable_printed_text",
            limitations=limitations,
        )
    if matcher is None:
        return LabelAllergenMentions(
            state=AllergenMentionsState.UNAVAILABLE,
            reason="matcher_unavailable",
            limitations=limitations,
        )

    mentions: list[LabelAllergenMention] = []
    for block in eligible:
        result = match_ingredient_text(matcher, block.original_script or "")
        if result["state"] != "completed":
            return LabelAllergenMentions(
                state=AllergenMentionsState.UNAVAILABLE,
                reason=str(result.get("reason") or "matcher_unavailable"),
                limitations=limitations,
            )
        mentions.extend(_mentions_for(block, result["evidence"]))
        for limitation in result["limitations"]:
            if limitation not in limitations:
                limitations.append(limitation)

    if len(mentions) > MAX_MENTIONS:
        mentions = mentions[:MAX_MENTIONS]
        limitations.insert(0, "mentions_truncated")
    return LabelAllergenMentions(
        state=AllergenMentionsState.COMPLETED,
        mentions=mentions,
        limitations=limitations[:8],
    )


__all__ = ["analyze_label_allergens"]
