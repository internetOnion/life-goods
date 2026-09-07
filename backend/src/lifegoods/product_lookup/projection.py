import re
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

from lifegoods.product_lookup.contracts import (
    EnvironmentProjection,
    GradedSourceAssessment,
    NovaSourceAssessment,
    NutritionAmount,
    NutritionProjection,
    NutritionRow,
    OriginalText,
    PackagingComponent,
    PackagingProjection,
    ProductIdentityProjection,
    ProductLookupMetaResponse,
    ProductProjection,
    SourceAssessmentsProjection,
    SourceImage,
    SourceRecordMetadataProjection,
    TranslatableField,
)
from lifegoods.translation.selection import (
    ELIGIBLE_FIELDS,
    extract_eligible_fields,
)

NUTRITION_NUTRIENTS: tuple[tuple[str, str], ...] = (
    ("energy-kj", "Energy"),
    ("energy-kcal", "Energy"),
    ("fat", "Fat"),
    ("saturated-fat", "Saturated fat"),
    ("monounsaturated-fat", "Monounsaturated fat"),
    ("polyunsaturated-fat", "Polyunsaturated fat"),
    ("carbohydrates", "Carbohydrates"),
    ("sugars", "Sugars"),
    ("starch", "Starch"),
    ("fiber", "Fiber"),
    ("proteins", "Protein"),
    ("salt", "Salt"),
    ("sodium", "Sodium"),
    ("alcohol", "Alcohol"),
    ("cholesterol", "Cholesterol"),
    ("vitamin-a", "Vitamin A"),
    ("vitamin-b1", "Vitamin B1"),
    ("vitamin-b2", "Vitamin B2"),
    ("vitamin-b6", "Vitamin B6"),
    ("vitamin-b9", "Vitamin B9"),
    ("vitamin-b12", "Vitamin B12"),
    ("vitamin-c", "Vitamin C"),
    ("vitamin-d", "Vitamin D"),
    ("vitamin-e", "Vitamin E"),
    ("vitamin-k", "Vitamin K"),
    ("calcium", "Calcium"),
    ("iron", "Iron"),
    ("magnesium", "Magnesium"),
    ("phosphorus", "Phosphorus"),
    ("potassium", "Potassium"),
    ("zinc", "Zinc"),
    ("copper", "Copper"),
    ("manganese", "Manganese"),
    ("selenium", "Selenium"),
    ("iodine", "Iodine"),
    ("caffeine", "Caffeine"),
    ("taurine", "Taurine"),
)

LANGUAGE_CODE_PATTERN = re.compile(r"^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$", re.IGNORECASE)
TAXONOMY_TAG_PREFIX = re.compile(r"^[a-z]{2,3}:", re.IGNORECASE)
TAXONOMY_TAG_SEPARATORS = re.compile(r"[-_]+")
BARCODE_SPLIT_PATTERN = re.compile(r"^(\d{3})(\d{3})(\d{3})(\d+)$")


def _is_record(value: Any) -> bool:
    return isinstance(value, dict)


def _text_value(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _amount_value(value: Any) -> NutritionAmount | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    return _text_value(value)


def _http_url(value: Any) -> str | None:
    candidate = _text_value(value)
    if not candidate:
        return None
    try:
        parts = urlsplit(candidate)
        return candidate if parts.scheme in ("http", "https") and parts.netloc else None
    except Exception:
        return None


def _source_language(record: dict[str, Any]) -> str | None:
    lang = _text_value(record.get("lang"))
    if not lang:
        return None
    return lang


def _language_from_field(field: str, base_field: str) -> str | None:
    prefix = f"{base_field}_"
    if not field.startswith(prefix):
        return None
    suffix = field[len(prefix) :]
    if not LANGUAGE_CODE_PATTERN.match(suffix):
        return None
    return suffix


def _original_texts(
    record: dict[str, Any],
    base_field: str,
    record_language: str | None,
) -> list[OriginalText]:
    result: list[OriginalText] = []
    seen: set[tuple[str | None, str]] = set()

    def add(val: Any, language: str | None, source_field: str) -> None:
        text = _text_value(val)
        if not text:
            return
        key = (language, text)
        if key in seen:
            return
        seen.add(key)
        result.append(OriginalText(value=text, language=language, source_field=source_field))

    add(record.get(base_field), record_language, base_field)
    for field, val in record.items():
        lang = _language_from_field(field, base_field)
        if lang:
            add(val, lang, field)
    return result


def _merge_original_texts(*groups: list[OriginalText]) -> list[OriginalText]:
    result: list[OriginalText] = []
    seen: set[tuple[str | None, str]] = set()
    for group in groups:
        for item in group:
            key = (item.language, item.value)
            if key not in seen:
                seen.add(key)
                result.append(item)
    return result


def _split_values(value: Any) -> list[str]:
    raw_list: list[Any] = value if isinstance(value, list) else [value]
    result: list[str] = []
    seen: set[str] = set()

    for item in raw_list:
        if not isinstance(item, str):
            continue
        for part in item.split(","):
            trimmed = part.strip()
            if trimmed and trimmed not in seen:
                seen.add(trimmed)
                result.append(trimmed)
    return result


def _display_taxonomy_tag(value: str) -> str:
    without_prefix = TAXONOMY_TAG_PREFIX.sub("", value)
    cleaned = TAXONOMY_TAG_SEPARATORS.sub(" ", without_prefix)
    return cleaned.strip()


def _display_taxonomy_value(value: Any) -> str | None:
    text = _text_value(value)
    return _display_taxonomy_tag(text) if text else None


def _unique_values(values: Iterable[str | None]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for val in values:
        if not val:
            continue
        key = val.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(val)
    return result


def _list_values(record: dict[str, Any], field: str, tag_field: str | None = None) -> list[str]:
    direct = _split_values(record.get(field))
    if direct or not tag_field:
        return direct
    result: list[str] = []
    seen: set[str] = set()
    for tag in _split_values(record.get(tag_field)):
        displayed = _display_taxonomy_tag(tag)
        if displayed and displayed not in seen:
            seen.add(displayed)
            result.append(displayed)
    return result


def _first_field_amount(
    record: dict[str, Any], fields: list[str]
) -> tuple[NutritionAmount, str] | None:
    for source_field in fields:
        val = _amount_value(record.get(source_field))
        if val is not None:
            return val, source_field
    return None


def _first_field_text(record: dict[str, Any], fields: list[str]) -> tuple[str, str] | None:
    for source_field in fields:
        val = _text_value(record.get(source_field))
        if val is not None:
            return val, source_field
    return None


def _extract_nutrition(record: dict[str, Any]) -> NutritionProjection:
    raw_nutriments = record.get("nutriments")
    nutriments: dict[str, Any] = raw_nutriments if isinstance(raw_nutriments, dict) else {}
    nutrition = record.get("nutrition") if _is_record(record.get("nutrition")) else None
    aggregated_set = (
        nutrition.get("aggregated_set")
        if nutrition and _is_record(nutrition.get("aggregated_set"))
        else None
    )
    aggregated_nutrients = (
        aggregated_set.get("nutrients")
        if aggregated_set and _is_record(aggregated_set.get("nutrients"))
        else {}
    )

    rows: list[NutritionRow] = []
    for key, label in NUTRITION_NUTRIENTS:
        aggregated_nutrient = (
            aggregated_nutrients.get(key) if _is_record(aggregated_nutrients.get(key)) else None
        )
        per_100g = _amount_value(nutriments.get(f"{key}_100g"))
        if per_100g is None and aggregated_nutrient:
            per_100g = _amount_value(aggregated_nutrient.get("value"))
        per_serving = _amount_value(nutriments.get(f"{key}_serving"))
        val = _amount_value(nutriments.get(f"{key}_value"))

        if per_100g is None and per_serving is None and val is None:
            continue

        unit = _text_value(nutriments.get(f"{key}_unit"))
        if unit is None and aggregated_nutrient:
            unit = _text_value(aggregated_nutrient.get("unit"))

        rows.append(
            NutritionRow(
                nutrient=key,
                label=label,
                per_100g=per_100g,
                per_serving=per_serving,
                value=val,
                unit=unit,
            )
        )

    basis = _text_value(record.get("nutrition_data_per")) or (
        _text_value(aggregated_set.get("per")) if aggregated_set else None
    )
    serving_size = _text_value(record.get("serving_size"))
    return NutritionProjection(basis=basis, serving_size=serving_size, rows=rows)


def _assessment_grade(record: dict[str, Any], fields: list[str]) -> tuple[str, str] | None:
    found = _first_field_text(record, fields)
    if not found:
        return None
    val, source_field = found
    if val.lower() in ("unknown", "not-applicable", "not_applicable", "not-computed"):
        return None
    return val, source_field


def _extract_assessments(record: dict[str, Any]) -> SourceAssessmentsProjection:
    raw_nutriments = record.get("nutriments")
    nutriments: dict[str, Any] = raw_nutriments if isinstance(raw_nutriments, dict) else {}
    nutri_grade = _assessment_grade(record, ["nutriscore_grade"])
    nutri_score = _first_field_amount(record, ["nutriscore_score"]) or (
        _first_field_amount(nutriments, ["nutrition-score-fr_100g"])
    )
    nutri_version = _first_field_text(record, ["nutriscore_version"])

    nova = _first_field_amount(record, ["nova_group"]) or (
        _first_field_amount(nutriments, ["nova-group_100g"])
    )

    green_grade = _assessment_grade(
        record,
        ["environmental_score_grade", "ecoscore_grade", "green_score_grade"],
    )
    green_score = _first_field_amount(
        record,
        ["environmental_score_score", "ecoscore_score", "green_score_score"],
    )
    green_version = _first_field_text(
        record,
        ["environmental_score_version", "ecoscore_version", "green_score_version"],
    )

    nutri_proj: GradedSourceAssessment | None = None
    if nutri_grade or nutri_score:
        nutri_source_fields = [
            item[1] for item in (nutri_grade, nutri_score, nutri_version) if item is not None
        ]
        nutri_proj = GradedSourceAssessment(
            grade=nutri_grade[0] if nutri_grade else None,
            score=nutri_score[0] if nutri_score else None,
            version=nutri_version[0] if nutri_version else None,
            source_fields=nutri_source_fields,
        )

    nova_proj: NovaSourceAssessment | None = None
    if nova:
        nova_proj = NovaSourceAssessment(group=nova[0], source_field=nova[1])

    green_proj: GradedSourceAssessment | None = None
    if green_grade or green_score:
        green_source_fields = [
            item[1] for item in (green_grade, green_score, green_version) if item is not None
        ]
        green_proj = GradedSourceAssessment(
            grade=green_grade[0] if green_grade else None,
            score=green_score[0] if green_score else None,
            version=green_version[0] if green_version else None,
            source_fields=green_source_fields,
        )

    return SourceAssessmentsProjection(
        nutri_score=nutri_proj,
        nova=nova_proj,
        green_score=green_proj,
    )


def _taxonomy_object_keys(record: dict[str, Any], field: str) -> list[str]:
    val = record.get(field)
    if not isinstance(val, dict):
        return []
    result: list[str] = []
    for k in val:
        if k != "all":
            tag = _display_taxonomy_tag(str(k))
            if tag:
                result.append(tag)
    return result


def _format_barcode_image_path(barcode: str) -> str:
    if len(barcode) > 8 and barcode.isdigit():
        match = BARCODE_SPLIT_PATTERN.match(barcode)
        if match:
            return f"{match.group(1)}/{match.group(2)}/{match.group(3)}/{match.group(4)}"
    return barcode


def _selected_image(
    values: dict[str, Any],
    source_field: str,
    preferred_language: str | None,
) -> SourceImage | None:
    languages: list[str] = []
    if preferred_language:
        languages.append(preferred_language)
        if preferred_language == "kh":
            languages.append("km")
    languages.append("en")
    checked: set[str] = set()

    for lang in languages:
        if lang in checked:
            continue
        checked.add(lang)
        url = _http_url(values.get(lang))
        if url:
            resolved_lang = lang
            return SourceImage(
                url=url, language=resolved_lang, source_field=f"{source_field}.{lang}"
            )

    for lang, val in values.items():
        url = _http_url(val)
        if url:
            resolved_lang = lang
            return SourceImage(
                url=url, language=resolved_lang, source_field=f"{source_field}.{lang}"
            )
    return None


def _extract_front_image(
    record: dict[str, Any],
    barcode: str | None,
    preferred_language: str | None,
) -> SourceImage | None:
    selected_images = (
        record.get("selected_images") if _is_record(record.get("selected_images")) else None
    )
    front = (
        selected_images.get("front")
        if selected_images and _is_record(selected_images.get("front"))
        else None
    )
    display = front.get("display") if front and _is_record(front.get("display")) else None
    if display:
        selected = _selected_image(display, "selected_images.front.display", preferred_language)
        if selected:
            return selected

    for source_field in ("image_front_url", "image_url"):
        url = _http_url(record.get(source_field))
        if url:
            return SourceImage(url=url, language=preferred_language, source_field=source_field)

    images = record.get("images") if _is_record(record.get("images")) else None
    sel = images.get("selected") if images and _is_record(images.get("selected")) else None
    sel_front = sel.get("front") if sel and _is_record(sel.get("front")) else None
    if not sel_front or not barcode:
        return None

    sel_front_keys = list(sel_front.keys()) if isinstance(sel_front, dict) else []
    languages = (
        [preferred_language, "en", *sel_front_keys]
        if preferred_language
        else ["en", *sel_front_keys]
    )
    checked: set[str] = set()
    for lang in languages:
        if not lang or lang in checked:
            continue
        checked.add(lang)
        details = sel_front.get(lang)
        if not isinstance(details, dict):
            continue
        revision = _amount_value(details.get("rev"))
        if revision is None:
            continue
        path = _format_barcode_image_path(barcode)
        return SourceImage(
            url=f"https://images.openfoodfacts.org/images/products/{path}/front_{lang}.{revision}.400.jpg",
            language=lang,
            source_field=f"images.selected.front.{lang}.rev",
        )
    return None


def _packaging_components(record: dict[str, Any]) -> list[PackagingComponent]:
    packagings = record.get("packagings")
    if not isinstance(packagings, list):
        return []
    result: list[PackagingComponent] = []
    seen: set[str] = set()

    for item in packagings:
        if not _is_record(item):
            continue
        comp = PackagingComponent(
            shape=_display_taxonomy_value(item.get("shape")),
            material=_display_taxonomy_value(item.get("material")),
            recycling=_display_taxonomy_value(item.get("recycling")),
            quantity_per_unit=_text_value(item.get("quantity_per_unit")),
            weight_measured=_amount_value(item.get("weight_measured")),
            number_of_units=_amount_value(item.get("number_of_units")),
        )
        has_any_value = any(
            getattr(comp, f) is not None
            for f in (
                "shape",
                "material",
                "recycling",
                "quantity_per_unit",
                "weight_measured",
                "number_of_units",
            )
        )
        if not has_any_value:
            continue
        key = comp.model_dump_json()
        if key not in seen:
            seen.add(key)
            result.append(comp)
    return result


def _unix_timestamp(value: Any) -> str | None:
    amount = _amount_value(value)
    if amount is None:
        return None
    try:
        seconds = float(amount)
        dt = datetime.fromtimestamp(seconds, tz=UTC)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None


def project_source_record(
    source_record: dict[str, Any] | None,
    *,
    meta: ProductLookupMetaResponse | None = None,
) -> ProductProjection:
    record = source_record or {}
    record_language = _source_language(record)

    barcode = (
        _text_value(meta.lookup.barcode)
        if meta and meta.lookup
        else _text_value(record.get("code"))
    )
    names = _original_texts(record, "product_name", record_language)
    generic_names = _original_texts(record, "generic_name", record_language)

    preferred_name: OriginalText | None = None
    if names:
        if record_language:
            for name in names:
                if name.language == record_language:
                    preferred_name = name
                    break
        if preferred_name is None:
            for name in names:
                if name.language == "en":
                    preferred_name = name
                    break
        if preferred_name is None:
            preferred_name = names[0]

    packaging_texts = _merge_original_texts(
        _original_texts(record, "packaging", record_language),
        _original_texts(record, "packaging_text", record_language),
    )
    recycling_instructions = _merge_original_texts(
        _original_texts(record, "recycling_instructions_to_discard", record_language),
        _original_texts(record, "recycling_instructions", record_language),
    )

    packaging_materials = _unique_values(
        [
            *(
                _display_taxonomy_tag(t)
                for t in _list_values(record, "packaging_materials", "packaging_materials_tags")
            ),
            *_taxonomy_object_keys(record, "packagings_materials"),
        ]
    )
    packaging_shapes = _unique_values(
        _display_taxonomy_tag(t)
        for t in _list_values(record, "packaging_shapes", "packaging_shapes_tags")
    )
    packaging_recycling = _unique_values(
        _display_taxonomy_tag(t)
        for t in _list_values(record, "packaging_recycling", "packaging_recycling_tags")
    )

    ingredients_texts = _original_texts(record, "ingredients_text", record_language)
    categories_list = _list_values(record, "categories", "categories_tags")
    categories_field = TranslatableField(
        original_texts=_original_texts(record, "categories", record_language)
    )

    completeness_raw = record.get("completeness")
    completeness = (
        float(completeness_raw)
        if isinstance(completeness_raw, (int, float)) and not isinstance(completeness_raw, bool)
        else None
    )

    last_modified_at = _text_value(record.get("last_modified_datetime")) or _unix_timestamp(
        record.get("last_modified_t")
    )

    product = ProductProjection(
        identity=ProductIdentityProjection(
            barcode=barcode,
            preferred_name=preferred_name,
            names=names,
            generic_names=generic_names,
            brands=_list_values(record, "brands", "brands_tags"),
            quantity=_text_value(record.get("quantity")),
        ),
        front_image=_extract_front_image(record, barcode, record_language),
        ingredients=ingredients_texts,
        additives=_list_values(record, "additives", "additives_tags"),
        storage_instructions=_merge_original_texts(
            _original_texts(record, "conservation_conditions", record_language),
            _original_texts(record, "storage_conditions", record_language),
        ),
        nutrition=_extract_nutrition(record),
        assessments=_extract_assessments(record),
        categories=categories_list,
        categories_text=categories_field,
        labels=_list_values(record, "labels", "labels_tags"),
        countries=_list_values(record, "countries", "countries_tags"),
        packaging=PackagingProjection(
            texts=packaging_texts,
            recycling_instructions=recycling_instructions,
            components=_packaging_components(record),
            materials=packaging_materials,
            shapes=packaging_shapes,
            recycling=packaging_recycling,
        ),
        environment=EnvironmentProjection(
            origins=_list_values(record, "origins", "origins_tags"),
            manufacturing_places=_list_values(
                record, "manufacturing_places", "manufacturing_places_tags"
            ),
            carbon_footprint_100g=_amount_value(record.get("carbon_footprint_100g")),
            carbon_footprint_from_known_ingredients_100g=_amount_value(
                record.get("carbon_footprint_from_known_ingredients_100g")
            ),
            carbon_footprint_from_meat_or_fish_100g=_amount_value(
                record.get("carbon_footprint_from_meat_or_fish_100g")
            ),
        ),
        source=SourceRecordMetadataProjection(
            name=_text_value(meta.source.name) if meta and meta.source else None,
            product_url=_http_url(meta.source.product_url) if meta and meta.source else None,
            dataset_version=_text_value(meta.dataset.version) if meta and meta.dataset else None,
            retrieved_at=(
                meta.dataset.retrieved_at.isoformat().replace("+00:00", "Z")
                if meta and meta.dataset and isinstance(meta.dataset.retrieved_at, datetime)
                else _text_value(meta.dataset.retrieved_at)
                if meta and meta.dataset
                else None
            ),
            record_language=record_language,
            languages=_list_values(record, "languages", "languages_tags"),
            creator=_text_value(record.get("creator")),
            created_at=_unix_timestamp(record.get("created_t")),
            last_modified_at=last_modified_at,
            completeness=completeness,
            data_quality_warnings=_list_values(
                record, "data_quality_warnings", "data_quality_warnings_tags"
            ),
        ),
    )

    selections = extract_eligible_fields(product)
    for field in ELIGIBLE_FIELDS:
        selection = selections[field.name]
        target = field.target(product)
        target.original_texts = selection.all_texts
        target.selected_original_text = selection.selected_text
    return product
