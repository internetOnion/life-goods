from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from lifegoods.translation.benchmark.dataset import BenchmarkDataset, BenchmarkItem
from lifegoods.translation.benchmark.protection import protect_tokens, restore_tokens

SYSTEM_INSTRUCTION = """You are an expert packaged-food translator localizing Product data
for Khmer-speaking Shoppers in Cambodia.
Translate the provided food Product fields into natural, clear, accurate Khmer.
Rules:
1. Preserve all placeholders formatted as __LG_TOK_n__ EXACTLY as they appear.
   Do not translate, drop, or alter placeholders.
2. Keep Product and brand names in their intended form.
3. Keep ingredient lists natural, preserving comma separation and ingredient hierarchy.
4. Return a JSON object with a 'translations' object mapping each field_name to its Khmer text.
"""


@dataclass(frozen=True)
class CandidateModelConfig:
    name: str
    provider: str
    model_id: str
    temperature: float = 0.0
    max_output_tokens: int = 2048
    input_cost_per_1m: float = 0.15
    output_cost_per_1m: float = 0.60

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        in_cost = (input_tokens / 1_000_000.0) * self.input_cost_per_1m
        out_cost = (output_tokens / 1_000_000.0) * self.output_cost_per_1m
        return round(in_cost + out_cost, 6)


CANDIDATE_CONFIGS: dict[str, CandidateModelConfig] = {
    "gemini-2.5-flash": CandidateModelConfig(
        name="gemini-2.5-flash",
        provider="google",
        model_id="gemini-2.5-flash",
        temperature=0.0,
        max_output_tokens=2048,
        input_cost_per_1m=0.15,
        output_cost_per_1m=0.60,
    ),
    "gemini-2.5-pro": CandidateModelConfig(
        name="gemini-2.5-pro",
        provider="google",
        model_id="gemini-2.5-pro",
        temperature=0.0,
        max_output_tokens=2048,
        input_cost_per_1m=1.25,
        output_cost_per_1m=5.00,
    ),
    "gemini-1.5-flash": CandidateModelConfig(
        name="gemini-1.5-flash",
        provider="google",
        model_id="gemini-1.5-flash",
        temperature=0.0,
        max_output_tokens=2048,
        input_cost_per_1m=0.075,
        output_cost_per_1m=0.30,
    ),
    "gemini-1.5-pro": CandidateModelConfig(
        name="gemini-1.5-pro",
        provider="google",
        model_id="gemini-1.5-pro",
        temperature=0.0,
        max_output_tokens=2048,
        input_cost_per_1m=1.25,
        output_cost_per_1m=5.00,
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


def build_candidate_prompt(item: BenchmarkItem) -> dict[str, Any]:
    fields_to_translate: list[dict[str, Any]] = []

    for f in item.fields:
        if f.expected_status != "generated" or not f.original_text:
            continue
        protected = protect_tokens(f.original_text, item.brands)
        fields_to_translate.append(
            {
                "field_name": f.field_name,
                "original_text": f.original_text,
                "masked_text": protected.masked_text,
                "token_map": protected.token_map,
                "protected_tokens": protected.protected_tokens,
            }
        )

    return {
        "system_instruction": SYSTEM_INSTRUCTION,
        "fields_to_translate": fields_to_translate,
    }


@dataclass
class CandidateOutput:
    item_id: str
    candidate_name: str
    translations: dict[str, str] = field(default_factory=dict)
    masked_translations: dict[str, str] = field(default_factory=dict)
    token_maps: dict[str, dict[str, str]] = field(default_factory=dict)
    raw_response: str = ""
    latency_ms: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0
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
    """Deterministic offline runner for testing the evaluation harness in CI
    with zero network calls."""

    def run_item(self, item: BenchmarkItem) -> CandidateOutput:
        start_time = time.perf_counter()
        prompt_data = build_candidate_prompt(item)
        fields_to_translate = prompt_data["fields_to_translate"]

        token_maps: dict[str, dict[str, str]] = {}
        masked_translations: dict[str, str] = {}
        restored_translations: dict[str, str] = {}

        if not fields_to_translate:
            # Nothing to translate (e.g. source_khmer_available)
            return CandidateOutput(
                item_id=item.item_id,
                candidate_name=self.config.name,
                translations={},
                masked_translations={},
                token_maps={},
                raw_response="{}",
                latency_ms=1.0,
                input_tokens=0,
                output_tokens=0,
                estimated_cost_usd=0.0,
                status="success",
            )

        fixture_dict = OFFLINE_FIXTURE_TRANSLATIONS.get(item.item_id, {})

        for f in fields_to_translate:
            field_name = f["field_name"]
            token_map = f["token_map"]
            token_maps[field_name] = token_map

            # Use fixture translation if available, otherwise synthetic fallback
            masked_khmer = fixture_dict.get(field_name)
            if not masked_khmer:
                # Synthetic Khmer string with tokens preserved
                tokens_in_order = list(token_map.keys())
                tok_str = " ".join(tokens_in_order)
                masked_khmer = f"ការបកប្រែជាភាសាខ្មែរ {tok_str}".strip()

            masked_translations[field_name] = masked_khmer
            restored = restore_tokens(masked_khmer, token_map)
            restored_translations[field_name] = restored

        elapsed_ms = (
            time.perf_counter() - start_time
        ) * 1000.0 + 120.0  # simulate realistic latency
        # Estimate token usage
        prompt_chars = sum(len(f["masked_text"]) for f in fields_to_translate)
        out_chars = sum(len(t) for t in restored_translations.values())
        input_tokens = max(1, prompt_chars // 4) + 150
        output_tokens = max(1, out_chars // 4)

        total_cost = self.config.calculate_cost(input_tokens, output_tokens)

        return CandidateOutput(
            item_id=item.item_id,
            candidate_name=self.config.name,
            translations=restored_translations,
            masked_translations=masked_translations,
            token_maps=token_maps,
            raw_response=json.dumps({"translations": masked_translations}, ensure_ascii=False),
            latency_ms=round(elapsed_ms, 2),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=total_cost,
            status="success",
        )


class GeminiLiveCandidateRunner(CandidateRunner):
    """Live runner executing requests against Google Gemini API with explicit credentials."""

    def __init__(self, config: CandidateModelConfig, api_key: str) -> None:
        super().__init__(config)
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for live candidate execution.")
        self.api_key = api_key

    def run_item(self, item: BenchmarkItem) -> CandidateOutput:
        import urllib.error
        import urllib.request

        prompt_data = build_candidate_prompt(item)
        fields_to_translate = prompt_data["fields_to_translate"]

        if not fields_to_translate:
            return CandidateOutput(
                item_id=item.item_id,
                candidate_name=self.config.name,
                translations={},
                masked_translations={},
                token_maps={},
                raw_response="{}",
                latency_ms=0.0,
                input_tokens=0,
                output_tokens=0,
                estimated_cost_usd=0.0,
                status="success",
            )

        token_maps = {f["field_name"]: f["token_map"] for f in fields_to_translate}
        user_prompt_data = {f["field_name"]: f["masked_text"] for f in fields_to_translate}

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.config.model_id}:generateContent?key={self.api_key}"
        )
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": json.dumps(user_prompt_data, ensure_ascii=False)}]}],
            "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": self.config.max_output_tokens,
                "responseMimeType": "application/json",
            },
        }
        req_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=req_data,
            headers=headers,
            method="POST",
        )

        start = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                body = resp.read().decode("utf-8")
                res_json = json.loads(body)

                usage = res_json.get("usageMetadata", {})
                in_tokens = usage.get("promptTokenCount", 0)
                out_tokens = usage.get("candidatesTokenCount", 0)

                total_cost = self.config.calculate_cost(in_tokens, out_tokens)

                candidates = res_json.get("candidates", [])
                if not candidates:
                    return CandidateOutput(
                        item_id=item.item_id,
                        candidate_name=self.config.name,
                        latency_ms=elapsed_ms,
                        status="error",
                        error_message="No candidates returned from Gemini API",
                    )

                content_text = (
                    candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                )
                parsed = json.loads(content_text)
                # Handle direct dict or nested translations dict
                raw_dict = parsed.get("translations", parsed) if isinstance(parsed, dict) else {}

                masked_translations: dict[str, str] = {}
                restored_translations: dict[str, str] = {}

                for f_name, t_map in token_maps.items():
                    val = raw_dict.get(f_name, "")
                    masked_translations[f_name] = val
                    restored_translations[f_name] = restore_tokens(val, t_map)

                return CandidateOutput(
                    item_id=item.item_id,
                    candidate_name=self.config.name,
                    translations=restored_translations,
                    masked_translations=masked_translations,
                    token_maps=token_maps,
                    raw_response=content_text,
                    latency_ms=round(elapsed_ms, 2),
                    input_tokens=in_tokens,
                    output_tokens=out_tokens,
                    estimated_cost_usd=total_cost,
                    status="success",
                )
        except urllib.error.HTTPError as e:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            err_body = e.read().decode("utf-8", errors="replace")
            return CandidateOutput(
                item_id=item.item_id,
                candidate_name=self.config.name,
                raw_response=err_body,
                latency_ms=round(elapsed_ms, 2),
                status="error",
                error_message=f"HTTP {e.code}: {err_body}",
            )
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            return CandidateOutput(
                item_id=item.item_id,
                candidate_name=self.config.name,
                latency_ms=round(elapsed_ms, 2),
                status="error",
                error_message=str(e),
            )
