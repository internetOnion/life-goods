from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from lifegoods.product_lookup.contracts import ProductProjection
from lifegoods.translation.chunking import chunk_ingredients, join_ingredient_chunks
from lifegoods.translation.contracts import (
    FieldTranslationOutcome,
    ProductTranslationResult,
    TranslationFieldStatus,
    TranslationOverallStatus,
    TranslationProvenance,
)
from lifegoods.translation.deadline import TranslationDeadline
from lifegoods.translation.protection import (
    protect_tokens,
    restore_tokens,
)
from lifegoods.translation.provider import ProviderTranslationRequest, TranslationProvider
from lifegoods.translation.selection import (
    FieldSelection,
    classify_fields,
    extract_eligible_fields,
    overall_status,
    unavailable_result,
)
from lifegoods.translation.validator import validate_field_translation

TRANSLATION_CONFIG_VERSION = "v3"
PRODUCTION_PROVIDER = "google"
PRODUCTION_MODEL = "gemini-3.8-flash"
DEFAULT_MAX_INGREDIENT_CHUNK_CHARS = 800


def _evaluate_field_outcome(
    field_name: str,
    sel: FieldSelection,
    raw_input_text: str,
    raw_translation: str | None,
    t_map: dict[str, str],
    target_language: str,
) -> tuple[FieldTranslationOutcome, bool]:
    if not isinstance(raw_translation, str) or not raw_translation:
        return (
            FieldTranslationOutcome(
                field_name=field_name,
                status=TranslationFieldStatus.TRANSLATION_UNAVAILABLE,
                selected_original_text=sel.selected_text,
                original_texts=sel.all_texts,
                khmer_translation=None,
                failure_reason="Missing translation in provider response",
            ),
            False,
        )

    restored = restore_tokens(raw_translation, t_map)
    val_errors = validate_field_translation(
        input_text=raw_input_text,
        raw_response_text=raw_translation,
        restored_text=restored,
        token_map=t_map,
        target_language=target_language,
    )

    if val_errors:
        return (
            FieldTranslationOutcome(
                field_name=field_name,
                status=TranslationFieldStatus.TRANSLATION_UNAVAILABLE,
                selected_original_text=sel.selected_text,
                original_texts=sel.all_texts,
                khmer_translation=None,
                failure_reason="; ".join(val_errors),
            ),
            False,
        )

    return (
        FieldTranslationOutcome(
            field_name=field_name,
            status=TranslationFieldStatus.GENERATED,
            selected_original_text=sel.selected_text,
            original_texts=sel.all_texts,
            khmer_translation=restored,
        ),
        True,
    )


class KhmerTranslationModule:
    def __init__(
        self,
        provider: TranslationProvider | None,
        *,
        config_version: str = TRANSLATION_CONFIG_VERSION,
        max_ingredient_chunk_chars: int = DEFAULT_MAX_INGREDIENT_CHUNK_CHARS,
    ) -> None:
        self._provider = provider
        self._config_version = config_version
        self._model = provider.model if provider else PRODUCTION_MODEL
        self._provider_name = provider.provider_name if provider else PRODUCTION_PROVIDER
        self._max_ingredient_chunk_chars = max_ingredient_chunk_chars

    @property
    def generation_enabled(self) -> bool:
        return self._provider is not None

    def compute_translation_identity(
        self,
        product: ProductProjection,
        *,
        target_language: str = "kh",
    ) -> tuple[str, str, bool]:
        selections = extract_eligible_fields(product)
        brands = [b.strip() for b in product.identity.brands if b and b.strip()]
        has_translatable = any(
            field.status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE
            for field in classify_fields(product).values()
        )

        canonical_content = {
            "fields": {
                name: {
                    "value": sel.selected_text.value if sel.selected_text else None,
                    "source_field": (sel.selected_text.source_field if sel.selected_text else None),
                    "language": (sel.selected_text.language if sel.selected_text else None),
                }
                for name, sel in selections.items()
            },
            "brands": sorted(brands),
        }
        content_hash = hashlib.sha256(
            json.dumps(canonical_content, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()

        canonical_config = {
            "target_language": target_language,
            "config_version": self._config_version,
            "provider": self._provider_name,
            "model": self._model,
            "selection_version": "v2",
            "chunking_version": "v1",
            "max_ingredient_chunk_chars": self._max_ingredient_chunk_chars,
            "protection_version": "v1",
            "prompt_version": "v2",
            "schema_version": "v2",
            "validator_version": "v2",
            "temperature": 0.0,
        }
        config_fingerprint = hashlib.sha256(
            json.dumps(canonical_config, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()

        return content_hash, config_fingerprint, has_translatable

    def translate_product(
        self,
        product: ProductProjection,
        *,
        target_language: str = "kh",
        deadline: TranslationDeadline | None = None,
    ) -> ProductTranslationResult:
        fields = classify_fields(product)
        selections = extract_eligible_fields(product)
        brands = [b.strip() for b in product.identity.brands if b and b.strip()]

        raw_inputs: dict[str, str] = {}
        masked_inputs: dict[str, str] = {}
        token_maps: dict[str, dict[str, str]] = {}
        ingredient_chunk_keys: list[str] = []
        ingredient_chunks_raw: list[str] = []

        for field_name in selections:
            sel = selections[field_name]
            if fields[field_name].status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE:
                assert sel.selected_text is not None
                raw_text = sel.selected_text.value
                raw_inputs[field_name] = raw_text

                if field_name == "ingredients_text":
                    chunks = chunk_ingredients(raw_text, self._max_ingredient_chunk_chars)
                    if len(chunks) > 1:
                        ingredient_chunks_raw = chunks
                        for idx, chunk_text in enumerate(chunks):
                            chunk_key = f"ingredients_text_chunk_{idx}"
                            ingredient_chunk_keys.append(chunk_key)
                            prot = protect_tokens(chunk_text, brands)
                            masked_inputs[chunk_key] = prot.masked_text
                            token_maps[chunk_key] = prot.token_map
                        continue

                prot = protect_tokens(raw_text, brands)
                masked_inputs[field_name] = prot.masked_text
                token_maps[field_name] = prot.token_map

        content_hash, config_fingerprint, _ = self.compute_translation_identity(
            product, target_language=target_language
        )

        if not masked_inputs:
            return ProductTranslationResult(
                overall_status=TranslationOverallStatus.NOT_NEEDED,
                fields=fields,
                content_hash=content_hash,
                config_fingerprint=config_fingerprint,
                provenance=None,
                raw_input={},
                masked_input={},
                token_maps={},
            )

        if self._provider is None:
            return unavailable_result(
                product, content_hash, config_fingerprint, "Provider is not configured"
            )

        deadline = deadline or TranslationDeadline()
        deadline.remaining()
        # Call provider
        request = ProviderTranslationRequest(
            deadline=deadline,
            fields=masked_inputs,
            target_language=target_language,
        )
        provider = self._provider
        response = deadline.run(lambda: provider.translate(request))

        now_iso = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        provenance = TranslationProvenance(
            machine_generated=True,
            provider=self._provider_name,
            model=self._model,
            configuration_version=self._config_version,
            generated_at=now_iso,
        )

        if response.status != "success" or not isinstance(response.translations, dict):
            return unavailable_result(
                product,
                content_hash,
                config_fingerprint,
                response.error_message or "Provider translation error",
            )

        generated_count = 0

        # Handle non-chunked fields
        for field_name in selections:
            if field_name == "ingredients_text" or field_name not in masked_inputs:
                continue
            outcome, is_gen = _evaluate_field_outcome(
                field_name=field_name,
                sel=selections[field_name],
                raw_input_text=raw_inputs[field_name],
                raw_translation=response.translations.get(field_name),
                t_map=token_maps[field_name],
                target_language=target_language,
            )
            fields[field_name] = outcome
            if is_gen:
                generated_count += 1

        # Handle ingredients_text (single or chunked)
        if "ingredients_text" in raw_inputs:
            sel = selections["ingredients_text"]
            if not ingredient_chunk_keys:
                outcome, is_gen = _evaluate_field_outcome(
                    field_name="ingredients_text",
                    sel=sel,
                    raw_input_text=raw_inputs["ingredients_text"],
                    raw_translation=response.translations.get("ingredients_text"),
                    t_map=token_maps["ingredients_text"],
                    target_language=target_language,
                )
                fields["ingredients_text"] = outcome
                if is_gen:
                    generated_count += 1
            else:
                restored_chunks: list[str] = []
                chunk_errors: list[str] = []
                for idx, chunk_key in enumerate(ingredient_chunk_keys):
                    raw_chunk = response.translations.get(chunk_key)
                    t_map = token_maps[chunk_key]
                    chunk_raw_text = ingredient_chunks_raw[idx]
                    if not isinstance(raw_chunk, str) or not raw_chunk:
                        chunk_errors.append(f"Missing translation for {chunk_key}")
                        continue
                    restored_c = restore_tokens(raw_chunk, t_map)
                    val_errs = validate_field_translation(
                        input_text=chunk_raw_text,
                        raw_response_text=raw_chunk,
                        restored_text=restored_c,
                        token_map=t_map,
                        target_language=target_language,
                    )
                    if val_errs:
                        chunk_errors.extend(val_errs)
                    else:
                        restored_chunks.append(restored_c)

                if chunk_errors or len(restored_chunks) != len(ingredient_chunk_keys):
                    fields["ingredients_text"] = FieldTranslationOutcome(
                        field_name="ingredients_text",
                        status=TranslationFieldStatus.TRANSLATION_UNAVAILABLE,
                        selected_original_text=sel.selected_text,
                        original_texts=sel.all_texts,
                        khmer_translation=None,
                        failure_reason="; ".join(chunk_errors) or "Failed chunk validation",
                    )
                else:
                    joined = join_ingredient_chunks(restored_chunks)
                    fields["ingredients_text"] = FieldTranslationOutcome(
                        field_name="ingredients_text",
                        status=TranslationFieldStatus.GENERATED,
                        selected_original_text=sel.selected_text,
                        original_texts=sel.all_texts,
                        khmer_translation=joined,
                    )
                    generated_count += 1

        return ProductTranslationResult(
            overall_status=overall_status(fields),
            fields=fields,
            content_hash=content_hash,
            config_fingerprint=config_fingerprint,
            provenance=provenance if generated_count else None,
            raw_input=raw_inputs,
            masked_input=masked_inputs,
            token_maps=token_maps,
        )
