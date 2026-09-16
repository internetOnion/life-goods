from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from pymongo import ASCENDING
from pymongo.database import Database

from lifegoods.ingredient_matching.models import (
    INGREDIENT_MATCHING_CONTROL_COLLECTION,
    INGREDIENT_MATCHING_POINTER_ID,
    normalize_ingredient_text,
)

DEFAULT_TAXONOMY_PATH = (
    (
        Path.cwd()
        if (Path.cwd() / "data" / "open_food_facts").is_dir()
        else Path(__file__).resolve().parents[3]
    )
    / "data"
    / "open_food_facts"
    / "taxonomies"
    / "ingredients.full.json"
)
DEFAULT_ALLERGEN_TAXONOMY_PATH = DEFAULT_TAXONOMY_PATH.with_name("allergens.full.json")
DEFAULT_MANIFEST_PATH = DEFAULT_TAXONOMY_PATH.with_name("manifest.json")


def import_ingredient_taxonomy(
    database: Database[dict[str, Any]],
    *,
    taxonomy_path: Path = DEFAULT_TAXONOMY_PATH,
    allergen_taxonomy_path: Path = DEFAULT_ALLERGEN_TAXONOMY_PATH,
    manifest_path: Path = DEFAULT_MANIFEST_PATH,
) -> dict[str, Any]:
    raw = taxonomy_path.read_bytes()
    taxonomy_sha256 = hashlib.sha256(raw).hexdigest()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected = manifest["files"][taxonomy_path.name]
    if expected["sha256"] != taxonomy_sha256:
        raise ValueError("Ingredient taxonomy SHA-256 does not match manifest.json")
    taxonomy = json.loads(raw)
    if not isinstance(taxonomy, dict):
        raise ValueError("Ingredient taxonomy must be a JSON object")
    if expected.get("item_count") != len(taxonomy):
        raise ValueError("Ingredient taxonomy item count does not match manifest.json")

    allergen_raw = allergen_taxonomy_path.read_bytes()
    allergen_taxonomy_sha256 = hashlib.sha256(allergen_raw).hexdigest()
    allergen_expected = manifest["files"][allergen_taxonomy_path.name]
    if allergen_expected["sha256"] != allergen_taxonomy_sha256:
        raise ValueError("Allergen taxonomy SHA-256 does not match manifest.json")
    allergen_taxonomy = json.loads(allergen_raw)
    if not isinstance(allergen_taxonomy, dict):
        raise ValueError("Allergen taxonomy must be a JSON object")
    if allergen_expected.get("item_count") != len(allergen_taxonomy):
        raise ValueError("Allergen taxonomy item count does not match manifest.json")

    allergen_paths = _build_allergen_paths(taxonomy, set(allergen_taxonomy))

    suffix = taxonomy_sha256[:16]
    alias_collection_name = f"ingredient_match_aliases_{suffix}"
    entry_collection_name = f"ingredient_match_entries_{suffix}"
    alias_collection = database[alias_collection_name]
    entry_collection = database[entry_collection_name]
    alias_collection.delete_many({})
    entry_collection.delete_many({})
    aliases: dict[str, set[str]] = {}
    entries: list[dict[str, Any]] = []
    max_alias_words = 1
    for tag, raw_entry in taxonomy.items():
        if not isinstance(tag, str) or not isinstance(raw_entry, dict):
            continue
        raw_name = raw_entry.get("name")
        name_value = raw_name.get("en") if isinstance(raw_name, dict) else None
        name = name_value if isinstance(name_value, str) else None
        parents_value = raw_entry.get("parents", [])
        parents = (
            [item for item in parents_value if isinstance(item, str)]
            if isinstance(parents_value, list)
            else []
        )
        entries.append(
            {
                "_id": tag,
                "name": name,
                "parents": parents,
                "allergen_paths": allergen_paths.get(tag, []),
            }
        )
        values: list[str] = []
        if name is not None:
            values.append(name)
        synonyms = raw_entry.get("synonyms", {})
        if isinstance(synonyms, dict) and isinstance(synonyms.get("en"), list):
            values.extend(item for item in synonyms["en"] if isinstance(item, str))
        for value in values:
            alias = normalize_ingredient_text(value).value
            if not alias:
                continue
            aliases.setdefault(alias, set()).add(tag)
            max_alias_words = max(max_alias_words, len(alias.split()))

    if entries:
        entry_collection.insert_many(entries, ordered=False)
    alias_collection.insert_many(
        [{"_id": alias, "alias": alias, "tags": sorted(tags)} for alias, tags in aliases.items()],
        ordered=False,
    )
    alias_collection.create_index([("alias", ASCENDING)], unique=True, name="uq_ingredient_alias")
    database[INGREDIENT_MATCHING_CONTROL_COLLECTION].replace_one(
        {"_id": INGREDIENT_MATCHING_POINTER_ID},
        {
            "_id": INGREDIENT_MATCHING_POINTER_ID,
            "taxonomy_sha256": taxonomy_sha256,
            "allergen_taxonomy_sha256": allergen_taxonomy_sha256,
            "taxonomy_item_count": len(taxonomy),
            "alias_count": len(aliases),
            "max_alias_words": max_alias_words,
            "alias_collection": alias_collection_name,
            "entry_collection": entry_collection_name,
            "source": "Open Food Facts",
            "source_file": taxonomy_path.name,
        },
        upsert=True,
    )
    return {
        "taxonomy_sha256": taxonomy_sha256,
        "allergen_taxonomy_sha256": allergen_taxonomy_sha256,
        "taxonomy_item_count": len(taxonomy),
        "alias_count": len(aliases),
        "alias_collection": alias_collection_name,
        "entry_collection": entry_collection_name,
    }


def _build_allergen_paths(
    taxonomy: dict[str, Any],
    allergen_tags: set[str],
) -> dict[str, list[list[str]]]:
    resolved: dict[str, dict[str, list[str]]] = {}
    visiting: set[str] = set()

    def resolve(tag: str) -> dict[str, list[str]]:
        if tag in resolved:
            return resolved[tag]
        if tag in visiting:
            raise ValueError(f"Ingredient taxonomy parent cycle includes {tag}")
        raw_entry = taxonomy.get(tag)
        if not isinstance(raw_entry, dict):
            raise ValueError(f"Ingredient taxonomy entry is invalid: {tag}")
        visiting.add(tag)
        paths: dict[str, list[str]] = {}
        raw_allergens = raw_entry.get("allergens", {})
        direct_allergen = raw_allergens.get("en") if isinstance(raw_allergens, dict) else None
        if direct_allergen is not None:
            if not isinstance(direct_allergen, str) or direct_allergen not in allergen_tags:
                raise ValueError(f"Ingredient taxonomy allergen target is invalid: {tag}")
            paths[direct_allergen] = [tag, direct_allergen]
        parents = raw_entry.get("parents", [])
        if parents is not None and not isinstance(parents, list):
            raise ValueError(f"Ingredient taxonomy parents are invalid: {tag}")
        for parent in parents or []:
            if not isinstance(parent, str) or parent not in taxonomy:
                raise ValueError(f"Ingredient taxonomy parent is invalid: {tag}")
            for allergen, path in resolve(parent).items():
                paths.setdefault(allergen, [tag, *path])
        visiting.remove(tag)
        resolved[tag] = paths
        return paths

    return {tag: [path for path in resolve(tag).values()] for tag in taxonomy}
