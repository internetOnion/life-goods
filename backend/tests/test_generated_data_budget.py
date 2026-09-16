from __future__ import annotations

from redis.exceptions import ConnectionError

from lifegoods.generated_data.budget import (
    InMemoryTranslationBudgetLimiter,
    NullTranslationBudgetLimiter,
    RedisTranslationBudgetLimiter,
)


def test_in_memory_budget_limiter_permits_up_to_limit() -> None:
    clock = [100.0]
    limiter = InMemoryTranslationBudgetLimiter(
        requests_per_minute=2,
        window_seconds=60.0,
        monotonic=lambda: clock[0],
    )

    # 1st call: OK
    acquired, retry_after = limiter.try_acquire()
    assert acquired is True
    assert retry_after == 0

    # 2nd call: OK
    acquired, retry_after = limiter.try_acquire()
    assert acquired is True
    assert retry_after == 0

    # 3rd call: Exceeded
    acquired, retry_after = limiter.try_acquire()
    assert acquired is False
    assert retry_after > 0

    # Advance clock by 61s
    clock[0] = 161.0
    acquired, retry_after = limiter.try_acquire()
    assert acquired is True
    assert retry_after == 0


def test_in_memory_budget_limiter_fails_closed_when_forced() -> None:
    limiter = InMemoryTranslationBudgetLimiter(requests_per_minute=5)
    limiter.set_healthy(False)

    acquired, retry_after = limiter.try_acquire()
    assert acquired is False
    assert retry_after > 0


def test_null_budget_limiter() -> None:
    limiter = NullTranslationBudgetLimiter(allow=True)
    assert limiter.try_acquire() == (True, 0)

    disallowing = NullTranslationBudgetLimiter(allow=False)
    assert disallowing.try_acquire() == (False, 60)


class MockRedisPipeline:
    def __init__(self, parent: MockRedisClient) -> None:
        self.parent = parent
        self.watches: list[str] = []

    def __enter__(self) -> MockRedisPipeline:
        return self

    def __exit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        pass

    def watch(self, key: str) -> None:
        self.watches.append(key)

    def time(self) -> tuple[int, int]:
        return int(self.parent.now), int((self.parent.now % 1) * 1_000_000)

    def zcount(self, key: str, min_val: str, max_val: str) -> int:
        cutoff = float(min_val.lstrip("("))
        return sum(1 for score in self.parent.zsets.get(key, {}).values() if score > cutoff)

    def zrangebyscore(
        self,
        key: str,
        min_val: str,
        max_val: str,
        start: int = 0,
        num: int = 1,
        withscores: bool = True,
    ) -> list[tuple[str, float]]:
        cutoff = float(min_val.lstrip("("))
        items = [(k, v) for k, v in self.parent.zsets.get(key, {}).items() if v > cutoff]
        items.sort(key=lambda x: x[1])
        return items[start : start + num]

    def unwatch(self) -> None:
        self.watches.clear()

    def multi(self) -> None:
        pass

    def zremrangebyscore(self, key: str, min_val: str, max_val: float) -> None:
        if key in self.parent.zsets:
            self.parent.zsets[key] = {
                k: v for k, v in self.parent.zsets[key].items() if v > max_val
            }

    def zadd(self, key: str, mapping: dict[str, float]) -> None:
        if key not in self.parent.zsets:
            self.parent.zsets[key] = {}
        self.parent.zsets[key].update(mapping)

    def expire(self, key: str, seconds: int) -> None:
        pass

    def execute(self) -> list[object]:
        return []


class MockRedisClient:
    def __init__(self) -> None:
        self.zsets: dict[str, dict[str, float]] = {}
        self.now: float = 1000.0
        self.should_raise: bool = False

    def pipeline(self) -> MockRedisPipeline:
        if self.should_raise:
            raise ConnectionError("Cannot reach Redis")
        return MockRedisPipeline(self)


def test_redis_budget_limiter_fails_closed_on_redis_error() -> None:
    mock_redis = MockRedisClient()
    limiter = RedisTranslationBudgetLimiter(
        client=mock_redis,  # type: ignore[arg-type]
        requests_per_minute=2,
    )

    acquired, _ = limiter.try_acquire()
    assert acquired is True

    # When Redis goes down, it MUST fail closed (return False)
    mock_redis.should_raise = True
    acquired, retry_after = limiter.try_acquire()
    assert acquired is False
    assert retry_after > 0
