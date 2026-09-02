from __future__ import annotations

import unicodedata
from dataclasses import dataclass

import regex

_GRAPHEME_PATTERN = regex.compile(r"\X")
_WORD_CHARACTER_PATTERN = regex.compile(r"[\p{L}\p{M}\p{N}]")


@dataclass(frozen=True, slots=True)
class NormalizedText:
    text: str
    source_spans: tuple[tuple[int, int], ...]

    def source_span(self, start: int, end: int) -> tuple[int, int]:
        contributing = self.source_spans[start:end]
        if not contributing:
            raise ValueError("A normalized match must contain at least one character")
        return min(span[0] for span in contributing), max(span[1] for span in contributing)


def _is_separator(character: str) -> bool:
    return character.isspace() or unicodedata.category(character).startswith("P")


def is_word_character(character: str) -> bool:
    return bool(_WORD_CHARACTER_PATTERN.fullmatch(character))


def has_word_boundaries(text: str, start: int, end: int) -> bool:
    return (start == 0 or not is_word_character(text[start - 1])) and (
        end == len(text) or not is_word_character(text[end])
    )


def normalize_english_text(source_text: str) -> NormalizedText:
    normalized_characters: list[str] = []
    source_spans: list[tuple[int, int]] = []

    for grapheme_match in _GRAPHEME_PATTERN.finditer(source_text):
        source_span = grapheme_match.span()
        normalized_grapheme = unicodedata.normalize("NFKC", grapheme_match.group()).casefold()
        for character in normalized_grapheme:
            if _is_separator(character):
                if normalized_characters and normalized_characters[-1] == " ":
                    previous_start, _ = source_spans[-1]
                    source_spans[-1] = (previous_start, source_span[1])
                    continue
                character = " "
            normalized_characters.append(character)
            source_spans.append(source_span)

    return NormalizedText("".join(normalized_characters), tuple(source_spans))


def normalized_phrase(source_text: str) -> str:
    return normalize_english_text(source_text).text.strip()


def find_normalized_phrase(text: str, phrase: str) -> tuple[tuple[int, int], ...]:
    if not phrase:
        return ()
    matches: list[tuple[int, int]] = []
    search_from = 0
    while (start := text.find(phrase, search_from)) >= 0:
        end = start + len(phrase)
        if has_word_boundaries(text, start, end):
            matches.append((start, end))
        search_from = start + 1
    return tuple(matches)
