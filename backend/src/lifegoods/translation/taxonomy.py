from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_TAXONOMY_FILE = "packaging-taxonomy-km.json"
_TAXONOMY_TAG_PREFIX = re.compile(r"^(?:[a-z]{2,3}:)+", re.IGNORECASE)


def _shared_file() -> Path:
    candidates = (
        Path.cwd() / "shared" / _TAXONOMY_FILE,
        Path(__file__).resolve().parents[3] / "shared" / _TAXONOMY_FILE,
        Path(__file__).resolve().parents[4] / "shared" / _TAXONOMY_FILE,
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise RuntimeError(f"Shared taxonomy file not found: {_TAXONOMY_FILE}")


def _normalize_taxonomy_value(value: str) -> str:
    normalized = _TAXONOMY_TAG_PREFIX.sub("", value)
    return " ".join(normalized.replace("-", " ").replace("_", " ").split()).lower()


def _load_packaging_taxonomy() -> dict[str, str]:
    with _shared_file().open(encoding="utf-8") as handle:
        raw: Any = json.load(handle)
    if not isinstance(raw, dict) or not all(
        isinstance(key, str) and isinstance(value, str) for key, value in raw.items()
    ):
        raise RuntimeError("Shared packaging taxonomy must be a string-to-string JSON object")
    return {_normalize_taxonomy_value(key): value for key, value in raw.items()}


PACKAGING_TAXONOMY_TRANSLATIONS_KM = _load_packaging_taxonomy()


def translate_packaging_taxonomy(value: str) -> str | None:
    return PACKAGING_TAXONOMY_TRANSLATIONS_KM.get(_normalize_taxonomy_value(value))
