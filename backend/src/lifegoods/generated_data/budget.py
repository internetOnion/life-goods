from __future__ import annotations

import logging
import math
from collections import deque
from collections.abc import Callable
from threading import Lock
from time import monotonic as system_monotonic
from typing import Any, Protocol, cast
from uuid import uuid4

import redis
from redis.exceptions import RedisError, WatchError

logger = logging.getLogger(__name__)


class TranslationBudgetLimiterProtocol(Protocol):
    def try_acquire(self) -> tuple[bool, int]: ...


class RedisTranslationBudgetLimiter:
    """Project-wide generation budget limiter that fails closed on Redis outage.

    Unlike Shopper-facing rate limiters that fall back open to maintain Product Lookup
    availability, the generation budget limiter protects external provider quotas
    and must fail closed if the shared budget cannot be authoritatively enforced.
    """

    def __init__(
        self,
        client: redis.Redis,
        requests_per_minute: int,
        *,
        window_seconds: float = 60.0,
        fallback_retry_seconds: int = 5,
        key_prefix: str = "translation:budget:v1",
        watch_retries: int = 8,
    ) -> None:
        if requests_per_minute <= 0:
            raise ValueError("The generation budget must be greater than zero")
        if window_seconds <= 0:
            raise ValueError("The window duration must be greater than zero")
        self._client = client
        self._requests_per_minute = requests_per_minute
        self._window_seconds = window_seconds
        self._fallback_retry_seconds = fallback_retry_seconds
        self._key_prefix = key_prefix
        self._watch_retries = watch_retries

    def try_acquire(self) -> tuple[bool, int]:
        redis_key = f"{self._key_prefix}:shared"
        try:
            for _attempt in range(self._watch_retries):
                with self._client.pipeline() as typed_pipeline:
                    pipeline = cast(Any, typed_pipeline)
                    try:
                        pipeline.watch(redis_key)
                        seconds, microseconds = pipeline.time()
                        now = float(seconds) + float(microseconds) / 1_000_000
                        cutoff = now - self._window_seconds
                        active_count = int(pipeline.zcount(redis_key, f"({cutoff}", "+inf"))

                        if active_count >= self._requests_per_minute:
                            oldest = pipeline.zrangebyscore(
                                redis_key,
                                f"({cutoff}",
                                "+inf",
                                start=0,
                                num=1,
                                withscores=True,
                            )
                            pipeline.unwatch()
                            if not oldest:
                                continue
                            retry_after = max(
                                1,
                                math.ceil(self._window_seconds - (now - float(oldest[0][1]))),
                            )
                            return False, retry_after

                        pipeline.multi()
                        pipeline.zremrangebyscore(redis_key, "-inf", cutoff)
                        pipeline.zadd(redis_key, {uuid4().hex: now})
                        pipeline.expire(redis_key, math.ceil(self._window_seconds))
                        pipeline.execute()
                        return True, 0
                    except WatchError:
                        continue

            logger.warning(
                "Translation generation budget contention; failing closed",
                extra={
                    "event": "translation_budget_contention",
                    "dependency": "redis",
                    "failure_category": "contention",
                },
            )
            return False, self._fallback_retry_seconds

        except (RedisError, TypeError, ValueError) as error:
            logger.warning(
                "Translation generation budget limiter entered fail-closed mode",
                extra={
                    "event": "translation_budget_degraded",
                    "dependency": "redis",
                    "failure_category": "dependency_unavailable",
                    "error_category": type(error).__name__,
                },
            )
            return False, self._fallback_retry_seconds


class InMemoryTranslationBudgetLimiter:
    def __init__(
        self,
        requests_per_minute: int,
        *,
        window_seconds: float = 60.0,
        monotonic: Callable[[], float] = system_monotonic,
    ) -> None:
        if requests_per_minute <= 0:
            raise ValueError("The generation budget must be greater than zero")
        self._requests_per_minute = requests_per_minute
        self._window_seconds = window_seconds
        self._monotonic = monotonic
        self._timestamps: deque[float] = deque()
        self._lock = Lock()
        self._is_healthy: bool = True

    def set_healthy(self, healthy: bool) -> None:
        with self._lock:
            self._is_healthy = healthy

    def try_acquire(self) -> tuple[bool, int]:
        with self._lock:
            if not self._is_healthy:
                return False, 5

            now = self._monotonic()
            cutoff = now - self._window_seconds

            while self._timestamps and self._timestamps[0] <= cutoff:
                self._timestamps.popleft()

            if len(self._timestamps) >= self._requests_per_minute:
                oldest = self._timestamps[0]
                retry_after = max(1, math.ceil(self._window_seconds - (now - oldest)))
                return False, retry_after

            self._timestamps.append(now)
            return True, 0


class NullTranslationBudgetLimiter:
    def __init__(self, *, allow: bool = True, retry_after: int = 60) -> None:
        self._allow = allow
        self._retry_after = retry_after

    def try_acquire(self) -> tuple[bool, int]:
        if self._allow:
            return True, 0
        return False, self._retry_after
