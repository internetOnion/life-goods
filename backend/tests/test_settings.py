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

