from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class ProviderTranslationRequest:
    fields: dict[str, str]
    brands: list[str] = field(default_factory=list)
    target_language: str = "km"


@dataclass(frozen=True)
class ProviderTranslationResponse:
    translations: dict[str, str]
    raw_response: str = "{}"
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    status: str = "success"
    error_message: str | None = None


class TranslationProvider(Protocol):
    def translate(self, request: ProviderTranslationRequest) -> ProviderTranslationResponse: ...


class FakeTranslationProvider:
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

        translations: dict[str, str] = {}
        for field_name, masked_text in request.fields.items():
            if field_name in self.canned_translations:
                translations[field_name] = self.canned_translations[field_name]
            else:
                # Default behavior preserves the masked text prefixed with Khmer marker
                translations[field_name] = f"ការបកប្រែ: {masked_text}"

        return ProviderTranslationResponse(
            translations=translations,
            raw_response="{}",
            latency_ms=1.0,
            status="success",
        )
