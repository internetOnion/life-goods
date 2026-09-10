"""Normalization and indexing-field extraction helpers for OFF dataset."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

_TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)


def normalize_search_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold().strip()
    return " ".join(_TOKEN_RE.findall(value))


def tokens(value: str) -> tuple[str, ...]:
    return tuple(_TOKEN_RE.findall(normalize_search_text(value)))


def country_value(value: str) -> str | None:
    cleaned = normalize_search_text(value)
    if not cleaned:
        return None
    if len(cleaned) > 3 and cleaned[2] == " " and cleaned[:2].isalpha():
        cleaned = cleaned[3:]
    return cleaned.replace("-", " ").strip() or None


def country_values(product: dict[str, Any]) -> list[str]:
    values: list[str] = []
    tags = product.get("manufacturing_places_tags")
    if isinstance(tags, list):
        for tag in tags:
            if isinstance(tag, str):
                value = country_value(tag)
                if value and value not in values:
                    values.append(value)
    places = product.get("manufacturing_places")
    if isinstance(places, str):
        for place in places.split(","):
            value = country_value(place)
            if value and value not in values:
                values.append(value)
    return values


def country_display_values(product: dict[str, Any]) -> list[str]:
    values: list[str] = []
    places = product.get("manufacturing_places")
    if isinstance(places, str):
        for place in places.split(","):
            display = place.strip()
            if display and display not in values:
                values.append(display)
    if values:
        return values
    tags = product.get("manufacturing_places_tags")
    if isinstance(tags, list):
        for tag in tags:
            if isinstance(tag, str):
                display = country_value(tag)
                if display and display not in values:
                    values.append(display)
    return values


def text_values(product: dict[str, Any], prefix: str) -> list[str]:
    values: list[str] = []
    for field, raw in product.items():
        if (
            (field == prefix or field.startswith(f"{prefix}_"))
            and isinstance(raw, str)
            and raw.strip()
        ):
            normalized = normalize_search_text(raw)
            if normalized and normalized not in values:
                values.append(normalized)
    return values


def brand_values(product: dict[str, Any]) -> list[str]:
    raw = product.get("brands")
    if not isinstance(raw, str):
        return []
    return [value for value in (normalize_search_text(item) for item in raw.split(",")) if value]
