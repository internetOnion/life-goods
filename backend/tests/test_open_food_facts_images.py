from collections.abc import Callable
from typing import Any

import fakeredis
import httpx2 as httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from lifegoods.open_food_facts import (
    ExternalImage,
    ExternalImageNotFoundError,
    ExternalImageRateLimitError,
    ExternalImageUnavailableError,
    ExternalImageUrlInvalidError,
    OpenFoodFactsImageSource,
    get_image_source,
)
from lifegoods.open_food_facts import (
    open_food_facts_image_router as router,
)
from lifegoods.open_food_facts.image_router import (
    RedisImageProxyRateLimiter,
    get_image_rate_limiter,
)


class _AllowAll:
    def try_acquire(self, key: str) -> tuple[bool, int]:
        del key
        return True, 0

IMAGE_URL = "https://images.openfoodfacts.org/images/products/400/front_en.jpg"
JPEG_BYTES = b"\xff\xd8\xffjpeg"


def image_source(
    respond: httpx.MockTransport,
    *,
    max_image_bytes: int = 10 * 1024 * 1024,
    requests_per_minute: int = 60,
    cache_ttl_seconds: float = 24 * 60 * 60,
    connect_timeout_seconds: float = 15,
    read_timeout_seconds: float = 20,
    monotonic: Callable[[], float] | None = None,
) -> OpenFoodFactsImageSource:
    kwargs: dict[str, Any] = {
        "image_base_url": "https://images.openfoodfacts.org",
        "user_agent": "LifeGoods tests",
        "connect_timeout_seconds": connect_timeout_seconds,
        "read_timeout_seconds": read_timeout_seconds,
        "requests_per_minute": requests_per_minute,
        "max_image_bytes": max_image_bytes,
        "cache_ttl_seconds": cache_ttl_seconds,
    }
    if monotonic is not None:
        kwargs["monotonic"] = monotonic
    return OpenFoodFactsImageSource(
        httpx.Client(transport=respond),
        **kwargs,
    )


def test_fetches_only_supported_images_from_the_configured_origin() -> None:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200, content=JPEG_BYTES, headers={"content-type": "image/jpeg"}
        )

    source = image_source(httpx.MockTransport(respond))
    image = source.fetch(IMAGE_URL)
    cached = source.fetch(IMAGE_URL)

    assert image == cached == ExternalImage(content=JPEG_BYTES, media_type="image/jpeg")
    assert len(requests) == 1
    assert requests[0].headers["accept"] == "image/*"
    assert requests[0].headers["user-agent"] == "LifeGoods tests"


def test_applies_the_configured_connect_and_read_timeouts() -> None:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200, content=JPEG_BYTES, headers={"content-type": "image/jpeg"}
        )

    source = image_source(
        httpx.MockTransport(respond),
        connect_timeout_seconds=15,
        read_timeout_seconds=20,
    )
    source.fetch(IMAGE_URL)

    timeout = requests[0].extensions["timeout"]
    assert timeout["connect"] == 15
    assert timeout["read"] == 20
    assert timeout["pool"] == 15


@pytest.mark.parametrize(
    "url",
    [
        "http://images.openfoodfacts.org/image.jpg",
        "https://images.openfoodfacts.org.evil.test/image.jpg",
        "https://user@images.openfoodfacts.org/image.jpg",
        "https://images.openfoodfacts.org:invalid/image.jpg",
        "https://images.openfoodfacts.org/api/status.jpg",
        f"{IMAGE_URL}?download=1",
    ],
)
def test_rejects_image_urls_outside_the_exact_https_origin(url: str) -> None:
    source = image_source(
        httpx.MockTransport(lambda _request: pytest.fail("HTTP must not be called"))
    )

    with pytest.raises(ExternalImageUrlInvalidError):
        source.fetch(url)


@pytest.mark.parametrize(
    ("status_code", "headers", "content"),
    [
        (302, {"location": "https://example.test/image.jpg"}, b""),
        (200, {"content-type": "image/svg+xml"}, b"<svg/>"),
        (200, {"content-type": "image/jpeg", "content-length": "5"}, b"large"),
    ],
)
def test_rejects_redirects_unsupported_types_and_large_images(
    status_code: int,
    headers: dict[str, str],
    content: bytes,
) -> None:
    source = image_source(
        httpx.MockTransport(
            lambda _request: httpx.Response(status_code, headers=headers, content=content)
        ),
        max_image_bytes=4,
    )

    with pytest.raises(ExternalImageUnavailableError):
        source.fetch(IMAGE_URL)


def test_maps_transport_failures_to_unavailable() -> None:
    def fail(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    with pytest.raises(ExternalImageUnavailableError):
        image_source(httpx.MockTransport(fail)).fetch(IMAGE_URL)


def test_failure_logs_never_contain_the_barcode_bearing_url(
    caplog: pytest.LogCaptureFixture,
) -> None:
    barcode_url = "https://images.openfoodfacts.org/images/products/400/638/133/3931/front_en.jpg"

    def fail(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout(f"timed out fetching {request.url}", request=request)

    with caplog.at_level("INFO"), pytest.raises(ExternalImageUnavailableError):
        image_source(httpx.MockTransport(fail)).fetch(barcode_url)

    assert caplog.records
    assert all("3931" not in record.getMessage() for record in caplog.records)


def test_rejects_a_chunked_image_that_exceeds_the_byte_limit() -> None:
    source = image_source(
        httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                headers={"content-type": "image/jpeg"},
                stream=httpx.ByteStream(JPEG_BYTES),
            )
        ),
        max_image_bytes=4,
    )

    with pytest.raises(ExternalImageUnavailableError):
        source.fetch(IMAGE_URL)


def test_applies_the_image_request_budget_only_to_cache_misses() -> None:
    source = image_source(
        httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                content=JPEG_BYTES,
                headers={"content-type": "image/jpeg"},
            )
        ),
        requests_per_minute=1,
    )

    source.fetch(IMAGE_URL)
    source.fetch(IMAGE_URL)
    with pytest.raises(ExternalImageUnavailableError):
        source.fetch(
            "https://images.openfoodfacts.org/images/products/401/front_en.jpg"
        )


def test_client_admission_is_charged_only_for_upstream_fetches() -> None:
    source = image_source(
        httpx.MockTransport(
            lambda _request: httpx.Response(
                200, content=JPEG_BYTES, headers={"content-type": "image/jpeg"}
            )
        )
    )
    charges: list[str] = []

    def admit() -> tuple[bool, int]:
        charges.append("charged")
        return len(charges) <= 1, 30

    source.fetch(IMAGE_URL, admit=admit)
    source.fetch(IMAGE_URL, admit=admit)  # cached: free
    with pytest.raises(ExternalImageRateLimitError) as limited:
        source.fetch(
            "https://images.openfoodfacts.org/images/products/401/front_en.jpg", admit=admit
        )

    assert charges == ["charged", "charged"]
    assert limited.value.retry_after == 30


def test_missing_images_are_remembered_without_refetching() -> None:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(404)

    source = image_source(httpx.MockTransport(respond))
    charges: list[int] = []

    def admit() -> tuple[bool, int]:
        charges.append(1)
        return True, 0

    for _ in range(3):
        with pytest.raises(ExternalImageNotFoundError):
            source.fetch(IMAGE_URL, admit=admit)

    assert len(requests) == 1
    assert len(charges) == 1


def test_duplicate_requests_do_not_wait_for_a_slow_fetch() -> None:
    import threading
    import time

    started = threading.Event()
    release = threading.Event()

    def respond(_request: httpx.Request) -> httpx.Response:
        started.set()
        release.wait(10)
        return httpx.Response(200, content=JPEG_BYTES, headers={"content-type": "image/jpeg"})

    source = image_source(httpx.MockTransport(respond))
    first = threading.Thread(target=source.fetch, args=(IMAGE_URL,))
    first.start()
    started.wait(5)
    began = time.monotonic()
    try:
        with pytest.raises(ExternalImageUnavailableError):
            source.fetch(IMAGE_URL)
        assert time.monotonic() - began < 5
    finally:
        release.set()
        first.join()
    assert source.fetch(IMAGE_URL).content == JPEG_BYTES


def test_refetches_an_image_after_the_bounded_cache_ttl() -> None:
    now = 0.0
    request_count = 0

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(
            200,
            content=JPEG_BYTES,
            headers={"content-type": "image/jpeg"},
        )

    source = image_source(
        httpx.MockTransport(respond),
        cache_ttl_seconds=10,
        monotonic=lambda: now,
    )

    source.fetch(IMAGE_URL)
    source.fetch(IMAGE_URL)
    now = 11
    source.fetch(IMAGE_URL)

    assert request_count == 2


def test_rejects_content_that_does_not_match_its_image_media_type() -> None:
    source = image_source(
        httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                content=b"not-a-jpeg",
                headers={"content-type": "image/jpeg"},
            )
        )
    )

    with pytest.raises(ExternalImageUnavailableError):
        source.fetch(IMAGE_URL)


class StubImageSource:
    def __init__(self, result: ExternalImage | Exception) -> None:
        self.result = result

    def fetch(
        self, _url: str, *, admit: Callable[[], tuple[bool, int]] | None = None
    ) -> ExternalImage:
        # Behaves like a cache miss: the per-client admission is charged first.
        if admit is not None:
            allowed, retry_after = admit()
            if not allowed:
                raise ExternalImageRateLimitError(retry_after)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def client_for(result: ExternalImage | Exception, limiter: Any = None) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_image_source] = lambda: StubImageSource(result)
    app.dependency_overrides[get_image_rate_limiter] = lambda: limiter or _AllowAll()
    return TestClient(app)


def test_proxy_limits_each_client_separately() -> None:
    limiter = RedisImageProxyRateLimiter(
        fakeredis.FakeRedis(decode_responses=True), requests_per_minute=1
    )
    image = ExternalImage(content=b"jpeg", media_type="image/jpeg")
    with client_for(image, limiter) as client:
        first = client.get("/api/v1/open-food-facts-images", params={"url": IMAGE_URL})
        second = client.get("/api/v1/open-food-facts-images", params={"url": IMAGE_URL})

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"


def test_proxy_returns_same_origin_cacheable_image_bytes() -> None:
    with client_for(ExternalImage(content=b"jpeg", media_type="image/jpeg")) as client:
        response = client.get("/api/v1/open-food-facts-images", params={"url": IMAGE_URL})

    assert response.status_code == 200
    assert response.content == b"jpeg"
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "public, max-age=86400"
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (ExternalImageUrlInvalidError(), 400, "REFERENCE_IMAGE_URL_INVALID"),
        (ExternalImageNotFoundError(), 404, "REFERENCE_IMAGE_NOT_FOUND"),
        (
            ExternalImageUnavailableError(),
            502,
            "REFERENCE_IMAGE_SOURCE_UNAVAILABLE",
        ),
    ],
)
def test_proxy_returns_stable_error_envelopes(
    error: Exception,
    status_code: int,
    code: str,
) -> None:
    with client_for(error) as client:
        response = client.get("/api/v1/open-food-facts-images", params={"url": IMAGE_URL})

    assert response.status_code == status_code
    assert response.json()["error"]["code"] == code
