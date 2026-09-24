from __future__ import annotations

import logging
from collections.abc import Callable
from time import monotonic as system_monotonic
from typing import Protocol

import redis

from lifegoods.core.rate_limit import RedisSlidingWindowRateLimiter

logger = logging.getLogger(__name__)


class IngredientMatchingRateLimiter(Protocol):
    def try_acquire(self, key: str) -> tuple[bool, int]: ...


class RedisIngredientMatchingRateLimiter(RedisSlidingWindowRateLimiter):
    def __init__(
        self,
        client: redis.Redis,
        requests_per_minute: int,
        *,
        window_seconds: float = 60.0,
        fallback_seconds: float = 5.0,
        local_max_keys: int = 10_000,
        monotonic: Callable[[], float] = system_monotonic,
        watch_retries: int = 8,
    ) -> None:
        super().__init__(
            client,
            requests_per_minute,
            key_prefix="ingredient-matching:rate-limit",
            display_name="Ingredient matching",
            event_prefix="ingredient_matching",
            logger=logger,
            window_seconds=window_seconds,
            fallback_seconds=fallback_seconds,
            local_max_keys=local_max_keys,
            monotonic=monotonic,
            watch_retries=watch_retries,
        )


__all__ = ["IngredientMatchingRateLimiter", "RedisIngredientMatchingRateLimiter"]
