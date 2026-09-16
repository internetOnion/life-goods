import math
from collections import deque
from collections.abc import Callable, Generator
from contextlib import contextmanager
from dataclasses import dataclass
from threading import Lock
from time import monotonic as system_monotonic


class KeyedSlidingWindowLimiter:
    """Thread-safe, cardinality-bounded sliding-window limiter."""

    def __init__(
        self,
        requests_per_minute: int,
        *,
        window_seconds: float = 60.0,
        max_keys: int = 10_000,
        monotonic: Callable[[], float] = system_monotonic,
    ) -> None:
        if requests_per_minute <= 0:
            raise ValueError("The request budget must be greater than zero")
        if window_seconds <= 0:
            raise ValueError("The window duration must be greater than zero")
        if max_keys <= 0:
            raise ValueError("The key limit must be greater than zero")
        self._requests_per_minute = requests_per_minute
        self._window_seconds = window_seconds
        self._max_keys = max_keys
        self._monotonic = monotonic
        self._buckets: dict[str, deque[float]] = {}
        self._overflow_bucket: deque[float] = deque()
        self._lock = Lock()

    def try_acquire(self, key: str) -> tuple[bool, int]:
        """Attempt to acquire a request slot for a given key.

        Returns:
            (True, 0) if allowed.
            (False, retry_after_seconds) if the rate limit is exceeded.
        """
        with self._lock:
            now = self._monotonic()
            cutoff = now - self._window_seconds

            bucket = self._buckets.get(key)
            if bucket is None and len(self._buckets) >= self._max_keys:
                expired_keys = [
                    k for k, b in self._buckets.items() if not b or b[-1] <= cutoff
                ]
                for k in expired_keys:
                    del self._buckets[k]

                if len(self._buckets) >= self._max_keys:
                    bucket = self._overflow_bucket

            if bucket is None:
                bucket = self._buckets.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self._requests_per_minute:
                oldest = bucket[0]
                retry_after = max(1, math.ceil(self._window_seconds - (now - oldest)))
                return False, retry_after

            bucket.append(now)
            return True, 0



class SlidingWindowRequestBudget:
    def __init__(
        self,
        requests_per_minute: int,
        *,
        monotonic: Callable[[], float] = system_monotonic,
    ) -> None:
        if requests_per_minute <= 0:
            raise ValueError("The request budget must be greater than zero")
        self._requests_per_minute = requests_per_minute
        self._monotonic = monotonic
        self._request_times: deque[float] = deque()
        self._lock = Lock()

    def try_acquire(self) -> bool:
        with self._lock:
            now = self._monotonic()
            cutoff = now - 60
            while self._request_times and self._request_times[0] <= cutoff:
                self._request_times.popleft()
            if len(self._request_times) >= self._requests_per_minute:
                return False
            self._request_times.append(now)
            return True


@dataclass(slots=True)
class _LockEntry:
    lock: Lock
    users: int = 0


class ExternalLookupLocks:
    def __init__(self) -> None:
        self._guard = Lock()
        self._entries: dict[str, _LockEntry] = {}

    @contextmanager
    def hold(self, key: str) -> Generator[None]:
        with self._guard:
            entry = self._entries.setdefault(key, _LockEntry(lock=Lock()))
            entry.users += 1
        entry.lock.acquire()
        try:
            yield
        finally:
            entry.lock.release()
            with self._guard:
                entry.users -= 1
                if entry.users == 0:
                    del self._entries[key]
