from concurrent.futures import ThreadPoolExecutor

import pytest

from lifegoods.core.concurrency import KeyedSlidingWindowLimiter


def test_keyed_sliding_window_limiter_rejects_invalid_parameters() -> None:
    with pytest.raises(ValueError, match="request budget must be greater than zero"):
        KeyedSlidingWindowLimiter(0)

    with pytest.raises(ValueError, match="request budget must be greater than zero"):
        KeyedSlidingWindowLimiter(-5)

    with pytest.raises(ValueError, match="window duration must be greater than zero"):
        KeyedSlidingWindowLimiter(10, window_seconds=0)

    with pytest.raises(ValueError, match="window duration must be greater than zero"):
        KeyedSlidingWindowLimiter(10, window_seconds=-10)

    with pytest.raises(ValueError, match="key limit must be greater than zero"):
        KeyedSlidingWindowLimiter(10, max_keys=0)


def test_keyed_sliding_window_limiter_allows_requests_up_to_budget() -> None:
    clock = 100.0

    limiter = KeyedSlidingWindowLimiter(2, monotonic=lambda: clock)

    allowed1, retry_after1 = limiter.try_acquire("192.168.1.1")
    assert allowed1 is True
    assert retry_after1 == 0

    allowed2, retry_after2 = limiter.try_acquire("192.168.1.1")
    assert allowed2 is True
    assert retry_after2 == 0

    allowed3, retry_after3 = limiter.try_acquire("192.168.1.1")
    assert allowed3 is False
    assert retry_after3 == 60


def test_keyed_sliding_window_limiter_calculates_accurate_retry_after() -> None:
    clock = 100.0

    limiter = KeyedSlidingWindowLimiter(2, monotonic=lambda: clock)

    # First request at t=100.0
    limiter.try_acquire("client-a")

    # Second request at t=120.0
    clock = 120.0
    limiter.try_acquire("client-a")

    # Exceed at t=130.0 (oldest was at 100.0, will expire at 160.0 -> 30s remaining)
    clock = 130.0
    allowed, retry_after = limiter.try_acquire("client-a")
    assert allowed is False
    assert retry_after == 30


def test_keyed_sliding_window_limiter_allows_requests_after_window_elapses() -> None:
    clock = 100.0

    limiter = KeyedSlidingWindowLimiter(1, monotonic=lambda: clock)

    allowed, _ = limiter.try_acquire("client-b")
    assert allowed is True

    allowed, retry_after = limiter.try_acquire("client-b")
    assert allowed is False
    assert retry_after == 60

    # Advance clock beyond 60s window
    clock = 160.1
    allowed, retry_after = limiter.try_acquire("client-b")
    assert allowed is True
    assert retry_after == 0


def test_keyed_sliding_window_limiter_isolates_different_keys() -> None:
    clock = 100.0

    limiter = KeyedSlidingWindowLimiter(1, monotonic=lambda: clock)

    allowed_ip1, _ = limiter.try_acquire("1.1.1.1")
    assert allowed_ip1 is True

    # ip1 is now rate limited
    blocked_ip1, _ = limiter.try_acquire("1.1.1.1")
    assert blocked_ip1 is False

    # ip2 is not affected
    allowed_ip2, _ = limiter.try_acquire("2.2.2.2")
    assert allowed_ip2 is True


def test_keyed_sliding_window_limiter_prunes_stale_buckets() -> None:
    clock = 100.0

    limiter = KeyedSlidingWindowLimiter(1, max_keys=1000, monotonic=lambda: clock)

    for i in range(1005):
        limiter.try_acquire(f"client-{i}")

    assert len(limiter._buckets) == 1000

    # Advance clock past window
    clock = 200.0

    # Next acquire triggers cleanup of expired buckets
    limiter.try_acquire("new-client")
    assert len(limiter._buckets) == 1


def test_keyed_sliding_window_limiter_routes_excess_keys_to_overflow_bucket() -> None:
    limiter = KeyedSlidingWindowLimiter(1, max_keys=2, monotonic=lambda: 100.0)

    assert limiter.try_acquire("client-1") == (True, 0)
    assert limiter.try_acquire("client-2") == (True, 0)
    assert limiter.try_acquire("client-3") == (True, 0)
    assert limiter.try_acquire("client-4") == (False, 60)
    assert len(limiter._buckets) == 2


def test_keyed_sliding_window_limiter_is_thread_safe() -> None:
    limiter = KeyedSlidingWindowLimiter(50)

    def worker(key: str) -> bool:
        allowed, _ = limiter.try_acquire(key)
        return allowed

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(worker, ["shared-key"] * 100))

    allowed_count = sum(1 for r in results if r)
    assert allowed_count == 50
