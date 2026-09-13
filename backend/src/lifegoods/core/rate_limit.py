from __future__ import annotations

import hashlib
import logging
import math
from collections.abc import Callable
from threading import Lock
from time import monotonic as system_monotonic
from typing import Any, cast
from uuid import uuid4

import redis
from redis.exceptions import RedisError, WatchError

from lifegoods.core.concurrency import KeyedSlidingWindowLimiter


class RedisSlidingWindowRateLimiter:
    """Shared sliding-window limiter with a bounded local availability fallback."""

    def __init__(
        self,
        client: redis.Redis,
        requests_per_minute: int,
        *,
        key_prefix: str,
        display_name: str,
        event_prefix: str,
        logger: logging.Logger,
        window_seconds: float = 60.0,
        fallback_seconds: float = 5.0,
        local_max_keys: int = 10_000,
        monotonic: Callable[[], float] = system_monotonic,
        watch_retries: int = 8,
        fallback_on_error: bool = True,
    ) -> None:
        if requests_per_minute <= 0:
            raise ValueError("The request budget must be greater than zero")
        if window_seconds <= 0:
            raise ValueError("The window duration must be greater than zero")
        if fallback_seconds <= 0:
            raise ValueError("The fallback duration must be greater than zero")
        if watch_retries <= 0:
            raise ValueError("The WATCH retry limit must be greater than zero")
        self._client = client
        self._requests_per_minute = requests_per_minute
        self._window_seconds = window_seconds
        self._fallback_seconds = fallback_seconds
        self._monotonic = monotonic
        self._key_prefix = key_prefix
        self._watch_retries = watch_retries
        self._fallback_on_error = fallback_on_error
        self._display_name = display_name
        self._event_prefix = event_prefix
        self._logger = logger
        self._local = KeyedSlidingWindowLimiter(
            requests_per_minute,
            window_seconds=window_seconds,
            max_keys=local_max_keys,
            monotonic=monotonic,
        )
        self._state_lock = Lock()
        self._degraded_until = 0.0
        self._probe_in_progress = False
        self._degraded = False

    def try_acquire(self, key: str) -> tuple[bool, int]:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        if not self._claim_redis_attempt():
            if self._fallback_on_error:
                return self._local.try_acquire(digest)
            return False, max(1, math.ceil(self._window_seconds))

        try:
            result = self._try_redis(digest)
        except (RedisError, TypeError, ValueError):
            self._record_degradation()
            if self._fallback_on_error:
                return self._local.try_acquire(digest)
            return False, max(1, math.ceil(self._window_seconds))

        self._record_recovery()
        return result

    def _claim_redis_attempt(self) -> bool:
        with self._state_lock:
            if not self._degraded:
                return True
            if self._monotonic() < self._degraded_until or self._probe_in_progress:
                return False
            self._probe_in_progress = True
            return True

    def _record_degradation(self) -> None:
        should_log = False
        with self._state_lock:
            if not self._degraded:
                should_log = True
            self._degraded = True
            self._probe_in_progress = False
            self._degraded_until = self._monotonic() + self._fallback_seconds
        if should_log:
            self._logger.warning(
                f"{self._display_name} rate limiter entered local fallback",
                extra={
                    "event": f"{self._event_prefix}_rate_limit_degraded",
                    "dependency": "redis",
                    "failure_category": "dependency_unavailable",
                },
            )

    def _record_recovery(self) -> None:
        should_log = False
        with self._state_lock:
            if self._degraded:
                should_log = True
            self._degraded = False
            self._probe_in_progress = False
            self._degraded_until = 0.0
        if should_log:
            self._logger.info(
                f"{self._display_name} rate limiter recovered shared limiting",
                extra={
                    "event": f"{self._event_prefix}_rate_limit_recovered",
                    "dependency": "redis",
                },
            )

    def _try_redis(self, digest: str) -> tuple[bool, int]:
        redis_key = f"{self._key_prefix}:{digest}"
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
                            math.ceil(
                                self._window_seconds - (now - float(oldest[0][1]))
                            ),
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

        raise RedisError(f"{self._display_name} rate-limit transaction contention")
