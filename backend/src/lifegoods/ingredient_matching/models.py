from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from pymongo.database import Database

INGREDIENT_MATCHING_CONTROL_COLLECTION = "ingredient_matching_prototype_control"
INGREDIENT_MATCHING_POINTER_ID = "active"
MAX_INGREDIENT_TEXT_LENGTH = 2_000
_WORD_RE = re.compile(r"[\w]+", re.UNICODE)


class IngredientMatchingUnavailableError(Exception):
    """The experimental matcher is disabled or has not been imported."""


@dataclass(frozen=True, slots=True)
class NormalizedIngredientText:
    value: str
    offsets: tuple[tuple[int, int], ...]


@dataclass(frozen=True, slots=True)
class IngredientMatch:
    matched_text: str
    start: int
    end: int
    alias: str
    tags: tuple[str, ...]
    name: str | None
    parents: tuple[str, ...]
    allergen_paths: tuple[tuple[str, ...], ...] = ()

    @property
    def ambiguous(self) -> bool:
        return len(self.tags) != 1


@dataclass(frozen=True, slots=True)
class IngredientMatchResult:
    ingredient_tags: tuple[str, ...]
    matches: tuple[IngredientMatch, ...]
    taxonomy_sha256: str
    allergen_taxonomy_sha256: str | None = None
    unmatched_texts: tuple[str, ...] = ()


def normalize_ingredient_text(value: str) -> NormalizedIngredientText:
    output: list[str] = []
    offsets: list[tuple[int, int]] = []
    pending_space = False
    for index, character in enumerate(value):
        normalized = unicodedata.normalize("NFKC", character).casefold()
        if not normalized:
            continue
        if character.isspace() or all(
            unicodedata.category(item).startswith(("P", "S")) for item in normalized
        ):
            if output:
                pending_space = True
            continue
        if pending_space:
            output.append(" ")
            offsets.append((index, index))
            pending_space = False
        for item in normalized:
            output.append(item)
            offsets.append((index, index + 1))
    while output and output[-1] == " ":
        output.pop()
        offsets.pop()
    return NormalizedIngredientText("".join(output), tuple(offsets))


def _alias_spans(normalized: NormalizedIngredientText) -> list[tuple[str, int, int]]:
    return [
        (match.group(0), match.start(), match.end())
        for match in _WORD_RE.finditer(normalized.value)
    ]


class IngredientMatcher:
    def __init__(
        self, database: Database[dict[str, Any]] | None, *, enabled: bool
    ) -> None:
        self._database = database
        self._enabled = enabled

    def match(self, ingredient_text: str) -> IngredientMatchResult:
        if not self._enabled:
            raise IngredientMatchingUnavailableError("Ingredient matching prototype is disabled")
        if not ingredient_text.strip():
            raise ValueError("ingredient_text must not be blank")
        if self._database is None:
            raise IngredientMatchingUnavailableError("Ingredient taxonomy prototype is unavailable")
        pointer = self._database[INGREDIENT_MATCHING_CONTROL_COLLECTION].find_one(
            {"_id": INGREDIENT_MATCHING_POINTER_ID}
        )
        if not isinstance(pointer, dict):
            raise IngredientMatchingUnavailableError("Ingredient taxonomy prototype is unavailable")
        alias_collection_name = pointer.get("alias_collection")
        entry_collection_name = pointer.get("entry_collection")
        taxonomy_sha256 = pointer.get("taxonomy_sha256")
        allergen_taxonomy_sha256 = pointer.get("allergen_taxonomy_sha256")
        if not isinstance(alias_collection_name, str):
            raise IngredientMatchingUnavailableError(
                "Ingredient taxonomy prototype is unavailable"
            )
        if not isinstance(entry_collection_name, str):
            raise IngredientMatchingUnavailableError(
                "Ingredient taxonomy prototype is unavailable"
            )
        if not isinstance(taxonomy_sha256, str):
            raise IngredientMatchingUnavailableError("Ingredient taxonomy prototype is unavailable")
        if not isinstance(allergen_taxonomy_sha256, str):
            raise IngredientMatchingUnavailableError("Allergen taxonomy prototype is unavailable")
        normalized = normalize_ingredient_text(ingredient_text)
        spans = _alias_spans(normalized)
        if not spans:
            return IngredientMatchResult(
                (), (), taxonomy_sha256, allergen_taxonomy_sha256, ()
            )
        max_words = int(pointer.get("max_alias_words", 1))
        candidates: set[str] = set()
        for start in range(len(spans)):
            for length in range(1, min(max_words, len(spans) - start) + 1):
                candidates.add(
                    " ".join(item[0] for item in spans[start : start + length])
                )
        aliases: dict[str, dict[str, Any]] = {}
        for item in self._database[alias_collection_name].find(
            {"alias": {"$in": sorted(candidates)}},
            {"_id": 0, "alias": 1, "tags": 1},
        ):
            alias = item.get("alias")
            if isinstance(alias, str) and isinstance(item.get("tags"), list):
                aliases[alias] = item

        matches: list[IngredientMatch] = []
        tags: list[str] = []
        unmatched_texts: list[str] = []
        cursor = 0
        while cursor < len(spans):
            selected: tuple[str, int, int, dict[str, Any]] | None = None
            for length in range(min(max_words, len(spans) - cursor), 0, -1):
                alias = " ".join(item[0] for item in spans[cursor : cursor + length])
                item = aliases.get(alias)
                if item is not None:
                    selected = (alias, spans[cursor][1], spans[cursor + length - 1][2], item)
                    break
            if selected is None:
                original_start = normalized.offsets[cursor][0]
                original_end = normalized.offsets[cursor][1]
                unmatched_texts.append(ingredient_text[original_start:original_end])
                cursor += 1
                continue
            alias, normalized_start, normalized_end, item = selected
            original_start = normalized.offsets[normalized_start][0]
            original_end = normalized.offsets[normalized_end - 1][1]
            matched_tags = tuple(
                sorted({tag for tag in item["tags"] if isinstance(tag, str)})
            )
            if not matched_tags:
                cursor += 1
                continue
            matches.append(
                IngredientMatch(
                    matched_text=ingredient_text[original_start:original_end],
                    start=original_start,
                    end=original_end,
                    alias=alias,
                    tags=matched_tags,
                    name=None,
                    parents=(),
                )
            )
            if len(matched_tags) == 1:
                tags.append(matched_tags[0])
            cursor += len(alias.split())

        detail_ids = sorted({tag for match in matches for tag in match.tags})
        details_by_tag: dict[str, dict[str, Any]] = {}
        if detail_ids:
            for details in self._database[entry_collection_name].find(
                {"_id": {"$in": detail_ids}},
                {"_id": 1, "name": 1, "parents": 1, "allergen_paths": 1},
            ):
                tag = details.get("_id")
                if isinstance(tag, str):
                    details_by_tag[tag] = details

        enriched_matches: list[IngredientMatch] = []
        for match in matches:
            details = details_by_tag.get(match.tags[0])
            name = details.get("name") if isinstance(details, dict) else None
            parents_value = details.get("parents", []) if isinstance(details, dict) else []
            parents = tuple(value for value in parents_value if isinstance(value, str))
            paths_value = details.get("allergen_paths", []) if isinstance(details, dict) else []
            allergen_paths = tuple(
                tuple(value for value in path if isinstance(value, str))
                for path in paths_value
                if isinstance(path, list) and all(isinstance(value, str) for value in path)
            )
            enriched_matches.append(
                IngredientMatch(
                    matched_text=match.matched_text,
                    start=match.start,
                    end=match.end,
                    alias=match.alias,
                    tags=match.tags,
                    name=name if isinstance(name, str) else None,
                    parents=parents,
                    allergen_paths=allergen_paths if len(match.tags) == 1 else (),
                )
            )
        return IngredientMatchResult(
            tuple(dict.fromkeys(tags)),
            tuple(enriched_matches),
            taxonomy_sha256,
            allergen_taxonomy_sha256,
            tuple(dict.fromkeys(unmatched_texts)),
        )
