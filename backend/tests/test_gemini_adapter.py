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


def test_gemini_adapter_preserves_timeout_error_when_retry_budget_is_exhausted() -> None:
    attempts = 0

    def handle_request(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ReadTimeout("Request timed out", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    adapter = GeminiTranslationAdapter(
        api_key="test-key",
        http_client=client,
        timeout_seconds=0.1,
        backoff_seconds=0.01,
    )

    response = adapter.translate(
        ProviderTranslationRequest(
            fields={"product_name": "Chocolate"},
            brands=[],
            target_language="kh",
        )
    )

    assert response.status == "error"
    assert attempts == 1
    assert "timed out" in (response.error_message or "").lower()
    assert "budget exhausted" not in (response.error_message or "").lower()


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
