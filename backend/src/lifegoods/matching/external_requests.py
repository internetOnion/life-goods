from collections import deque
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from threading import Lock
from time import monotonic as system_monotonic


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
    def hold(self, key: str) -> Iterator[None]:
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
