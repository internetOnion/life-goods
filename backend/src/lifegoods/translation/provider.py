from dataclasses import dataclass, field
from typing import Protocol

from lifegoods.translation.deadline import TranslationDeadline

MAX_TRANSLATION_FIELDS_BYTES = 16_000
MAX_TRANSLATION_OUTPUT_TOKENS = 8192


@dataclass(frozen=True)
class ProviderTranslationRequest:
    fields: dict[str, str]
    brands: list[str] = field(default_factory=list)
    target_language: str = "kh"
    deadline: TranslationDeadline | None = field(default=None, repr=False, compare=False)


@dataclass(frozen=True)
class ProviderTranslationResponse:
    translations: dict[str, str]
    raw_response: str = "{}"
    input_tokens: int | None = None
    output_tokens: int | None = None
    thinking_tokens: int | None = None
    total_tokens: int | None = None
    latency_ms: float = 0.0
    attempts: int = 1
    timed_out: bool = False
    status: str = "success"
    error_message: str | None = None


class TranslationProvider(Protocol):
    @property
    def provider_name(self) -> str: ...

    @property
    def model(self) -> str: ...

    def translate(self, request: ProviderTranslationRequest) -> ProviderTranslationResponse: ...


class FakeTranslationProvider:
    provider_name = "test-fake"
    model = "canned-translations"

    def __init__(
        self,
        canned_translations: dict[str, str] | None = None,
        should_fail: bool = False,
        error_message: str | None = None,
    ) -> None:
        self.canned_translations = canned_translations or {}
        self.should_fail = should_fail
        self.error_message = error_message
        self.call_count = 0
        self.last_request: ProviderTranslationRequest | None = None

    def translate(self, request: ProviderTranslationRequest) -> ProviderTranslationResponse:
        self.call_count += 1
        self.last_request = request

        if self.should_fail:
            return ProviderTranslationResponse(
                translations={},
                status="error",
                error_message=self.error_message or "Fake provider simulated failure",
            )

        translations = {
            key: value for key, value in self.canned_translations.items() if key in request.fields
        }

        return ProviderTranslationResponse(
            translations=translations,
            raw_response="{}",
            latency_ms=1.0,
            status="success",
        )
