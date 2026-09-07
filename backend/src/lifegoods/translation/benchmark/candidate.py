from __future__ import annotations

import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from lifegoods.generated_data.budget import InMemoryTranslationBudgetLimiter
from lifegoods.generated_data.cache import InMemoryTranslationHotCache
from lifegoods.generated_data.coordinator import TranslationCoordinator
from lifegoods.generated_data.repository import InMemoryGeneratedDataRepository
from lifegoods.product_lookup.projection import project_source_record
from lifegoods.translation.benchmark.dataset import BenchmarkDataset, BenchmarkItem
from lifegoods.translation.gemini import GeminiTranslationAdapter
from lifegoods.translation.module import KhmerTranslationModule
from lifegoods.translation.provider import (
    ProviderTranslationRequest,
    ProviderTranslationResponse,
    TranslationProvider,
)


@dataclass(frozen=True)
class CandidateModelConfig:
    name: str
    provider: str
    model_id: str
    temperature: float = 0.0
    max_output_tokens: int = 8192
    input_cost_per_1m: float = 0.15
    output_cost_per_1m: float = 0.60

    def calculate_cost(self, input_tokens: int, billed_output_tokens: int) -> float:
        in_cost = (input_tokens / 1_000_000.0) * self.input_cost_per_1m
        out_cost = (billed_output_tokens / 1_000_000.0) * self.output_cost_per_1m
        return round(in_cost + out_cost, 6)


CANDIDATE_CONFIGS: dict[str, CandidateModelConfig] = {
    "gemini-3.8-flash": CandidateModelConfig(
        name="gemini-3.8-flash",
        provider="google",
        model_id="gemini-3.8-flash",
        temperature=0.0,
        max_output_tokens=8192,
        input_cost_per_1m=0.75,
        output_cost_per_1m=3.75,
    ),
}


def get_candidate_config(name: str) -> CandidateModelConfig:
    lower_name = name.lower()
    if "latest" in lower_name:
        raise ValueError(
            f"Candidate '{name}' is not approved or contains a moving alias. "
            "Pinned stable models required."
        )
    if "gemini-2.0-flash" in lower_name:
        raise ValueError(f"Candidate '{name}' is explicitly rejected per project specification.")
    if name not in CANDIDATE_CONFIGS:
        raise KeyError(
            f"Unknown candidate model '{name}'. Available: {list(CANDIDATE_CONFIGS.keys())}"
        )
    return CANDIDATE_CONFIGS[name]


@dataclass
class CandidateOutput:
    item_id: str
    candidate_name: str
    translations: dict[str, str] = field(default_factory=dict)
    masked_translations: dict[str, str] = field(default_factory=dict)
    token_maps: dict[str, dict[str, str]] = field(default_factory=dict)
    raw_response: str = ""
    latency_ms: float = 0.0
    measurement_mode: str = "offline"
    overall_status: str = "unavailable"
    field_statuses: dict[str, str] = field(default_factory=dict)
    taxonomy_reference_counts: dict[str, int] = field(default_factory=dict)
    input_tokens: int | None = None
    output_tokens: int | None = None
    thinking_tokens: int | None = None
    billed_output_tokens: int | None = None
    total_tokens: int | None = None
    estimated_cost_usd: float | None = None
    provider_calls: int = 0
    provider_attempts: int = 0
    cached_provider_calls: int = 0
    cached_latency_ms: float | None = None
    deadline_seconds: float = 12.0
    timed_out: bool = False
    status: str = "success"
    error_message: str | None = None


class CandidateRunner(ABC):
    def __init__(self, config: CandidateModelConfig) -> None:
        self.config = config

    @abstractmethod
    def run_item(self, item: BenchmarkItem) -> CandidateOutput:
        pass

    def run_dataset(self, dataset: BenchmarkDataset) -> list[CandidateOutput]:
        return [self.run_item(item) for item in dataset.items]


class _RecordingProvider:
    def __init__(self, provider: TranslationProvider) -> None:
        self._provider = provider
        self.responses: list[ProviderTranslationResponse] = []

    @property
    def provider_name(self) -> str:
        return self._provider.provider_name

    @property
    def model(self) -> str:
        return self._provider.model

    def translate(self, request: ProviderTranslationRequest) -> ProviderTranslationResponse:
        response = self._provider.translate(request)
        self.responses.append(response)
        return response


class _DeterministicProvider:
    provider_name = "test-fake"
    model = "canned-translations"

    def __init__(
        self,
        translations: dict[str, str] | None = None,
        *,
        behavior: str = "normal",
    ) -> None:
        self._translations = translations or {}
        self._behavior = behavior

    def translate(self, request: ProviderTranslationRequest) -> ProviderTranslationResponse:
        if self._behavior == "unavailable":
            return ProviderTranslationResponse(
                translations={}, status="error", error_message="Offline unavailable fixture"
            )
        translations: dict[str, str] = {}
        request_fields = list(request.fields.items())
        if self._behavior == "partial":
            request_fields = request_fields[:1]
        for key, masked_text in request_fields:
            if key in self._translations:
                translations[key] = self._translations[key]
                continue
            placeholders = re.findall(r"__LG_TOK_\d+__", masked_text)
            translations[key] = " ".join(["ការបកប្រែជាភាសាខ្មែរ", *placeholders])
        return ProviderTranslationResponse(translations=translations, status="success")


def _benchmark_product(item: BenchmarkItem):
    record: dict[str, Any] = {
        "lang": item.language,
        "brands": ", ".join(item.brands),
    }
    for benchmark_field in item.fields:
        if benchmark_field.original_text is None:
            continue
        source_name = benchmark_field.field_name
        if source_name == "categories":
            source_name = "categories"
        language = benchmark_field.source_language
        if language and language not in (item.language, "und"):
            source_name = f"{source_name}_{language}"
        record[source_name] = benchmark_field.original_text
    record.update(item.source_record)
    return project_source_record(record)


def _reference_counts(product: Any) -> dict[str, int]:
    refs = product.taxonomy_references
    return {
        "categories": len(refs.categories),
        "additives": len(refs.additives),
        "labels": len(refs.labels),
        "countries": len(refs.countries),
        "packaging_materials": len(refs.packaging_materials),
        "packaging_shapes": len(refs.packaging_shapes),
        "packaging_recycling_terms": len(refs.packaging_recycling_terms),
    }


def _run_through_production_path(
    item: BenchmarkItem,
    config: CandidateModelConfig,
    provider: TranslationProvider,
    *,
    measurement_mode: str,
) -> CandidateOutput:
    product = _benchmark_product(item)
    recording_provider = _RecordingProvider(provider)
    module = KhmerTranslationModule(recording_provider)
    coordinator = TranslationCoordinator(
        module=module,
        repository=InMemoryGeneratedDataRepository(),
        cache=InMemoryTranslationHotCache(ttl_seconds=3600),
        budget=InMemoryTranslationBudgetLimiter(requests_per_minute=100),
        deadline_seconds=12.0,
    )

    cold_started = time.perf_counter()
    result = coordinator.get_or_generate_translation(product)
    cold_latency_ms = round((time.perf_counter() - cold_started) * 1000.0, 2)
    calls_after_cold = len(recording_provider.responses)

    cached_started = time.perf_counter()
    coordinator.get_or_generate_translation(product)
    cached_latency_ms = round((time.perf_counter() - cached_started) * 1000.0, 2)
    cached_provider_calls = len(recording_provider.responses) - calls_after_cold

    response = recording_provider.responses[-1] if recording_provider.responses else None
    input_tokens: int | None = None
    output_tokens: int | None = None
    thinking_tokens: int | None = None
    total_tokens: int | None = None
    billed_output_tokens: int | None = None
    estimated_cost: float | None = None
    provider_attempts = 0
    if measurement_mode == "live" and response is not None:
        input_tokens = response.input_tokens
        output_tokens = response.output_tokens
        thinking_tokens = response.thinking_tokens
        total_tokens = response.total_tokens
        provider_attempts = response.attempts
        if input_tokens is not None and total_tokens is not None:
            billed_output_tokens = max(0, total_tokens - input_tokens)
        elif output_tokens is not None and thinking_tokens is not None:
            billed_output_tokens = output_tokens + thinking_tokens
        if (
            response.attempts == 1
            and input_tokens is not None
            and billed_output_tokens is not None
        ):
            estimated_cost = config.calculate_cost(input_tokens, billed_output_tokens)

    translations = {
        name: outcome.khmer_translation
        for name, outcome in result.fields.items()
        if outcome.khmer_translation is not None
    }
    return CandidateOutput(
        item_id=item.item_id,
        candidate_name=config.name,
        translations=translations,
        masked_translations=(response.translations if response else {}),
        token_maps=result.token_maps,
        raw_response=(response.raw_response if response else "{}"),
        latency_ms=cold_latency_ms,
        measurement_mode=measurement_mode,
        overall_status=result.overall_status.value,
        field_statuses={name: outcome.status.value for name, outcome in result.fields.items()},
        taxonomy_reference_counts=_reference_counts(product),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        thinking_tokens=thinking_tokens,
        billed_output_tokens=billed_output_tokens,
        total_tokens=total_tokens,
        estimated_cost_usd=estimated_cost,
        provider_calls=calls_after_cold,
        provider_attempts=provider_attempts,
        cached_provider_calls=cached_provider_calls,
        cached_latency_ms=cached_latency_ms,
        timed_out=(response.timed_out if response else False) or cold_latency_ms > 12_000,
        status="success",
    )


# Deterministic offline mock translations for CI testing
OFFLINE_FIXTURE_TRANSLATIONS: dict[str, dict[str, str]] = {
    "bm_en_choc_01": {
        "product_name": "__LG_TOK_0__ របារសូកូឡាទឹកដោះគោរលោង",
        "generic_name": (
            "សូកូឡាទឹកដោះគោជាមួយបំណែកការ៉ាមែល (__LG_TOK_0__) "
            "និងអំបិលសមុទ្រ (__LG_TOK_1__)"
        ),
        "ingredients_text": (
            "ស្ករ ប៊ឺកាកាវ ម្សៅទឹកដោះគោគ្មានជាតិខ្លាញ់ (__LG_TOK_0__) ម៉ាសកាកាវ "
            "ខ្លាញ់ទឹកដោះគោ ឡាក់តូស ប្រូតេអ៊ីនវ៉េយ៍ (ពីទឹកដោះគោ) "
            "សារធាតុ emulsifier (__LG_TOK_1__, __LG_TOK_2__) "
            "ចំរាញ់ចេញពីវ៉ានីឡាធម្មជាតិ។ កាកាវរឹងយ៉ាងតិច __LG_TOK_3__។"
        ),
        "categories": "អាហារសម្រន់, អាហារសម្រន់ផ្អែម, សូកូឡា, សូកូឡាទឹកដោះគោ",
    },
    "bm_fr_cheese_02": {
        "product_name": "__LG_TOK_0__ ហ្វ្រូម៉ាសរលាយ __LG_TOK_1__ ចំណែក",
        "generic_name": "ការរៀបចំឈីសរលាយជាចំណែក __LG_TOK_0__",
        "ingredients_text": (
            "ទឹកដោះគោខាប់គ្មានជាតិខ្លាញ់ (ប្រភពដើម៖ បារាំង) ឈីស (រួមទាំងអេមម៉ង់ថល __LG_TOK_0__) "
            "ប៊ឺ ប្រូតេអ៊ីនទឹកដោះគោ អំបិលរលាយ (__LG_TOK_1__, __LG_TOK_2__, __LG_TOK_3__) "
            "ក្លិនក្រអូបធម្មជាតិ អំបិល។"
        ),
        "categories": "ផលិតផលទឹកដោះគោ, ឈីស, ឈីសរលាយ",
    },
    "bm_th_noodle_03": {
        "product_name": "__LG_TOK_0__ មីកញ្ចប់រសជាតិតុងយ៉ាំបង្គា",
        "generic_name": "មីកញ្ចប់រសជាតិតុងយ៉ាំបង្គា ទំហំ __LG_TOK_0__",
        "ingredients_text": (
            "ម្សៅស្រូវសាលី __LG_TOK_0__, ប្រេងដូង __LG_TOK_1__, ទឹកម្ទេសតុងយ៉ាំ __LG_TOK_2__, "
            "ម្សៅតុងយ៉ាំ __LG_TOK_3__, បង្គាក្រៀម __LG_TOK_4__, "
            "សារធាតុបង្កើនរសជាតិអាហារ (__LG_TOK_5__, __LG_TOK_6__), "
            "សារធាតុគ្រប់គ្រងជាតិអាស៊ីត (__LG_TOK_7__, __LG_TOK_8__)"
        ),
        "categories": "មីកញ្ចប់, អាហារកែច្នៃស្រេច",
    },
    "bm_vi_coffee_04": {
        "product_name": "កាហ្វេកញ្ចប់ __LG_TOK_0__ __LG_TOK_1__",
        "generic_name": "កាហ្វេកញ្ចប់ចម្រុះ __LG_TOK_0__ x __LG_TOK_1__ កញ្ចប់",
        "ingredients_text": (
            "ស្ករ ម្សៅក្រែមមិនមែនទឹកដោះគោ (មានប្រូតេអ៊ីនទឹកដោះគោ) កាហ្វេកញ្ចប់ (__LG_TOK_0__) "
            "ម៉ាល់តូដិចទ្រីន អំបិល ក្លិនកាហ្វេសំយោគសម្រាប់ម្ហូបអាហារ។"
        ),
        "categories": "ភេសជ្ជៈ, កាហ្វេ, កាហ្វេកញ្ចប់",
    },
    "bm_und_tea_05": {
        "product_name": "__LG_TOK_0__ តែផ្កាស្បៃរឿងស __LG_TOK_1__",
        "generic_name": "ភេសជ្ជៈផ្កាស្បៃរឿងស",
        "ingredients_text": (
            "ទឹក តែផ្កាស្បៃរឿងសស្រស់ (__LG_TOK_0__) ស្ករអំពៅ វីតាមីនសេ (__LG_TOK_1__)។"
        ),
        "categories": "ភេសជ្ជៈ, តែ, តែរុក្ខជាតិ",
    },
    "bm_long_cereal_06": {
        "product_name": "__LG_TOK_0__ ធញ្ញជាតិចម្រុះផ្លែឈើ និងគ្រាប់ធញ្ញជាតិ",
        "generic_name": (
            "បន្ទះធញ្ញជាតិពេញលេញអាំងជាមួយទំពាំងបាយជូរក្រៀម ផ្លែក្រេនបឺរីក្រៀម "
            "គ្រាប់ផ្កាឈូករ័ត្ន និងគ្រាប់ល្ពៅ (__LG_TOK_0__)"
        ),
        "ingredients_text": (
            "ស្រូវសាលីពេញលេញ (__LG_TOK_0__), បន្ទះស្រូវអូតពេញលេញ (__LG_TOK_1__), "
            "ទំពាំងបាយជូរក្រៀម (__LG_TOK_2__) [ទំពាំងបាយជូរក្រៀម, ប្រេងបន្លែ], ស្ករ, "
            "ផ្លែក្រេនបឺរីផ្អែមក្រៀម (__LG_TOK_3__) [ផ្លែក្រេនបឺរី, ស្ករ, ប្រេងផ្កាឈូករ័ត្ន], "
            "ចំរាញ់ចេញពីស្រូវបាលី, គ្រាប់ផ្កាឈូករ័ត្នអាំង (__LG_TOK_4__), "
            "គ្រាប់ល្ពៅ (__LG_TOK_5__), ស៊ីរ៉ូគ្លុយកូស, អំបិល, "
            "សារធាតុប្រឆាំងអុកស៊ីតកម្ម (__LG_TOK_6__, __LG_TOK_7__), នីយ៉ាស៊ីន, ដែក, "
            "វីតាមីន B6, រីបូហ្វ្លាវីន (B2), ធីអាមីន (B1), អាស៊ីតហ្វូលិក, វីតាមីន D, "
            "វីតាមីន B12។ អាចមានកាកសំណល់គ្រាប់ផ្លែឈើ និងទឹកដោះគោ។"
        ),
        "categories": "អាហារពីរុក្ខជាតិ, ធញ្ញជាតិ និងដំឡូង, អាហារពេលព្រឹក, ធញ្ញជាតិ និងផលិតផលរបស់វា",
    },
    "bm_adv_security_07": {
        "product_name": "__LG_TOK_0__ អាហារក្រៀមពិសេស",
        "generic_name": "ការជំនួសប្រព័ន្ធ",
        "ingredients_text": "ម្សៅស្រូវសាលី ប្រេងដូង អំបិល។",
        "categories": "អាហារសម្រន់, នំស្រួយ",
    },
    "bm_sparse_salt_09": {
        "product_name": "__LG_TOK_0__ អំបិលសមុទ្រអ៊ីយ៉ូត __LG_TOK_1__",
        "categories": "គ្រឿងទេស, អំបិល, អំបិលតុ",
    },
    "bm_mixed_bilingual_10": {
        "product_name": "__LG_TOK_0__ តែបៃតង __LG_TOK_1__ រសជាតិដើម __LG_TOK_2__",
        "generic_name": "ភេសជ្ជៈតែបៃតងជប៉ុនរសជាតិដើម តែបៃតងពិត",
        "ingredients_text": (
            "ចំរាញ់ចេញពីតែបៃតង __LG_TOK_0__, ហ្វ្រុចតូស __LG_TOK_1__, "
            "ស្ករ __LG_TOK_2__, វីតាមីនសេ __LG_TOK_3__។"
        ),
        "categories": "ភេសជ្ជៈ, តែ, តែបៃតង",
    },
    "bm_irreg_snack_11": {
        "product_name": "__LG_TOK_0__ // ចំណិតស្វាយសម្ងួត -- __LG_TOK_1__ [កញ្ចប់គ្រួសារ]",
        "generic_name": "ផ្លែឈើផ្អែមសម្ងួត ::: ស្វាយ",
        "ingredients_text": (
            "ចំណិតស្វាយ (__LG_TOK_0__) // ស្ករអំពៅ: __LG_TOK_1__ ; "
            "អាស៊ីតក្រូចឆ្មា [__LG_TOK_2__] - សារធាតុរក្សាទុក: "
            "ស្ពាន់ធ័រឌីអុកស៊ីត (__LG_TOK_3__) <__LG_TOK_4__ >។"
        ),
        "categories": "អាហារសម្រន់ ; ផ្លែឈើក្រៀម // ផ្អែកលើរុក្ខជាតិ",
    },
}


class OfflineMockCandidateRunner(CandidateRunner):
    """Deterministic structural verification through the production translation path."""

    def run_item(self, item: BenchmarkItem) -> CandidateOutput:
        return _run_through_production_path(
            item,
            self.config,
            _DeterministicProvider(
                OFFLINE_FIXTURE_TRANSLATIONS.get(item.item_id),
                behavior=item.offline_provider_behavior,
            ),
            measurement_mode="offline",
        )


class GeminiLiveCandidateRunner(CandidateRunner):
    """Live measurements through the production Gemini adapter and translation path."""

    def __init__(self, config: CandidateModelConfig, api_key: str) -> None:
        super().__init__(config)
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for live candidate execution.")
        self._provider = GeminiTranslationAdapter(
            api_key=api_key,
            model=config.model_id,
            timeout_seconds=12.0,
        )

    def run_item(self, item: BenchmarkItem) -> CandidateOutput:
        return _run_through_production_path(
            item,
            self.config,
            self._provider,
            measurement_mode="live",
        )
