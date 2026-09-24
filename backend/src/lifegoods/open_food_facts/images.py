import logging
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from threading import BoundedSemaphore, Lock
from time import monotonic as system_monotonic
from urllib.parse import urlsplit

import httpx2 as httpx

from lifegoods.core.concurrency import ExternalLookupLocks, SlidingWindowRequestBudget
from lifegoods.open_food_facts.models import (
    ExternalImage,
    ExternalImageNotFoundError,
    ExternalImageRateLimitError,
    ExternalImageUnavailableError,
    ExternalImageUrlInvalidError,
)

logger = logging.getLogger(__name__)

DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
DEFAULT_MAX_CACHE_BYTES = 32 * 1024 * 1024
DEFAULT_MAX_CONCURRENT_REQUESTS = 8
DEFAULT_IMAGE_CACHE_TTL_SECONDS = 24 * 60 * 60
# Remember missing images briefly so repeated requests never reach Open Food Facts.
DEFAULT_NOT_FOUND_TTL_SECONDS = 10 * 60
MAX_NOT_FOUND_ENTRIES = 10_000
# Duplicate requests wait this long for an in-flight fetch of the same image, then fail
# instead of holding a server worker for the whole upstream timeout.
DUPLICATE_WAIT_SECONDS = 2.0
ALLOWED_IMAGE_MEDIA_TYPES = frozenset(
    {
        "image/gif",
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)


@dataclass(frozen=True, slots=True)
class _CacheEntry:
    image: ExternalImage
    expires_at: float


class OpenFoodFactsImageSource:
    def __init__(
        self,
        client: httpx.Client,
        *,
        image_base_url: str,
        user_agent: str,
        connect_timeout_seconds: float,
        read_timeout_seconds: float,
        requests_per_minute: int,
        max_image_bytes: int = DEFAULT_MAX_IMAGE_BYTES,
        max_cache_bytes: int = DEFAULT_MAX_CACHE_BYTES,
        max_concurrent_requests: int = DEFAULT_MAX_CONCURRENT_REQUESTS,
        cache_ttl_seconds: float = DEFAULT_IMAGE_CACHE_TTL_SECONDS,
        monotonic: Callable[[], float] = system_monotonic,
    ) -> None:
        self._client = client
        self._image_origin = _origin(image_base_url)
        self._user_agent = user_agent
        self._connect_timeout_seconds = connect_timeout_seconds
        self._read_timeout_seconds = read_timeout_seconds
        self._timeout = httpx.Timeout(
            connect=connect_timeout_seconds,
            read=read_timeout_seconds,
            write=read_timeout_seconds,
            pool=connect_timeout_seconds,
        )
        self._max_image_bytes = max_image_bytes
        self._max_cache_bytes = max_cache_bytes
        self._cache_ttl_seconds = cache_ttl_seconds
        self._monotonic = monotonic
        self._request_budget = SlidingWindowRequestBudget(requests_per_minute)
        self._request_slots = BoundedSemaphore(max_concurrent_requests)
        self._lookup_locks = ExternalLookupLocks()
        self._cache: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._cache_bytes = 0
        self._cache_lock = Lock()
        self._not_found: OrderedDict[str, float] = OrderedDict()

    def fetch(
        self, url: str, *, admit: Callable[[], tuple[bool, int]] | None = None
    ) -> ExternalImage:
        """Serve from cache, or fetch upstream once ``admit`` (the per-client limit,
        charged only for cache misses) and the shared upstream budget allow it."""
        _validate_image_url(url, self._image_origin)
        cached = self._cached(url)
        if cached is not None:
            return cached
        self._raise_if_known_missing(url)

        try:
            with self._lookup_locks.hold(url, timeout=DUPLICATE_WAIT_SECONDS):
                return self._fetch_uncached(url, admit)
        except TimeoutError as error:
            raise ExternalImageUnavailableError(
                "OFF image request is already in progress"
            ) from error

    def _fetch_uncached(
        self, url: str, admit: Callable[[], tuple[bool, int]] | None
    ) -> ExternalImage:
        cached = self._cached(url)
        if cached is not None:
            return cached
        self._raise_if_known_missing(url)
        if admit is not None:
            allowed, retry_after = admit()
            if not allowed:
                raise ExternalImageRateLimitError(retry_after)
        if not self._request_budget.try_acquire():
            logger.warning("OFF image request budget exhausted; refusing request")
            raise ExternalImageUnavailableError("OFF image request budget is exhausted")
        if not self._request_slots.acquire(blocking=False):
            logger.warning("OFF image request concurrency exhausted; refusing request")
            raise ExternalImageUnavailableError(
                "OFF image request concurrency is exhausted"
            )
        try:
            image = self._fetch(url)
        except ExternalImageNotFoundError:
            self._remember_missing(url)
            raise
        finally:
            self._request_slots.release()
        self._store(url, image)
        return image

    def _raise_if_known_missing(self, url: str) -> None:
        with self._cache_lock:
            expires_at = self._not_found.get(url)
            if expires_at is None:
                return
            if expires_at <= self._monotonic():
                del self._not_found[url]
                return
        raise ExternalImageNotFoundError("OFF image no longer exists")

    def _remember_missing(self, url: str) -> None:
        with self._cache_lock:
            self._not_found.pop(url, None)
            self._not_found[url] = self._monotonic() + DEFAULT_NOT_FOUND_TTL_SECONDS
            while len(self._not_found) > MAX_NOT_FOUND_ENTRIES:
                self._not_found.popitem(last=False)

    def _fetch(self, url: str) -> ExternalImage:
        try:
            with self._client.stream(
                "GET",
                url,
                headers={"accept": "image/*", "user-agent": self._user_agent},
                timeout=self._timeout,
                follow_redirects=False,
            ) as response:
                if response.status_code in {404, 410}:
                    logger.info("OFF image no longer exists")
                    raise ExternalImageNotFoundError("OFF image no longer exists")
                if response.status_code != 200:
                    self._log_unavailable(
                        url, f"OFF image request returned status {response.status_code}"
                    )
                    raise ExternalImageUnavailableError(
                        "OFF image request did not succeed"
                    )
                media_type = (
                    response.headers.get("content-type", "").split(";", 1)[0].lower()
                )
                if media_type not in ALLOWED_IMAGE_MEDIA_TYPES:
                    self._log_unavailable(
                        url, f"OFF image response type is not supported: {media_type!r}"
                    )
                    raise ExternalImageUnavailableError(
                        "OFF image response type is not supported"
                    )

                content_length = response.headers.get("content-length")
                if content_length is not None:
                    try:
                        if int(content_length) > self._max_image_bytes:
                            self._log_unavailable(
                                url,
                                "OFF image response is too large: "
                                f"{content_length} bytes",
                            )
                            raise ExternalImageUnavailableError(
                                "OFF image response is too large"
                            )
                    except ValueError as error:
                        self._log_unavailable(
                            url,
                            "OFF image response has an invalid content length: "
                            f"{content_length!r}",
                        )
                        raise ExternalImageUnavailableError(
                            "OFF image response has an invalid content length"
                        ) from error

                chunks: list[bytes] = []
                total_bytes = 0
                for chunk in response.iter_bytes():
                    total_bytes += len(chunk)
                    if total_bytes > self._max_image_bytes:
                        self._log_unavailable(
                            url, "OFF image response is too large while streaming"
                        )
                        raise ExternalImageUnavailableError(
                            "OFF image response is too large"
                        )
                    chunks.append(chunk)
        except (ExternalImageNotFoundError, ExternalImageUnavailableError):
            raise
        except httpx.HTTPError as error:
            self._log_unavailable(
                url,
                # Error text can embed the URL, whose path contains the Barcode.
                f"OFF image request failed: {type(error).__name__} "
                f"(connect={self._connect_timeout_seconds}s, "
                f"read={self._read_timeout_seconds}s)",
            )
            raise ExternalImageUnavailableError("OFF image request failed") from error

        content = b"".join(chunks)
        if not _matches_media_type(content, media_type):
            self._log_unavailable(
                url, f"OFF image content does not match media type {media_type!r}"
            )
            raise ExternalImageUnavailableError(
                "OFF image content does not match its media type"
            )
        return ExternalImage(content=content, media_type=media_type)

    @staticmethod
    def _log_unavailable(url: str, reason: str) -> None:
        # Never log the URL: Open Food Facts image paths contain the Barcode.
        del url
        logger.warning("OFF image unavailable: %s", reason)

    def _cached(self, url: str) -> ExternalImage | None:
        with self._cache_lock:
            entry = self._cache.pop(url, None)
            if entry is None:
                return None
            if entry.expires_at <= self._monotonic():
                self._cache_bytes -= len(entry.image.content)
                return None
            self._cache[url] = entry
            return entry.image

    def _store(self, url: str, image: ExternalImage) -> None:
        image_bytes = len(image.content)
        if image_bytes > self._max_cache_bytes:
            return
        with self._cache_lock:
            replaced = self._cache.pop(url, None)
            if replaced is not None:
                self._cache_bytes -= len(replaced.image.content)
            self._cache[url] = _CacheEntry(
                image=image,
                expires_at=self._monotonic() + self._cache_ttl_seconds,
            )
            self._cache_bytes += image_bytes
            while self._cache and self._cache_bytes > self._max_cache_bytes:
                _, evicted = self._cache.popitem(last=False)
                self._cache_bytes -= len(evicted.image.content)


def _origin(url: str) -> tuple[str, str, int]:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ExternalImageUrlInvalidError(
            "OFF image URL must use HTTPS without credentials"
        )
    try:
        port = parsed.port or 443
    except ValueError as error:
        raise ExternalImageUrlInvalidError("OFF image URL has an invalid port") from error
    return parsed.scheme, parsed.hostname.lower(), port


def _validate_image_url(url: str, expected_origin: tuple[str, str, int]) -> None:
    parsed = urlsplit(url)
    if _origin(url) != expected_origin:
        raise ExternalImageUrlInvalidError(
            "Image URL is outside the configured OFF origin"
        )
    if parsed.query or parsed.fragment or not parsed.path.startswith("/images/products/"):
        raise ExternalImageUrlInvalidError("Image URL is not an OFF product image path")
    if not parsed.path.lower().endswith((".gif", ".jpeg", ".jpg", ".png", ".webp")):
        raise ExternalImageUrlInvalidError(
            "Image URL does not have a supported image extension"
        )


def _matches_media_type(content: bytes, media_type: str) -> bool:
    if media_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if media_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if media_type == "image/gif":
        return content.startswith((b"GIF87a", b"GIF89a"))
    if media_type == "image/webp":
        return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    return False
