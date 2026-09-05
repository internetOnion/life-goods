import re
from typing import NamedTuple

from lifegoods.product_lookup.contracts import OriginalText, ProductProjection

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

    # 1. Check for explicit language == "km"
    for t in valid_texts:
        lang = (t.language or "").lower()
        if lang == "km" or lang.startswith("km-"):
            return FieldSelection(selected_text=t, all_texts=valid_texts, is_source_khmer=True)

    # 2. Check for text with predominantly Khmer script
    for t in valid_texts:
        if is_predominantly_khmer_script(t.value):
            return FieldSelection(selected_text=t, all_texts=valid_texts, is_source_khmer=True)

    # 3. Prefer record's declared language
    if record_language:
        rec_lang_lower = record_language.lower()
        for t in valid_texts:
            lang = (t.language or "").lower()
            if lang == rec_lang_lower:
                return FieldSelection(selected_text=t, all_texts=valid_texts, is_source_khmer=False)

    # 4. Prefer English
    for t in valid_texts:
        lang = (t.language or "").lower()
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



def extract_eligible_fields(
    product: ProductProjection,
) -> dict[str, FieldSelection]:
    record_language = product.source.record_language if product.source else None

    # 1. Product name
    name_selection = select_field_original_text(
        product.identity.names,
        record_language=record_language,
    )

    # 2. Generic name
    generic_selection = select_field_original_text(
        product.identity.generic_names,
        record_language=record_language,
    )

    # 3. Ingredients text
    ingredients_selection = select_field_original_text(
        product.ingredients,
        record_language=record_language,
    )

    # 4. Categories (from human-readable categories)
    categories_selection: FieldSelection
    if product.categories:
        non_empty = [c.strip() for c in product.categories if c and c.strip()]
        if non_empty:
            cat_text = ", ".join(non_empty)
            cat_orig = OriginalText(
                value=cat_text,
                language=record_language or "und",
                source_field="categories",
            )
            is_khmer = is_predominantly_khmer_script(cat_text) or (
                (record_language or "").lower().startswith("km")
            )
            categories_selection = FieldSelection(
                selected_text=cat_orig,
                all_texts=[cat_orig],
                is_source_khmer=is_khmer,
            )
        else:
            categories_selection = FieldSelection(
                selected_text=None, all_texts=[], is_source_khmer=False
            )
    else:
        categories_selection = FieldSelection(
            selected_text=None, all_texts=[], is_source_khmer=False
        )

    return {
        "product_name": name_selection,
        "generic_name": generic_selection,
        "ingredients_text": ingredients_selection,
        "categories": categories_selection,
    }
