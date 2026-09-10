import mongomock
import mongomock.collection
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from lifegoods.ingredient_matching.importer import import_ingredient_taxonomy
from lifegoods.ingredient_matching.models import (
    IngredientMatcher,
    IngredientMatchingUnavailableError,
)
from lifegoods.ingredient_matching.router import get_ingredient_matcher, router


def _matcher() -> IngredientMatcher:
    database = mongomock.MongoClient().lifegoods_off
    import_ingredient_taxonomy(database)
    return IngredientMatcher(database, enabled=True)


def test_importer_does_not_create_a_custom_unique_id_index(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original_create_index = mongomock.collection.Collection.create_index

    def reject_custom_id_index(
        collection: mongomock.collection.Collection,
        keys: object,
        *args: object,
        **kwargs: object,
    ) -> str:
        if keys == [("_id", 1)] and kwargs.get("unique") is True:
            raise AssertionError("MongoDB rejects custom unique indexes on _id")
        return original_create_index(collection, keys, *args, **kwargs)

    monkeypatch.setattr(
        mongomock.collection.Collection,
        "create_index",
        reject_custom_id_index,
    )

    database = mongomock.MongoClient().lifegoods_off
    result = import_ingredient_taxonomy(database)

    assert result["taxonomy_item_count"] == 6455


def test_importer_verifies_snapshot_and_matches_normalized_english_aliases() -> None:
    matcher = _matcher()

    result = matcher.match("wheat flour, sugar, SOY-LECITHIN, milk powder")

    assert result.ingredient_tags == (
        "en:wheat-flour",
        "en:sugar",
        "en:soya-lecithin",
        "en:milk-powder",
    )
    assert [match.matched_text for match in result.matches] == [
        "wheat flour",
        "sugar",
        "SOY-LECITHIN",
        "milk powder",
    ]
    assert result.taxonomy_sha256 == (
        "b635e3a211eb2f07de2e113f7487a882cd1777efe86deea5a9197aa9a61a45df"
    )
    assert result.allergen_taxonomy_sha256 == (
        "05905753380d4cf03a6c3297457afce8b979b8a60aa1ccde87f120b3849ef8c2"
    )


def test_matching_exposes_explicit_allergen_relationship_paths() -> None:
    matcher = _matcher()

    result = matcher.match("wheat flour, peanuts, milk powder")

    paths = {
        match.matched_text: match.allergen_paths
        for match in result.matches
    }
    assert paths["wheat flour"] == (("en:wheat-flour", "en:wheat", "en:gluten"),)
    assert paths["peanuts"] == (("en:peanut", "en:peanuts"),)
    assert paths["milk powder"] == (("en:milk-powder", "en:dairy", "en:milk"),)


def test_matcher_uses_longest_phrase_and_respects_word_boundaries() -> None:
    matcher = _matcher()

    result = matcher.match("milky flavor, milk powder")

    assert [match.matched_text for match in result.matches] == ["flavor", "milk powder"]
    assert "en:milk" not in result.ingredient_tags
    assert result.ingredient_tags[-1] == "en:milk-powder"


def test_matching_route_returns_source_attribution_and_stable_errors() -> None:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_ingredient_matcher] = _matcher

    with TestClient(app) as client:
        response = client.post(
            "/api/experimental/ingredient-matches",
            json={"ingredient_text": "milk powder"},
        )
        blank = client.post(
            "/api/experimental/ingredient-matches",
            json={"ingredient_text": ""},
        )

    assert response.status_code == 200
    assert response.json()["data"]["ingredient_tags"] == ["en:milk-powder"]
    assert response.json()["source"]["name"] == "Open Food Facts"
    assert blank.status_code == 422


def test_disabled_or_missing_prototype_is_unavailable() -> None:
    database = mongomock.MongoClient().lifegoods_off
    matcher = IngredientMatcher(database, enabled=False)

    with pytest.raises(IngredientMatchingUnavailableError):
        matcher.match("milk")
