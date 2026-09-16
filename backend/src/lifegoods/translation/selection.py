from __future__ import annotations

import re
from collections.abc import Callable
from itertools import chain
from typing import TYPE_CHECKING, NamedTuple

from lifegoods.translation.contracts import (
    FieldTranslationOutcome,
    OriginalText,
    ProductTranslationResult,
    TranslationFieldStatus,
    TranslationOverallStatus,
)
from lifegoods.translation.protection import PLACEHOLDER_REGEX, protect_tokens

if TYPE_CHECKING:
    from lifegoods.product_lookup.contracts import ProductProjection, TranslatableField

KHMER_CHAR_REGEX = re.compile(r"[\u1780-\u17FF\u19E0-\u19FF]")
WORD_CHAR_REGEX = re.compile(r"[\w]", re.UNICODE)


def is_predominantly_khmer_script(text: str) -> bool:
    if not text:
        return False
    khmer_count = len(KHMER_CHAR_REGEX.findall(text))
    if khmer_count == 0:
        return False
    word_count = len(WORD_CHAR_REGEX.findall(text))
    if word_count == 0:
        return True
    return (khmer_count / word_count) >= 0.5


class FieldSelection(NamedTuple):
    selected_text: OriginalText | None
    all_texts: list[OriginalText]
    is_source_khmer: bool


def select_field_original_text(
    texts: list[OriginalText],
    record_language: str | None = None,
) -> FieldSelection:
    valid_texts = [t for t in texts if t.value and t.value.strip()]
    if not valid_texts:
        return FieldSelection(selected_text=None, all_texts=[], is_source_khmer=False)

    # 1. Check for an explicit ISO 639-1 Khmer language tag.
    for t in valid_texts:
        lang = (t.language or "").lower().replace("_", "-")
        if lang == "km" or lang.startswith("km-"):
            return FieldSelection(selected_text=t, all_texts=valid_texts, is_source_khmer=True)

    # 2. Check for text with predominantly Khmer script
    for t in valid_texts:
        if is_predominantly_khmer_script(t.value):
            return FieldSelection(selected_text=t, all_texts=valid_texts, is_source_khmer=True)

    # 3. Prefer record's declared language
    if record_language:
        rec_lang_lower = record_language.lower().replace("_", "-")
        for t in valid_texts:
            lang = (t.language or "").lower().replace("_", "-")
            if lang == rec_lang_lower:
                return FieldSelection(selected_text=t, all_texts=valid_texts, is_source_khmer=False)

    # 4. Prefer English
    for t in valid_texts:
        lang = (t.language or "").lower().replace("_", "-")
        if lang == "en" or lang.startswith("en-"):
            return FieldSelection(selected_text=t, all_texts=valid_texts, is_source_khmer=False)

    # 5. Deterministic fallback: sort by language, then source_field
    sorted_texts = sorted(
        valid_texts,
        key=lambda x: (x.language or "zzz", x.source_field or "zzz", x.value),
    )
    return FieldSelection(
        selected_text=sorted_texts[0], all_texts=valid_texts, is_source_khmer=False
    )


class EligibleField(NamedTuple):
    name: str
    originals: Callable[[ProductProjection], list[OriginalText]]
    target: Callable[[ProductProjection], TranslatableField]


ELIGIBLE_FIELDS = (
    EligibleField("product_name", lambda p: p.identity.names, lambda p: p.identity.name),
    EligibleField(
        "generic_name", lambda p: p.identity.generic_names, lambda p: p.identity.generic_name
    ),
    EligibleField("ingredients_text", lambda p: p.ingredients, lambda p: p.ingredients_text),
)


def translatable_items(product: ProductProjection):
    component_items = (
        field
        for component in product.packaging.components
        for field in (
            component.shape_field,
            component.material_field,
            component.recycling_field,
        )
        if field is not None
    )
    return chain(
        product.storage_instruction_items,
        product.packaging.description_items,
        product.packaging.recycling_instruction_items,
        component_items,
        product.category_items,
    )


def extract_eligible_fields(product: ProductProjection) -> dict[str, FieldSelection]:
    result = {
        field.name: select_field_original_text(
            field.originals(product), record_language=product.source.record_language
        )
        for field in ELIGIBLE_FIELDS
    }
    for item in translatable_items(product):
        result[item.key] = select_field_original_text(
            item.original_texts, record_language=product.source.record_language
        )
    return result


def is_original_text_preserved(field_name: str, raw_text: str, brands: list[str]) -> bool:
    without_placeholders = PLACEHOLDER_REGEX.sub("", protect_tokens(raw_text, brands).masked_text)
    return field_name == "product_name" and not re.search(r"\w", without_placeholders)


def assemble_legacy_categories_outcome(
    product: ProductProjection,
    fields: dict[str, FieldTranslationOutcome],
) -> FieldTranslationOutcome:
    categories_selection = select_field_original_text(
        product.categories_text.original_texts,
        record_language=product.source.record_language,
    )
    if not product.category_items:
        return FieldTranslationOutcome(
            field_name="categories",
            status=TranslationFieldStatus.SOURCE_DATA_UNAVAILABLE,
            selected_original_text=categories_selection.selected_text,
            original_texts=product.categories_text.original_texts,
            khmer_translation=None,
        )

    usable_texts: list[str] = []
    has_generated = False
    has_source_khmer = False
    has_unavailable = False

    for item in product.category_items:
        outcome = fields.get(item.key)
        status = outcome.status if outcome is not None else item.translation_status
        if status == TranslationFieldStatus.GENERATED and outcome and outcome.khmer_translation:
            usable_texts.append(outcome.khmer_translation)
            has_generated = True
        elif status in (
            TranslationFieldStatus.SOURCE_KHMER_AVAILABLE,
            TranslationFieldStatus.ORIGINAL_TEXT_PRESERVED,
        ):
            val = item.selected_original_text.value if item.selected_original_text else ""
            if val:
                usable_texts.append(val)
                if status == TranslationFieldStatus.SOURCE_KHMER_AVAILABLE:
                    has_source_khmer = True
            else:
                has_unavailable = True
        else:
            has_unavailable = True

    if not has_unavailable and len(usable_texts) == len(product.category_items):
        assembled = ", ".join(usable_texts)
        if has_generated:
            status = TranslationFieldStatus.GENERATED
            khmer_translation = assembled
        elif has_source_khmer:
            status = TranslationFieldStatus.SOURCE_KHMER_AVAILABLE
            khmer_translation = None
        else:
            status = TranslationFieldStatus.ORIGINAL_TEXT_PRESERVED
            khmer_translation = None

        return FieldTranslationOutcome(
            field_name="categories",
            status=status,
            selected_original_text=categories_selection.selected_text,
            original_texts=product.categories_text.original_texts,
            khmer_translation=khmer_translation,
        )
    else:
        return FieldTranslationOutcome(
            field_name="categories",
            status=TranslationFieldStatus.TRANSLATION_UNAVAILABLE,
            selected_original_text=categories_selection.selected_text,
            original_texts=product.categories_text.original_texts,
            khmer_translation=None,
            failure_reason="One or more category items failed translation",
        )


def classify_fields(product: ProductProjection) -> dict[str, FieldTranslationOutcome]:
    fields = {}
    item_by_key = {item.key: item for item in translatable_items(product)}
    for name, selection in extract_eligible_fields(product).items():
        selected = selection.selected_text
        source_item = item_by_key.get(name)
        if (
            source_item is not None
            and source_item.translation_status == TranslationFieldStatus.GENERATED
            and source_item.khmer_translation
        ):
            status = TranslationFieldStatus.GENERATED
            khmer_translation = source_item.khmer_translation
        elif selected is None:
            status = TranslationFieldStatus.SOURCE_DATA_UNAVAILABLE
            khmer_translation = None
        elif selection.is_source_khmer:
            status = TranslationFieldStatus.SOURCE_KHMER_AVAILABLE
            khmer_translation = None
        elif is_original_text_preserved(name, selected.value, product.identity.brands):
            status = TranslationFieldStatus.ORIGINAL_TEXT_PRESERVED
            khmer_translation = None
        else:
            status = TranslationFieldStatus.TRANSLATION_UNAVAILABLE
            khmer_translation = None
        fields[name] = FieldTranslationOutcome(
            field_name=name,
            status=status,
            selected_original_text=selected,
            original_texts=selection.all_texts,
            khmer_translation=khmer_translation,
        )
    fields["categories"] = assemble_legacy_categories_outcome(product, fields)
    return fields


def overall_status(fields: dict[str, FieldTranslationOutcome]) -> TranslationOverallStatus:
    generated = any(f.status == TranslationFieldStatus.GENERATED for f in fields.values())
    unavailable = any(
        f.status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE for f in fields.values()
    )
    if generated:
        return (
            TranslationOverallStatus.PARTIAL if unavailable else TranslationOverallStatus.COMPLETE
        )
    return (
        TranslationOverallStatus.UNAVAILABLE if unavailable else TranslationOverallStatus.NOT_NEEDED
    )


def unavailable_result(
    product: ProductProjection,
    content_hash: str = "",
    config_fingerprint: str = "",
    reason: str = "Translation unavailable",
) -> ProductTranslationResult:
    fields = classify_fields(product)
    for field in fields.values():
        if field.status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE:
            field.failure_reason = reason
    return ProductTranslationResult(
        overall_status=overall_status(fields),
        fields=fields,
        content_hash=content_hash,
        config_fingerprint=config_fingerprint,
    )
