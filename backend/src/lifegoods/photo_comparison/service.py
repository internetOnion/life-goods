"""Application services and process-local admission controls for photo comparison."""

from __future__ import annotations

import time
from collections import deque
from collections.abc import Callable, Sequence
from threading import BoundedSemaphore, Lock
from typing import Protocol

from lifegoods.photo_comparison.comparison import compare
from lifegoods.photo_comparison.contracts import ComparisonRequest, ComparisonResponse, Extraction
from lifegoods.photo_comparison.gemini import (
    PhotoProviderOutputInvalid,
    PhotoProviderRequest,
    PhotoProviderTimeout,
    PhotoProviderUnavailable,
)
from lifegoods.photo_comparison.images import PreparedImage
from lifegoods.photo_comparison.normalization import (
    CONFIGURATION_VERSION,
    ProviderOutputError,
    build_extraction,
)

EXTRACTION_REQUESTS_PER_MINUTE = 10
MAX_ACTIVE_PROVIDER_REQUESTS = 1


class PhotoExtractionProvider(Protocol):
    @property
    def provider_name(self) -> str: ...

    @property
    def model(self) -> str: ...

    @property
    def configuration_version(self) -> str: ...

    def extract(self, request: PhotoProviderRequest) -> dict[str, object]: ...


class ExtractionServiceError(RuntimeError):
    pass


class MissingCredentialsError(ExtractionServiceError):
    pass


class ExtractionRateLimitError(ExtractionServiceError):
    pass


class ExtractionCapacityError(ExtractionServiceError):
    pass


class ExtractionRateLimiter:
    def __init__(
        self,
        limit: int = EXTRACTION_REQUESTS_PER_MINUTE,
        *,
        period_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = limit
        self._period_seconds = period_seconds
        self._clock = clock
        self._requests: deque[float] = deque()
        self._lock = Lock()

    def allow(self) -> bool:
        now = self._clock()
        with self._lock:
            while self._requests and self._requests[0] <= now - self._period_seconds:
                self._requests.popleft()
            if len(self._requests) >= self._limit:
                return False
            self._requests.append(now)
            return True


class ProviderCapacity:
    def __init__(self, limit: int = MAX_ACTIVE_PROVIDER_REQUESTS) -> None:
        self._semaphore = BoundedSemaphore(limit)

    def acquire(self) -> bool:
        return self._semaphore.acquire(blocking=False)

    def release(self) -> None:
        self._semaphore.release()


class PhotoExtractionService:
    def __init__(
        self,
        provider: PhotoExtractionProvider | None,
        *,
        rate_limiter: ExtractionRateLimiter | None = None,
        capacity: ProviderCapacity | None = None,
    ) -> None:
        self.provider = provider
        self.rate_limiter = rate_limiter or ExtractionRateLimiter()
        self.capacity = capacity or ProviderCapacity()

    def extract(self, product_id: str, images: Sequence[PreparedImage]) -> Extraction:
        if self.provider is None:
            raise MissingCredentialsError(
                "Photo extraction is unavailable because Gemini credentials are missing."
            )
        if not self.rate_limiter.allow():
            raise ExtractionRateLimitError("The local extraction limit is 10 requests per minute.")
        if not self.capacity.acquire():
            raise ExtractionCapacityError(
                "Another extraction is already in progress. Retry when it finishes."
            )
        try:
            try:
                payload = self.provider.extract(PhotoProviderRequest(images=list(images)))
            except PhotoProviderTimeout:
                raise
            except PhotoProviderUnavailable:
                raise
            except PhotoProviderOutputInvalid:
                raise
            except Exception as error:
                raise PhotoProviderUnavailable("The extraction provider failed.") from error
            try:
                return build_extraction(
                    payload,
                    product_id=product_id,
                    images=[image.evidence for image in images],
                    provider=self.provider.provider_name,
                    model=self.provider.model,
                )
            except ProviderOutputError:
                raise
        finally:
            self.capacity.release()


class PhotoComparisonService:
    @staticmethod
    def compare(request: ComparisonRequest) -> ComparisonResponse:
        return compare(request)


__all__ = [
    "CONFIGURATION_VERSION",
    "EXTRACTION_REQUESTS_PER_MINUTE",
    "ExtractionRateLimiter",
    "ExtractionCapacityError",
    "ExtractionRateLimitError",
    "ExtractionServiceError",
    "MissingCredentialsError",
    "PhotoComparisonService",
    "PhotoExtractionService",
    "ProviderCapacity",
]
