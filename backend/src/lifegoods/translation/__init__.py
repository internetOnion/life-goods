"""Khmer Translation module for Life Goods."""

from lifegoods.translation.chunking import chunk_ingredients, join_ingredient_chunks
from lifegoods.translation.contracts import (
    FieldTranslationOutcome,
    ProductTranslationResult,
    TranslationFieldStatus,
    TranslationOverallStatus,
    TranslationProvenance,
)
from lifegoods.translation.gemini import GeminiTranslationAdapter
from lifegoods.translation.module import (
    PRODUCTION_MODEL,
    PRODUCTION_PROVIDER,
    TRANSLATION_CONFIG_VERSION,
    KhmerTranslationModule,
)
from lifegoods.translation.protection import (
    ProtectionResult,
    TokenValidationResult,
    protect_tokens,
    restore_tokens,
    validate_token_preservation,
)
from lifegoods.translation.provider import (
    FakeTranslationProvider,
    ProviderTranslationRequest,
    ProviderTranslationResponse,
    TranslationProvider,
)
from lifegoods.translation.selection import (
    ELIGIBLE_FIELDS,
    FieldSelection,
    extract_eligible_fields,
    is_predominantly_khmer_script,
    select_field_original_text,
)
from lifegoods.translation.validator import validate_field_translation

__all__ = [
    "ELIGIBLE_FIELDS",
    "FakeTranslationProvider",
    "FieldSelection",
    "FieldTranslationOutcome",
    "GeminiTranslationAdapter",
    "KhmerTranslationModule",
    "PRODUCTION_MODEL",
    "PRODUCTION_PROVIDER",
    "ProductTranslationResult",
    "ProtectionResult",
    "ProviderTranslationRequest",
    "ProviderTranslationResponse",
    "TRANSLATION_CONFIG_VERSION",
    "TokenValidationResult",
    "TranslationFieldStatus",
    "TranslationOverallStatus",
    "TranslationProvenance",
    "TranslationProvider",
    "chunk_ingredients",
    "extract_eligible_fields",
    "is_predominantly_khmer_script",
    "join_ingredient_chunks",
    "protect_tokens",
    "restore_tokens",
    "select_field_original_text",
    "validate_field_translation",
    "validate_token_preservation",
]
