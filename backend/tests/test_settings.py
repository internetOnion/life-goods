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
