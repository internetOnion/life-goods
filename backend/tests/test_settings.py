from __future__ import annotations

import pytest

from lifegoods.core.settings import Settings


def settings_from_environment() -> Settings:
    return Settings(_env_file=None)  # pyright: ignore[reportCallIssue]


def test_canonical_halal_settings_are_used(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LIFEGOODS_HALAL_INGREDIENT_ASSESSMENTS_ENABLED", "true")
    monkeypatch.setenv(
        "LIFEGOODS_HALAL_INGREDIENT_ASSESSMENT_ENGINE_VERSION", "0.2.0"
    )

    settings = settings_from_environment()

    assert settings.halal_ingredient_assessments_enabled is True
    assert settings.halal_ingredient_assessment_engine_version == "0.2.0"


def test_legacy_halal_settings_remain_compatible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LIFEGOODS_HALAL_ASSESSMENTS_ENABLED", "true")
    monkeypatch.setenv("LIFEGOODS_HALAL_ASSESSMENT_ENGINE_VERSION", "legacy-1")

    settings = settings_from_environment()

    assert settings.halal_ingredient_assessments_enabled is True
    assert settings.halal_ingredient_assessment_engine_version == "legacy-1"


def test_canonical_halal_settings_take_precedence_over_legacy_aliases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LIFEGOODS_HALAL_INGREDIENT_ASSESSMENTS_ENABLED", "false")
    monkeypatch.setenv("LIFEGOODS_HALAL_ASSESSMENTS_ENABLED", "true")
    monkeypatch.setenv(
        "LIFEGOODS_HALAL_INGREDIENT_ASSESSMENT_ENGINE_VERSION", "canonical-2"
    )
    monkeypatch.setenv("LIFEGOODS_HALAL_ASSESSMENT_ENGINE_VERSION", "legacy-1")

    settings = settings_from_environment()

    assert settings.halal_ingredient_assessments_enabled is False
    assert settings.halal_ingredient_assessment_engine_version == "canonical-2"
