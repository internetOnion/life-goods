"""Application services and admission controls for photo comparison."""

from __future__ import annotations

import math
import time
from collections import deque
from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager
from threading import BoundedSemaphore, Lock
from typing import Protocol
from uuid import uuid4

import redis
from redis.exceptions import RedisError, WatchError

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
    build_extraction,
)
from lifegoods.photo_comparison.rate_limit import PhotoComparisonRateLimiter

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
    def __init__(self, message: str, *, retry_after: int = 1) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class ExtractionCapacityError(ExtractionServiceError):
    pass


class ExtractionRateLimiter:
    """Single-process fallback used by the standalone development app."""

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

    def try_acquire(self, _key: str) -> tuple[bool, int]:
        if self.allow():
            return True, 0
        now = self._clock()
        with self._lock:
            retry_after = (
                max(1, math.ceil(self._period_seconds - (now - self._requests[0])))
                if self._requests
                else 1
            )
        return False, retry_after


class ProviderCapacityProtocol(Protocol):
    def acquire(self) -> bool: ...

    def release(self) -> None: ...


class ProviderCapacity:
    """Single-process capacity fallback used by the standalone development app."""

    def __init__(self, limit: int = MAX_ACTIVE_PROVIDER_REQUESTS) -> None:
        self._semaphore = BoundedSemaphore(limit)

    def acquire(self) -> bool:
        return self._semaphore.acquire(blocking=False)

    def release(self) -> None:
        self._semaphore.release()


class RedisProviderCapacity:
    """A deployment-shared lease limiting active provider calls to one."""

    _KEY = "photo-comparison:provider-capacity"
    def __init__(self, client: redis.Redis, *, lease_ttl_seconds: int = 75) -> None:
        if lease_ttl_seconds <= 0:
            raise ValueError("The provider capacity lease must be greater than zero")
        self._client = client
        self._lease_ttl_seconds = lease_ttl_seconds
        self._owner_token: str | None = None

    def acquire(self) -> bool:
        owner_token = uuid4().hex
        try:
            acquired = bool(
                self._client.set(
                    self._KEY,
                    owner_token,
                    nx=True,
                    ex=self._lease_ttl_seconds,
                )
            )
        except (RedisError, TypeError, ValueError):
            return False
        if acquired:
            self._owner_token = owner_token
        return acquired

    def release(self) -> None:
        owner_token = self._owner_token
        if owner_token is None:
            return
        self._owner_token = None
        for _attempt in range(8):
            try:
                with self._client.pipeline() as pipeline:
                    pipeline.watch(self._KEY)
                    current = pipeline.get(self._KEY)
                    if current not in {owner_token, owner_token.encode("ascii")}:
                        pipeline.unwatch()
                        return
                    pipeline.multi()
                    pipeline.delete(self._KEY)
                    pipeline.execute()
                    return
            except WatchError:
                continue
            except (RedisError, TypeError, ValueError):
                return


class AdmissionTicket:
    """Proof that one photo request already holds the shared admission."""

    def __init__(self, admission: PhotoProviderAdmission) -> None:
        self.admission = admission
        self.active = True


class PhotoProviderAdmission:
    """One anonymous admission budget and provider lease for every photo operation.

    Compare Nutrition extraction, Read This Label, and Khmer Rendering share one
    instance, so no photo-derived provider call has a second budget.
    """

    def __init__(
        self,
        *,
        rate_limiter: PhotoComparisonRateLimiter | None = None,
        capacity: ProviderCapacityProtocol | None = None,
    ) -> None:
        self.rate_limiter = rate_limiter or ExtractionRateLimiter()
        self.capacity = capacity or ProviderCapacity()

    @contextmanager
    def admit(
        self, rate_limit_key: str, *, held: AdmissionTicket | None = None
    ) -> Iterator[AdmissionTicket]:
        # Routers admit before decoding uploads so rejected clients cannot force image
        # decoding, then pass the held ticket so the provider call is not charged twice.
        if held is not None and held.admission is self and held.active:
            yield held
            return
        allowed, retry_after = self.rate_limiter.try_acquire(rate_limit_key)
        if not allowed:
            raise ExtractionRateLimitError(
                "The photo-extraction limit is 10 requests per minute.",
                retry_after=retry_after,
            )
        if not self.capacity.acquire():
            raise ExtractionCapacityError(
                "Another extraction is already in progress. Retry when it finishes."
            )
        ticket = AdmissionTicket(self)
        try:
            yield ticket
        finally:
            ticket.active = False
            self.capacity.release()


class PhotoExtractionService:
    def __init__(
        self,
        provider: PhotoExtractionProvider | None,
        *,
        rate_limiter: PhotoComparisonRateLimiter | None = None,
        capacity: ProviderCapacityProtocol | None = None,
        admission: PhotoProviderAdmission | None = None,
    ) -> None:
        self.provider = provider
        self.admission = admission or PhotoProviderAdmission(
            rate_limiter=rate_limiter, capacity=capacity
        )

    def ensure_available(self) -> PhotoExtractionProvider:
        if self.provider is None:
            raise MissingCredentialsError(
                "Photo extraction is unavailable because Gemini credentials are missing."
            )
        return self.provider

    def extract(
        self,
        product_id: str,
        images: Sequence[PreparedImage],
        *,
        rate_limit_key: str = "unknown",
        admission: AdmissionTicket | None = None,
    ) -> Extraction:
        provider = self.ensure_available()
        with self.admission.admit(rate_limit_key, held=admission):
            try:
                payload = provider.extract(PhotoProviderRequest(images=list(images)))
            except (PhotoProviderTimeout, PhotoProviderUnavailable, PhotoProviderOutputInvalid):
                raise
            except Exception as error:
                raise PhotoProviderUnavailable("The extraction provider failed.") from error
            return build_extraction(
                payload,
                product_id=product_id,
                images=[image.evidence for image in images],
                provider=provider.provider_name,
                model=provider.model,
            )


class PhotoComparisonService:
    @staticmethod
    def compare(request: ComparisonRequest) -> ComparisonResponse:
        return compare(request)


__all__ = [
    "AdmissionTicket",
    "CONFIGURATION_VERSION",
    "EXTRACTION_REQUESTS_PER_MINUTE",
    "ExtractionRateLimiter",
    "ExtractionCapacityError",
    "ExtractionRateLimitError",
    "ExtractionServiceError",
    "MissingCredentialsError",
    "PhotoComparisonService",
    "PhotoExtractionService",
    "PhotoProviderAdmission",
    "ProviderCapacity",
    "ProviderCapacityProtocol",
    "RedisProviderCapacity",
]
