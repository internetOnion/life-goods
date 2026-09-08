"""One request-local budget, including waits on synchronous dependency I/O."""

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from math import isfinite
from threading import BoundedSemaphore, local
from time import monotonic

import pymongo

DEFAULT_TRANSLATION_DEADLINE_SECONDS = 12.0

# No unbounded work queue. Only individual dependency operations run here, never
# generation workflows or follow-up persistence. Timed-out I/O may finish in its
# driver, but its result is discarded and cannot advance the request pipeline.
_worker = local()
_IO_WORKERS = 16
_io_slots = BoundedSemaphore(_IO_WORKERS)
_io_executor = ThreadPoolExecutor(max_workers=_IO_WORKERS, thread_name_prefix="translation-io")


class TranslationDeadlineExceeded(TimeoutError):
    pass


class TranslationIOBusy(RuntimeError):
    pass


class TranslationDeadline:
    def __init__(
        self,
        seconds: float = DEFAULT_TRANSLATION_DEADLINE_SECONDS,
        *,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        if not isfinite(seconds) or seconds <= 0:
            raise ValueError("Translation deadline must be finite and positive (seconds)")
        self._clock = clock
        self._expires_at = clock() + seconds

    def remaining(self) -> float:
        remaining = self._expires_at - self._clock()
        if remaining <= 0:
            raise TranslationDeadlineExceeded("Translation deadline exceeded")
        return remaining

    def run[T](self, operation: Callable[[], T]) -> T:
        """Bound caller waiting even when a transport has per-read timeouts.

        MongoDB also receives its native cumulative client-side operation timeout.
        No operation is submitted after expiry; a queued operation checks again
        before starting. A late provider response never reaches validation/storage.
        """
        self.remaining()
        if getattr(_worker, "deadline", None) is self:
            result = operation()
            self.remaining()
            return result
        if not _io_slots.acquire(blocking=False):
            raise TranslationIOBusy("Translation I/O capacity exhausted")

        def execute() -> T:
            _worker.deadline = self
            try:
                with pymongo.timeout(self.remaining()):
                    return operation()
            finally:
                _worker.deadline = None

        try:
            future = _io_executor.submit(execute)
        except BaseException:
            _io_slots.release()
            raise
        future.add_done_callback(lambda _: _io_slots.release())
        try:
            result = future.result(timeout=self.remaining())
        except TimeoutError as error:
            future.cancel()
            raise TranslationDeadlineExceeded("Translation dependency timed out") from error
        self.remaining()
        return result

    def sleep(self, seconds: float, sleep_func: Callable[[float], None]) -> None:
        sleep_func(min(seconds, self.remaining()))
        self.remaining()
