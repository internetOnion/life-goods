from __future__ import annotations

import pytest

from lifegoods.core.settings import Settings


def settings_from_environment() -> Settings:
    return Settings(_env_file=None)  # pyright: ignore[reportCallIssue]


def test_product_lookup_settings_use_product_specific_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LIFEGOODS_PRODUCT_LOOKUP_CACHE_ENABLED", "false")
    monkeypatch.setenv("LIFEGOODS_PRODUCT_LOOKUP_CACHE_TTL_SECONDS", "123")
    monkeypatch.setenv("LIFEGOODS_PRODUCT_LOOKUP_REQUESTS_PER_MINUTE", "17")

    settings = settings_from_environment()

    assert settings.product_lookup_cache_enabled is False
    assert settings.product_lookup_cache_ttl_seconds == 123
    assert settings.product_lookup_requests_per_minute == 17


def test_generated_mongodb_settings_defaults() -> None:
    settings = settings_from_environment()

    assert (
        settings.generated_mongodb_uri
        == "mongodb://lifegoods_generated:lifegoods_generated@localhost:27018/lifegoods_generated"
    )
    assert settings.generated_mongodb_database == "lifegoods_generated"
    assert settings.generated_mongodb_timeout_ms == 2_000


def test_generated_mongodb_settings_environment_overrides(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "LIFEGOODS_GENERATED_MONGODB_URI",
        "mongodb://custom_user:custom_pass@mongo.internal:27017/custom_gen_db",
    )
    monkeypatch.setenv("LIFEGOODS_GENERATED_MONGODB_DATABASE", "custom_gen_db")
    monkeypatch.setenv("LIFEGOODS_GENERATED_MONGODB_TIMEOUT_MS", "4500")

    settings = settings_from_environment()

    assert (
        settings.generated_mongodb_uri
        == "mongodb://custom_user:custom_pass@mongo.internal:27017/custom_gen_db"
    )
    assert settings.generated_mongodb_database == "custom_gen_db"
    assert settings.generated_mongodb_timeout_ms == 4500
    # OFF settings remain unaffected
    assert settings.off_mongodb_database == "lifegoods_off"


def test_gemini_api_key_settings_from_lifegoods_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LIFEGOODS_GEMINI_API_KEY", "test-key-prefixed")
    settings = settings_from_environment()
    assert settings.gemini_api_key == "test-key-prefixed"


def test_gemini_api_key_settings_from_standard_gemini_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-standard")
    settings = settings_from_environment()
    assert settings.gemini_api_key == "test-key-standard"


def test_gemini_api_key_is_redacted_from_settings_representation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "secret-value-that-must-not-render")

    assert "secret-value-that-must-not-render" not in repr(settings_from_environment())


def test_gemini_translation_timeout_defaults_to_twelve_seconds() -> None:
    settings = settings_from_environment()
    assert settings.gemini_translation_timeout_seconds == 12.0


def test_gemini_translation_timeout_can_be_overridden(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LIFEGOODS_GEMINI_TRANSLATION_TIMEOUT_SECONDS", "18.5")
    settings = settings_from_environment()
    assert settings.gemini_translation_timeout_seconds == 18.5


def test_translation_stage_deadline_defaults_and_environment_override(monkeypatch) -> None:
    monkeypatch.delenv("LIFEGOODS_TRANSLATION_DEADLINE_SECONDS", raising=False)
    assert settings_from_environment().translation_deadline_seconds == 12
    monkeypatch.setenv("LIFEGOODS_TRANSLATION_DEADLINE_SECONDS", "2.5")
    assert settings_from_environment().translation_deadline_seconds == 2.5


@pytest.mark.parametrize("value", ["0", "-1", "nan", "inf", "-inf", "invalid"])
def test_translation_stage_deadline_rejects_invalid_values(monkeypatch, value) -> None:
    from pydantic import ValidationError

    monkeypatch.setenv("LIFEGOODS_TRANSLATION_DEADLINE_SECONDS", value)
    with pytest.raises(ValidationError):
        settings_from_environment()


def test_production_settings_need_no_relational_database() -> None:
    settings = Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue]
        environment="production",
        off_mongodb_uri="mongodb://reader:secret@mongo/off",
        generated_mongodb_uri="mongodb://generated:secret@mongo/generated",
        redis_url="redis://:secret@redis:6379/0",
    )
    assert not hasattr(settings, "database_url")


@pytest.mark.parametrize(
    "field,value",
    [
        ("off_mongodb_uri", "mongodb://lifegoods_reader:lifegoods_reader@mongo/off"),
        ("generated_mongodb_uri", "mongodb://lifegoods_generated:lifegoods_generated@mongo/generated"),
        ("redis_url", "redis://localhost:6380/0"),
    ],
)
def test_production_rejects_development_datastore_settings(field, value) -> None:
    values = {
        "environment": "production",
        "off_mongodb_uri": "mongodb://reader:secret@mongo/off",
        "generated_mongodb_uri": "mongodb://generated:secret@mongo/generated",
        "redis_url": "redis://:secret@redis:6379/0",
        field: value,
    }
    with pytest.raises(ValueError):
        Settings(_env_file=None, **values)  # pyright: ignore[reportCallIssue]
