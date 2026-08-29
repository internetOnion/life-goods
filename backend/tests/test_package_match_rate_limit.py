import logging
from concurrent.futures import ThreadPoolExecutor
from time import sleep

import fakeredis
import pytest

from lifegoods.package_matches.rate_limit import RedisPackageMatchRateLimiter


def _clients() -> tuple[fakeredis.FakeServer, fakeredis.FakeRedis, fakeredis.FakeRedis]:
    server = fakeredis.FakeServer()
    return (
        server,
        fakeredis.FakeRedis(server=server, decode_responses=True),
        fakeredis.FakeRedis(server=server, decode_responses=True),
    )


def test_redis_limiters_share_budget_and_store_only_address_digest() -> None:
    _server, first_client, second_client = _clients()
    first = RedisPackageMatchRateLimiter(first_client, 2)
    second = RedisPackageMatchRateLimiter(second_client, 2)

    assert first.try_acquire("203.0.113.10") == (True, 0)
    assert second.try_acquire("203.0.113.10") == (True, 0)
    allowed, retry_after = first.try_acquire("203.0.113.10")

    assert allowed is False
    assert retry_after == 60
    keys = [str(key) for key in first_client.scan_iter()]
    assert len(keys) == 1
    assert "203.0.113.10" not in keys[0]
    assert first_client.ttl(keys[0]) in {59, 60}


def test_redis_limiter_releases_budget_after_window_expires() -> None:
    _server, client, _other_client = _clients()
    limiter = RedisPackageMatchRateLimiter(client, 1, window_seconds=1.0)

    assert limiter.try_acquire("client") == (True, 0)
    assert limiter.try_acquire("client") == (False, 1)
    sleep(1.05)
    assert limiter.try_acquire("client") == (True, 0)


def test_redis_limiter_watch_transactions_preserve_atomic_budget() -> None:
    _server, first_client, second_client = _clients()
    limiters = (
        RedisPackageMatchRateLimiter(first_client, 5),
        RedisPackageMatchRateLimiter(second_client, 5),
    )

    def acquire(index: int) -> bool:
        return limiters[index % 2].try_acquire("shared-client")[0]

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(acquire, range(20)))

    assert sum(results) == 5


def test_redis_outage_uses_local_fallback_and_logs_transitions_only(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server, client, _other_client = _clients()
    clock = 100.0
    limiter = RedisPackageMatchRateLimiter(
        client,
        2,
        fallback_seconds=5.0,
        local_max_keys=1,
        monotonic=lambda: clock,
    )
    server.connected = False
    rate_limit_logger = logging.getLogger("lifegoods.package_matches.rate_limit")
    monkeypatch.setattr(rate_limit_logger, "disabled", False)

    with caplog.at_level("INFO", logger=rate_limit_logger.name):
        assert limiter.try_acquire("client-1") == (True, 0)
        assert limiter.try_acquire("client-1") == (True, 0)
        assert limiter.try_acquire("client-2") == (True, 0)
        assert limiter.try_acquire("client-3") == (True, 0)
        assert len(limiter._local._buckets) == 1
        assert [record.__dict__["event"] for record in caplog.records] == [
            "package_match_rate_limit_degraded"
        ]

        server.connected = True
        clock = 104.9
        assert limiter.try_acquire("client-4") == (False, 56)
        clock = 105.0
        assert limiter.try_acquire("client-4") == (True, 0)

    assert [record.__dict__["event"] for record in caplog.records] == [
        "package_match_rate_limit_degraded",
        "package_match_rate_limit_recovered",
    ]
