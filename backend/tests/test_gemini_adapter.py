import json

import httpx2 as httpx
import pytest

from lifegoods.translation.gemini import GeminiTranslationAdapter
from lifegoods.translation.provider import ProviderTranslationRequest


def test_gemini_adapter_rejects_deprecated_or_moving_model_aliases() -> None:
    with pytest.raises(ValueError, match="rejected"):
        GeminiTranslationAdapter(api_key="test-key", model="gemini-2.0-flash")

    with pytest.raises(ValueError, match="(?i)moving alias"):
        GeminiTranslationAdapter(api_key="test-key", model="gemini-latest")


def test_gemini_adapter_successful_translation() -> None:
    captured_requests: list[httpx.Request] = []

    def handle_request(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        resp_body = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    {"translations": {"product_name": "Galaxy សូកូឡា"}},
                                    ensure_ascii=False,
                                )
                            }
                        ]
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 50,
                "candidatesTokenCount": 20,
            },
        }
        return httpx.Response(200, json=resp_body)

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    adapter = GeminiTranslationAdapter(
        api_key="secret-api-key",
        model="gemini-3.8-flash",
        http_client=client,
    )

    request = ProviderTranslationRequest(
        fields={"product_name": "__LG_TOK_0__ Chocolate"},
        brands=["Galaxy"],
        target_language="kh",
    )

    response = adapter.translate(request)

    assert response.status == "success"
    assert response.translations["product_name"] == "Galaxy សូកូឡា"
    assert response.input_tokens == 50
    assert response.output_tokens == 20

    # Verify HTTP request details
    assert len(captured_requests) == 1
    sent_req = captured_requests[0]
    assert "key=secret-api-key" in str(sent_req.url)
    assert "/v1beta/models/gemini-3.8-flash:generateContent" in str(sent_req.url)

    # Verify body schema
    body = json.loads(sent_req.content.decode("utf-8"))
    assert "generationConfig" in body
    assert body["generationConfig"]["temperature"] == 0.0
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert "barcode" not in sent_req.content.decode("utf-8").lower()


def test_gemini_adapter_retries_transient_503_and_succeeds() -> None:
    attempts = 0

    def handle_request(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, text="Service Unavailable")
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {"translations": {"product_name": "សូកូឡា"}},
                                        ensure_ascii=False,
                                    )
                                }
                            ]
                        },
                        "finishReason": "STOP",
                    }
                ],
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    adapter = GeminiTranslationAdapter(
        api_key="test-key",
        http_client=client,
        backoff_seconds=0.01,
    )

    request = ProviderTranslationRequest(
        fields={"product_name": "Chocolate"},
        brands=[],
        target_language="kh",
    )

    response = adapter.translate(request)

    assert response.status == "success"
    assert attempts == 2
    assert response.translations["product_name"] == "សូកូឡា"


def test_gemini_adapter_fails_fast_on_400_without_retrying() -> None:
    attempts = 0

    def handle_request(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(400, text="Bad Request")

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    adapter = GeminiTranslationAdapter(
        api_key="test-key",
        http_client=client,
    )

    request = ProviderTranslationRequest(
        fields={"product_name": "Chocolate"},
        brands=[],
        target_language="kh",
    )

    response = adapter.translate(request)

    assert response.status == "error"
    assert attempts == 1
    assert "HTTP 400" in (response.error_message or "")


def test_gemini_adapter_handles_timeout_gracefully() -> None:
    def handle_request(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Request timed out", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    adapter = GeminiTranslationAdapter(
        api_key="test-key",
        http_client=client,
        backoff_seconds=0.01,
    )

    request = ProviderTranslationRequest(
        fields={"product_name": "Chocolate"},
        brands=[],
        target_language="kh",
    )

    response = adapter.translate(request)

    assert response.status == "error"
    assert "timed out" in (response.error_message or "").lower()


def test_gemini_adapter_does_not_retry_after_deadline() -> None:
    from lifegoods.translation.deadline import TranslationDeadline

    clock = [0.0]
    attempts = []

    def handle_request(request):
        attempts.append(request)
        clock[0] = 1
        raise httpx.ReadTimeout("sensitive provider URL", request=request)

    with httpx.Client(transport=httpx.MockTransport(handle_request)) as client:
        response = GeminiTranslationAdapter("offline", http_client=client).translate(
            ProviderTranslationRequest(
                fields={"product_name": "Chocolate"},
                deadline=TranslationDeadline(1, clock=lambda: clock[0]),
            )
        )
    assert response.status == "error"
    assert len(attempts) == 1
    assert response.error_message == "Translation deadline exceeded"


def test_gemini_adapter_handles_safety_blocked_response() -> None:
    def handle_request(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "SAFETY",
                    }
                ],
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    adapter = GeminiTranslationAdapter(
        api_key="test-key",
        http_client=client,
    )

    request = ProviderTranslationRequest(
        fields={"product_name": "Chocolate"},
        brands=[],
        target_language="kh",
    )

    response = adapter.translate(request)

    assert response.status == "error"
    assert "safety" in (response.error_message or "").lower()


@pytest.mark.parametrize(
    "payload,finish_reason",
    [
        ({"translations": {"product_name": "សូកូឡា"}}, "MAX_TOKENS"),
        ({"product_name": "សូកូឡា"}, "STOP"),
        ({"translations": ["សូកូឡា"]}, "STOP"),
    ],
)
def test_gemini_adapter_rejects_incomplete_or_malformed_envelope(payload, finish_reason) -> None:
    def respond(request):
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": finish_reason,
                        "content": {"parts": [{"text": json.dumps(payload)}]},
                    }
                ]
            },
        )

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        adapter = GeminiTranslationAdapter("offline-key", http_client=client)
        response = adapter.translate(
            ProviderTranslationRequest(fields={"product_name": "Chocolate"})
        )
    assert response.status == "error"
    assert response.translations == {}


@pytest.mark.parametrize("first_status", [408, 429, 500, 501, 599])
def test_retry_uses_only_remaining_translation_deadline(first_status) -> None:
    from lifegoods.translation.deadline import TranslationDeadline

    clock = [0.0]
    timeouts = []

    def respond(request):
        timeouts.append(request.extensions["timeout"]["read"])
        clock[0] += 0.4
        if len(timeouts) == 1:
            return httpx.Response(first_status)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {"text": json.dumps({"translations": {"product_name": "សូកូឡា"}})}
                            ]
                        },
                    }
                ]
            },
        )

    def sleep(seconds):
        clock[0] += seconds

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        adapter = GeminiTranslationAdapter("offline", http_client=client, sleep_func=sleep)
        response = adapter.translate(
            ProviderTranslationRequest(
                fields={"product_name": "Chocolate"},
                deadline=TranslationDeadline(1, clock=lambda: clock[0]),
            )
        )
    assert response.status == "success"
    assert len(timeouts) == 2
    assert timeouts[0] == 1
    assert 0.47 <= timeouts[1] <= 0.53
    assert clock[0] < 1


def test_total_deadline_bounds_transport_that_does_not_honor_timeouts() -> None:
    from threading import Event

    from lifegoods.translation.deadline import TranslationDeadline

    release = Event()
    completed = Event()

    def respond(request):
        try:
            assert release.wait(2), "Test did not release the transport"
            return httpx.Response(503)
        finally:
            completed.set()

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        try:
            result = GeminiTranslationAdapter("offline", http_client=client).translate(
                ProviderTranslationRequest(
                    fields={"product_name": "Chocolate"},
                    deadline=TranslationDeadline(0.05),
                )
            )
            assert not release.is_set()
            assert result.status == "error"
            assert result.error_message == "Translation deadline exceeded"
        finally:
            release.set()
            assert completed.wait(2)


@pytest.mark.parametrize("delay", [0.95, 1.0])
def test_retry_backoff_cannot_extend_deadline(delay) -> None:
    from lifegoods.translation.deadline import TranslationDeadline

    clock = [0.0]
    attempts = []

    def respond(request):
        attempts.append(request)
        clock[0] += delay
        raise httpx.ConnectError("sensitive URL and credential")

    def sleep(seconds):
        clock[0] += seconds

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        response = GeminiTranslationAdapter(
            "offline",
            http_client=client,
            sleep_func=sleep,
        ).translate(
            ProviderTranslationRequest(
                fields={"product_name": "Chocolate"},
                deadline=TranslationDeadline(1, clock=lambda: clock[0]),
            )
        )
    assert len(attempts) == 1
    assert clock[0] == 1
    assert response.error_message == "Translation deadline exceeded"
