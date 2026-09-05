from enum import StrEnum

from pydantic import BaseModel, Field


class OriginalText(BaseModel):
    value: str
    language: str | None = None
    source_field: str


class TranslationFieldStatus(StrEnum):
    NOT_REQUESTED = "not_requested"
    SOURCE_KHMER_AVAILABLE = "source_khmer_available"
    GENERATED = "generated"
    SOURCE_DATA_UNAVAILABLE = "source_data_unavailable"
    TRANSLATION_UNAVAILABLE = "translation_unavailable"


class TranslationOverallStatus(StrEnum):
    NOT_REQUESTED = "not_requested"
    NOT_NEEDED = "not_needed"
    COMPLETE = "complete"
    PARTIAL = "partial"
    UNAVAILABLE = "unavailable"



class FieldTranslationOutcome(BaseModel):
    field_name: str
    status: TranslationFieldStatus
    selected_original_text: OriginalText | None = None
    original_texts: list[OriginalText] = Field(default_factory=list)
    khmer_translation: str | None = None
    failure_reason: str | None = None


class TranslationProvenance(BaseModel):
    machine_generated: bool = True
    provider: str
    model: str
    configuration_version: str
    generated_at: str


class ProductTranslationResult(BaseModel):
    overall_status: TranslationOverallStatus
    fields: dict[str, FieldTranslationOutcome]
    content_hash: str
    config_fingerprint: str
    provenance: TranslationProvenance | None = None
    raw_input: dict[str, str] = Field(default_factory=dict)
    masked_input: dict[str, str] = Field(default_factory=dict)
    token_maps: dict[str, dict[str, str]] = Field(default_factory=dict)

