"""Conservative normalization of visible photo-extraction output.

The provider is allowed to read text and classify evidence. Numeric normalization
is deliberately local and small: it only handles explicit numerals and units that
are already present in the provider response.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import uuid4

from lifegoods.photo_comparison.contracts import (
    EvidencePointer,
    Extraction,
    ExtractionOutcome,
    FieldObservation,
    FieldState,
    ImageEvidence,
    MeasurementUnit,
    NutrientRowKind,
    NutritionBasis,
    NutritionColumn,
    ObservationAlternative,
    PreparationState,
    ProductIdentity,
    Quantity,
    ValueQualifier,
)

CONFIGURATION_VERSION = "photo-extraction-v3"

_DIGIT_TRANSLATION = str.maketrans(
    "០១២៣៤៥៦៧៨៩๐๑๒๓๔๕๖๗๘๙",
    "01234567890123456789",
)
_NUMBER_PATTERN = re.compile(r"[-+]?\d[\d\s,.']*")

_UNIT_ALIASES: dict[str, MeasurementUnit] = {
    "g": MeasurementUnit.G,
    "gram": MeasurementUnit.G,
    "grams": MeasurementUnit.G,
    "ក្រាម": MeasurementUnit.G,
    "กรัม": MeasurementUnit.G,
    "mg": MeasurementUnit.MG,
    "milligram": MeasurementUnit.MG,
    "milligrams": MeasurementUnit.MG,
    "មីលីក្រាម": MeasurementUnit.MG,
    "มิลลิกรัม": MeasurementUnit.MG,
    "ug": MeasurementUnit.UG,
    "µg": MeasurementUnit.UG,
    "μg": MeasurementUnit.UG,
    "mcg": MeasurementUnit.UG,
    "kg": MeasurementUnit.KG,
    "kilogram": MeasurementUnit.KG,
    "គីឡូក្រាម": MeasurementUnit.KG,
    "ml": MeasurementUnit.ML,
    "millilitre": MeasurementUnit.ML,
    "milliliter": MeasurementUnit.ML,
    "មីលីលីត្រ": MeasurementUnit.ML,
    "มิลลิลิตร": MeasurementUnit.ML,
    "l": MeasurementUnit.L,
    "litre": MeasurementUnit.L,
    "liter": MeasurementUnit.L,
    "លីត្រ": MeasurementUnit.L,
    "ลิตร": MeasurementUnit.L,
    "kcal": MeasurementUnit.KCAL,
    "cal": MeasurementUnit.KCAL,
    "calories": MeasurementUnit.KCAL,
    "calorie": MeasurementUnit.KCAL,
    "កាឡូរី": MeasurementUnit.KCAL,
    "kj": MeasurementUnit.KJ,
    "kilojoules": MeasurementUnit.KJ,
    "kilojoule": MeasurementUnit.KJ,
    "percent": MeasurementUnit.PERCENT,
    "%": MeasurementUnit.PERCENT,
    "count": MeasurementUnit.COUNT,
    "克": MeasurementUnit.G,
    "公克": MeasurementUnit.G,
    "毫克": MeasurementUnit.MG,
    "微克": MeasurementUnit.UG,
    "公斤": MeasurementUnit.KG,
    "千克": MeasurementUnit.KG,
    "毫升": MeasurementUnit.ML,
    "升": MeasurementUnit.L,
    "千卡": MeasurementUnit.KCAL,
    "大卡": MeasurementUnit.KCAL,
    "卡路里": MeasurementUnit.KCAL,
    "kkal": MeasurementUnit.KCAL,
    "千焦": MeasurementUnit.KJ,
}

_SEGMENT_SPLIT = re.compile(r"[/|／•·]")
_DECORATION = re.compile(r"[*†‡]+|\([^)]*\)|（[^）]*）")


def _segments(value: str) -> list[str]:
    """Split multilingual text like ``kcal/千卡*`` into clean candidate segments."""
    cleaned = _DECORATION.sub(" ", value)
    return [" ".join(part.split()) for part in _SEGMENT_SPLIT.split(cleaned) if part.strip()]


_SPECIAL_UNIT_DEFINITIONS: dict[str, tuple[MeasurementUnit, Decimal]] = {
    "oz": (MeasurementUnit.G, Decimal("28.3495")),
    "ounce": (MeasurementUnit.G, Decimal("28.3495")),
    "ounces": (MeasurementUnit.G, Decimal("28.3495")),
    "fl oz": (MeasurementUnit.ML, Decimal("29.5735")),
    "fl. oz.": (MeasurementUnit.ML, Decimal("29.5735")),
    "fl. oz": (MeasurementUnit.ML, Decimal("29.5735")),
    "floz": (MeasurementUnit.ML, Decimal("29.5735")),
    "fluid ounce": (MeasurementUnit.ML, Decimal("29.5735")),
    "fluid ounces": (MeasurementUnit.ML, Decimal("29.5735")),
}

_UNIT_FACTORS: dict[MeasurementUnit, tuple[MeasurementUnit, Decimal]] = {
    MeasurementUnit.G: (MeasurementUnit.G, Decimal("1")),
    MeasurementUnit.MG: (MeasurementUnit.MG, Decimal("1")),
    MeasurementUnit.UG: (MeasurementUnit.UG, Decimal("1")),
    MeasurementUnit.KG: (MeasurementUnit.G, Decimal("1000")),
    MeasurementUnit.ML: (MeasurementUnit.ML, Decimal("1")),
    MeasurementUnit.L: (MeasurementUnit.ML, Decimal("1000")),
    MeasurementUnit.KCAL: (MeasurementUnit.KCAL, Decimal("1")),
    MeasurementUnit.KJ: (MeasurementUnit.KJ, Decimal("1")),
    MeasurementUnit.PERCENT: (MeasurementUnit.PERCENT, Decimal("1")),
    MeasurementUnit.COUNT: (MeasurementUnit.COUNT, Decimal("1")),
}

_NUTRIENT_ALIASES: dict[str, str] = {
    "energy": "energy",
    "energy value": "energy",
    "calories": "energy",
    "calorie": "energy",
    "ថាមពល": "energy",
    "កាឡូរី": "energy",
    "fat": "fat",
    "total fat": "fat",
    "ជាតិខ្លាញ់": "fat",
    "ជាតិខ្លាញ់សរុប": "fat",
    "ខ្លាញ់": "fat",
    "ខ្លាញ់សរុប": "fat",
    "ไขมัน": "fat",
    "saturated fat": "saturated_fat",
    "saturates": "saturated_fat",
    "ខ្លាញ់ឆ្អែត": "saturated_fat",
    "ជាតិខ្លាញ់ឆ្អែត": "saturated_fat",
    "trans fat": "trans_fat",
    "trans fatty acid": "trans_fat",
    "trans fatty acids": "trans_fat",
    "lemak trans": "trans_fat",
    "asid lemak trans": "trans_fat",
    "反式脂肪": "trans_fat",
    "反式脂肪酸": "trans_fat",
    "ខ្លាញ់ត្រង់ស៍": "trans_fat",
    "ខ្លាញ់ trans": "trans_fat",
    "unsaturated fat": "unsaturated_fat",
    "unsaturated fatty acid": "unsaturated_fat",
    "lemak tidak tepu": "unsaturated_fat",
    "不饱和脂肪": "unsaturated_fat",
    "ខ្លាញ់មិនឆ្អែត": "unsaturated_fat",
    "monounsaturated fat": "monounsaturated_fat",
    "monounsaturated fatty acid": "monounsaturated_fat",
    "monounsaturated fatty acids": "monounsaturated_fat",
    "monounsaturates": "monounsaturated_fat",
    "mono-unsaturated fat": "monounsaturated_fat",
    "mufa": "monounsaturated_fat",
    "asid lemak monotidaktepu": "monounsaturated_fat",
    "asid lemak mono tidak tepu": "monounsaturated_fat",
    "lemak monotidaktepu": "monounsaturated_fat",
    "单元不饱和脂肪酸": "monounsaturated_fat",
    "单元不饱和脂肪": "monounsaturated_fat",
    "單元不飽和脂肪酸": "monounsaturated_fat",
    "polyunsaturated fat": "polyunsaturated_fat",
    "polyunsaturated fatty acid": "polyunsaturated_fat",
    "polyunsaturated fatty acids": "polyunsaturated_fat",
    "polyunsaturates": "polyunsaturated_fat",
    "poly-unsaturated fat": "polyunsaturated_fat",
    "pufa": "polyunsaturated_fat",
    "asid lemak politidaktepu": "polyunsaturated_fat",
    "asid lemak poli tidak tepu": "polyunsaturated_fat",
    "lemak politidaktepu": "polyunsaturated_fat",
    "多元不饱和脂肪酸": "polyunsaturated_fat",
    "多元不饱和脂肪": "polyunsaturated_fat",
    "多元不飽和脂肪酸": "polyunsaturated_fat",
    "calories from fat": "calories_from_fat",
    "calorie from fat": "calories_from_fat",
    "energy from fat": "calories_from_fat",
    "kalori dari lemak": "calories_from_fat",
    "kalori daripada lemak": "calories_from_fat",
    "来自脂肪的卡路里": "calories_from_fat",
    "脂肪热量": "calories_from_fat",
    "carbohydrate": "carbohydrate",
    "carbohydrates": "carbohydrate",
    "total carbohydrate": "carbohydrate",
    "កាបូអ៊ីដ្រាត": "carbohydrate",
    "កាបូអ៊ីដ្រាតសរុប": "carbohydrate",
    "កាបូនអ៊ីដ្រាត": "carbohydrate",
    "คาร์โบไฮเดรត": "carbohydrate",
    "sugars": "sugars",
    "sugar": "sugars",
    "added sugars": "added_sugars",
    "ជាតិស្ករ": "sugars",
    "ស្ករ": "sugars",
    "ស្ករសរុប": "sugars",
    "fiber": "fiber",
    "fibre": "fiber",
    "dietary fiber": "fiber",
    "ជាតិសរសៃ": "fiber",
    "protein": "protein",
    "ប្រូតេអ៊ីន": "protein",
    "โปรตีน": "protein",
    "sodium": "sodium",
    "សូដ្យូម": "sodium",
    "โซเดียม": "sodium",
    "potassium": "potassium",
    "ប៉ូតាស្យូម": "potassium",
    "calcium": "calcium",
    "កាល់ស្យូម": "calcium",
    "iron": "iron",
    "ជាតិដែក": "iron",
    "salt": "salt",
    "អំបិល": "salt",
    "cholesterol": "cholesterol",
    "កូឡេស្តេរ៉ុល": "cholesterol",
    "កូឡេស្តេរ៉ូល": "cholesterol",
    "vitamin a": "vitamin_a",
    "វីតាមីន a": "vitamin_a",
    "vitamin b1": "vitamin_b1",
    "thiamine": "vitamin_b1",
    "thiamin": "vitamin_b1",
    "វីតាមីន b1": "vitamin_b1",
    "vitamin b2": "vitamin_b2",
    "riboflavin": "vitamin_b2",
    "វីតាមីន b2": "vitamin_b2",
    "vitamin b5": "vitamin_b5",
    "vitamin b-5": "vitamin_b5",
    "pantothenic acid": "vitamin_b5",
    "pantothenate": "vitamin_b5",
    "វីតាមីន b5": "vitamin_b5",
    "vitamin b6": "vitamin_b6",
    "pyridoxine": "vitamin_b6",
    "វីតាមីន b6": "vitamin_b6",
    "vitamin b12": "vitamin_b12",
    "cobalamin": "vitamin_b12",
    "វីតាមីន b12": "vitamin_b12",
    "vitamin c": "vitamin_c",
    "ascorbic acid": "vitamin_c",
    "វីតាមីន c": "vitamin_c",
    "vitamin d": "vitamin_d",
    "វីតាមីន d": "vitamin_d",
    "niacin": "niacin",
    "niacinamide": "niacin",
    "nicotinamide": "niacin",
    "វីតាមីន b3": "niacin",
    "folic acid": "folic_acid",
    "folate": "folic_acid",
    "asid folik": "folic_acid",
    "叶酸": "folic_acid",
    "vitamin b9": "folic_acid",
    "វីតាមីន b9": "folic_acid",
    "vitamin b3": "niacin",
    "烟酸": "niacin",
    "vitamin e": "vitamin_e",
    "tocopherol": "vitamin_e",
    "វីតាមីន e": "vitamin_e",
    "维生素e": "vitamin_e",
    "vitamin k": "vitamin_k",
    "វីតាមីន k": "vitamin_k",
    "维生素k": "vitamin_k",
    "维生素a": "vitamin_a",
    "维生素b1": "vitamin_b1",
    "维生素b2": "vitamin_b2",
    "维生素b6": "vitamin_b6",
    "维生素b12": "vitamin_b12",
    "维生素c": "vitamin_c",
    "维生素d": "vitamin_d",
    "magnesium": "magnesium",
    "ម៉ាញ៉េស្យូម": "magnesium",
    "镁": "magnesium",
    "phosphorus": "phosphorus",
    "fosforus": "phosphorus",
    "ផូស្វ័រ": "phosphorus",
    "磷": "phosphorus",
    "zinc": "zinc",
    "zink": "zinc",
    "ស័ង្កសី": "zinc",
    "锌": "zinc",
    "copper": "copper",
    "kuprum": "copper",
    "ទង់ដែង": "copper",
    "铜": "copper",
    "manganese": "manganese",
    "mangan": "manganese",
    "锰": "manganese",
    "selenium": "selenium",
    "硒": "selenium",
    "iodine": "iodine",
    "iodin": "iodine",
    "អ៊ីយ៉ូត": "iodine",
    "碘": "iodine",
    "starch": "starch",
    "kanji": "starch",
    "ម្សៅ": "starch",
    "淀粉": "starch",
    "caffeine": "caffeine",
    "kafein": "caffeine",
    "កាហ្វេអ៊ីន": "caffeine",
    "咖啡因": "caffeine",
    # Malay / Chinese / Thai aliases for the core nutrients.
    "tenaga": "energy",
    "kalori": "energy",
    "能量": "energy",
    "热量": "energy",
    "熱量": "energy",
    "卡路里": "energy",
    "พลังงาน": "energy",
    "lemak": "fat",
    "jumlah lemak": "fat",
    "脂肪": "fat",
    "总脂肪": "fat",
    "ไขมันทั้งหมด": "fat",
    "lemak tepu": "saturated_fat",
    "asid lemak tepu": "saturated_fat",
    "饱和脂肪": "saturated_fat",
    "饱和脂肪酸": "saturated_fat",
    "飽和脂肪": "saturated_fat",
    "ไขมันอิ่มตัว": "saturated_fat",
    "ไขมันทรานส์": "trans_fat",
    "karbohidrat": "carbohydrate",
    "jumlah karbohidrat": "carbohydrate",
    "碳水化合物": "carbohydrate",
    "总碳水化合物": "carbohydrate",
    "gula": "sugars",
    "jumlah gula": "sugars",
    "糖": "sugars",
    "总糖": "sugars",
    "น้ำตาล": "sugars",
    "gula tambahan": "added_sugars",
    "添加糖": "added_sugars",
    "serat": "fiber",
    "serat diet": "fiber",
    "膳食纤维": "fiber",
    "纤维": "fiber",
    "ใยอาหาร": "fiber",
    "蛋白质": "protein",
    "蛋白質": "protein",
    "natrium": "sodium",
    "钠": "sodium",
    "鈉": "sodium",
    "kalium": "potassium",
    "钾": "potassium",
    "โพแทสเซียม": "potassium",
    "kalsium": "calcium",
    "钙": "calcium",
    "แคลเซียม": "calcium",
    "ferum": "iron",
    "zat besi": "iron",
    "铁": "iron",
    "เหล็ก": "iron",
    "garam": "salt",
    "盐": "salt",
    "kolesterol": "cholesterol",
    "胆固醇": "cholesterol",
    "膽固醇": "cholesterol",
    "โคเลสเตอรอล": "cholesterol",
}


class ProviderOutputError(ValueError):
    """Raised when the provider response cannot be safely made contract-valid."""


def canonical_nutrient(value: str | None) -> str | None:
    if not value:
        return None
    folded = unicodedata.normalize("NFKC", value).casefold().replace("_", " ")
    cleaned = " ".join(folded.split())
    match = _NUTRIENT_ALIASES.get(cleaned)
    if match is not None:
        return match
    # Multilingual labels such as "Asid Lemak Tepu / Saturated Fat / 饱和脂肪":
    # try each segment on its own.
    for segment in _segments(folded):
        match = _NUTRIENT_ALIASES.get(segment.replace("-", " ")) or _NUTRIENT_ALIASES.get(segment)
        if match is not None:
            return match
    return None


def _require_mapping(value: Any, description: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ProviderOutputError(f"{description} must be an object")
    return value


def _check_keys(value: Mapping[str, Any], allowed: set[str], description: str) -> None:
    unknown = set(value) - allowed
    if unknown:
        raise ProviderOutputError(f"{description} contains unsupported fields")


def _optional_text(value: Any, description: str, max_length: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > max_length:
        raise ProviderOutputError(f"{description} must be bounded text")
    return value


def _required_text(value: Any, description: str, max_length: int) -> str:
    parsed = _optional_text(value, description, max_length)
    if not parsed:
        raise ProviderOutputError(f"{description} is required")
    return parsed


def _parse_decimal(value_text: str | None) -> Decimal | None:
    if not value_text:
        return None
    normalized = unicodedata.normalize("NFKC", value_text).translate(_DIGIT_TRANSLATION)
    match = _NUMBER_PATTERN.search(normalized)
    if match is None:
        return None
    number = match.group(0).replace(" ", "").replace("'", "")
    if "," in number and "." in number:
        if number.rfind(",") > number.rfind("."):
            number = number.replace(".", "").replace(",", ".")
        else:
            number = number.replace(",", "")
    elif "," in number:
        parts = number.split(",")
        number = "".join(parts) if len(parts[-1]) == 3 and len(parts) > 1 else ".".join(parts)
    try:
        parsed = Decimal(number)
    except InvalidOperation:
        return None
    return parsed if parsed.is_finite() else None


def normalize_unit(unit_text: str | None) -> tuple[MeasurementUnit | None, Decimal | None]:
    if not unit_text:
        return None, None
    folded = unicodedata.normalize("NFKC", unit_text).casefold()
    cleaned = " ".join(folded.split())
    candidates = [cleaned, *_segments(folded)]
    for candidate in candidates:
        if candidate in _SPECIAL_UNIT_DEFINITIONS:
            return _SPECIAL_UNIT_DEFINITIONS[candidate]
        unit = _UNIT_ALIASES.get(candidate)
        if unit is not None:
            base_unit, factor = _UNIT_FACTORS[unit]
            return base_unit, factor
    return None, None


def _normalize_value(
    value_text: str | None,
    unit_text: str | None,
    *,
    allow_zero: bool,
    nutrient: str | None = None,
    label: str | None = None,
) -> tuple[Decimal | None, MeasurementUnit | None]:
    value = _parse_decimal(value_text)
    if value is None:
        return None, None
    unit, factor = normalize_unit(unit_text)
    if (unit is None or factor is None) and unit_text is None:
        label_lower = (label or "").casefold()
        if (
            nutrient in {"energy", "calories_from_fat"}
            or "calorie" in label_lower
            or "calories" in label_lower
            or label_lower in {"cal", "kcal"}
            or "កាឡូរី" in label_lower
            or "ថាមពល" in label_lower
        ):
            unit = MeasurementUnit.KCAL
            factor = Decimal("1")
    if unit is None or factor is None:
        return None, None
    normalized = value * factor
    if not normalized.is_finite() or (not allow_zero and normalized <= 0):
        return None, None
    if allow_zero and normalized < 0:
        return None, None
    return normalized, unit


def _state(value: Any, description: str) -> FieldState:
    try:
        return FieldState(value or FieldState.READABLE)
    except ValueError as error:
        raise ProviderOutputError(f"{description} has an unsupported state") from error


def _qualifier(value: Any) -> ValueQualifier:
    try:
        return ValueQualifier(value or ValueQualifier.EXACT)
    except ValueError as error:
        raise ProviderOutputError("an observation has an unsupported qualifier") from error


def _row_kind(value: Any) -> NutrientRowKind:
    try:
        return NutrientRowKind(value or NutrientRowKind.AMOUNT)
    except ValueError as error:
        raise ProviderOutputError("an observation has an unsupported row kind") from error


def _evidence(value: Any, description: str) -> list[EvidencePointer]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ProviderOutputError(f"{description} must be a list")
    pointers: list[EvidencePointer] = []
    for item in value:
        raw = _require_mapping(item, f"{description} item")
        _check_keys(raw, {"image_id", "region"}, f"{description} item")
        pointer_data = dict(raw)
        if isinstance(pointer_data.get("region"), Mapping):
            region = dict(pointer_data["region"])
            try:
                for coordinate in ("x", "y", "width", "height"):
                    if coordinate in region:
                        region[coordinate] = float(region[coordinate])
            except (TypeError, ValueError) as error:
                raise ProviderOutputError(f"{description} contains an invalid region") from error
            pointer_data["region"] = region
        try:
            pointers.append(EvidencePointer.model_validate(pointer_data))
        except ValueError as error:
            raise ProviderOutputError(f"{description} contains an invalid pointer") from error
    return pointers


def _alternative(value: Any, description: str) -> ObservationAlternative:
    raw = _require_mapping(value, description)
    _check_keys(
        raw,
        {"value_text", "unit_text", "original_script", "language", "state", "evidence"},
        description,
    )
    return ObservationAlternative(
        value_text=_optional_text(raw.get("value_text"), f"{description} value", 256),
        unit_text=_optional_text(raw.get("unit_text"), f"{description} unit", 64),
        original_script=_optional_text(raw.get("original_script"), f"{description} text", 4096),
        language=_optional_text(raw.get("language"), f"{description} language", 32) or "und",
        state=_state(raw.get("state"), description),
        evidence=_evidence(raw.get("evidence"), f"{description} evidence"),
    )


def _alternatives(value: Any, description: str) -> list[ObservationAlternative]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ProviderOutputError(f"{description} must be a list")
    return [_alternative(item, f"{description} item") for item in value]


def _field(value: Any, description: str) -> FieldObservation:
    raw = _require_mapping(value, description)
    _check_keys(
        raw,
        {
            "field_id",
            "nutrient",
            "label",
            "value_text",
            "unit_text",
            "original_script",
            "language",
            "state",
            "qualifier",
            "row_kind",
            "alternatives",
            "evidence",
        },
        description,
    )
    state = _state(raw.get("state"), description)
    value_text = _optional_text(raw.get("value_text"), f"{description} value", 256)
    unit_text = _optional_text(raw.get("unit_text"), f"{description} unit", 64)
    label = _optional_text(raw.get("label"), f"{description} label", 256)
    nutrient = canonical_nutrient(
        _optional_text(raw.get("nutrient"), "nutrient", 128)
    ) or canonical_nutrient(label)
    normalized_value, normalized_unit = (
        _normalize_value(value_text, unit_text, allow_zero=True, nutrient=nutrient, label=label)
        if state is FieldState.READABLE
        else (None, None)
    )
    row_kind = _row_kind(raw.get("row_kind"))
    if row_kind is NutrientRowKind.PERCENTAGE and normalized_value is not None:
        normalized_unit = (
            MeasurementUnit.PERCENT if normalized_unit is MeasurementUnit.PERCENT else None
        )
        if normalized_unit is None:
            normalized_value = None
    try:
        return FieldObservation(
            field_id=_required_text(raw.get("field_id") or uuid4().hex, f"{description} ID", 128),
            nutrient=nutrient,
            label=label,
            value_text=value_text,
            unit_text=unit_text,
            original_script=_optional_text(
                raw.get("original_script"), f"{description} original text", 4096
            ),
            language=_optional_text(raw.get("language"), f"{description} language", 32) or "und",
            state=state,
            normalized_value=normalized_value,
            normalized_unit=normalized_unit,
            qualifier=_qualifier(raw.get("qualifier")),
            row_kind=row_kind,
            alternatives=_alternatives(raw.get("alternatives"), f"{description} alternatives"),
            evidence=_evidence(raw.get("evidence"), f"{description} evidence"),
        )
    except ValueError as error:
        raise ProviderOutputError(f"{description} is not contract-valid") from error


def _quantity(value: Any, description: str, *, fallback_image_id: str | None = None) -> Quantity:
    raw = _require_mapping(value, description)
    _check_keys(
        raw,
        {
            "field_id",
            "label",
            "value_text",
            "unit_text",
            "language",
            "state",
            "qualifier",
            "alternatives",
            "evidence",
        },
        description,
    )
    state = _state(raw.get("state"), description)
    label = _optional_text(raw.get("label"), f"{description} label", 256) or (
        "Net weight" if "package" in description else "Serving size"
    )
    value_text = _optional_text(raw.get("value_text"), f"{description} value", 256)
    unit_text = _optional_text(raw.get("unit_text"), f"{description} unit", 64)

    # Extract unit from value_text if unit_text was omitted or merged (e.g. "60 g", "60g", "60 mg")
    if value_text and not unit_text:
        trimmed = value_text.strip()
        parts = trimmed.split()
        if len(parts) == 2 and _parse_decimal(parts[0]) is not None:
            value_text, unit_text = parts[0], parts[1]
        elif trimmed.lower().endswith("mg") and _parse_decimal(trimmed[:-2]) is not None:
            value_text, unit_text = trimmed[:-2], "mg"
        elif trimmed.lower().endswith("g") and _parse_decimal(trimmed[:-1]) is not None:
            value_text, unit_text = trimmed[:-1], "g"
        elif trimmed.lower().endswith("ml") and _parse_decimal(trimmed[:-2]) is not None:
            value_text, unit_text = trimmed[:-2], "ml"

    # If marked readable but lacks either value or unit, it cannot be considered readable
    if state is FieldState.READABLE and (not value_text or not unit_text):
        state = FieldState.NOT_VISIBLE

    evidence = _evidence(raw.get("evidence"), f"{description} evidence")
    if state is FieldState.READABLE and not evidence:
        if fallback_image_id:
            evidence = [EvidencePointer(image_id=fallback_image_id)]
        else:
            state = FieldState.NOT_VISIBLE

    normalized_value, normalized_unit = (
        _normalize_value(value_text, unit_text, allow_zero=False)
        if state is FieldState.READABLE
        else (None, None)
    )
    quantity_label = (
        label
        if state is FieldState.READABLE
        else _optional_text(raw.get("label"), f"{description} label", 256)
    )
    try:
        return Quantity(
            field_id=_required_text(raw.get("field_id") or uuid4().hex, f"{description} ID", 128),
            label=quantity_label,
            value_text=value_text,
            unit_text=unit_text,
            language=_optional_text(raw.get("language"), f"{description} language", 32) or "und",
            state=state,
            normalized_value=normalized_value,
            normalized_unit=normalized_unit,
            qualifier=_qualifier(raw.get("qualifier")),
            alternatives=_alternatives(raw.get("alternatives"), f"{description} alternatives"),
            evidence=evidence,
        )
    except ValueError as error:
        raise ProviderOutputError(f"{description} is not contract-valid") from error


def _basis(value: Any, description: str) -> NutritionBasis:
    try:
        return NutritionBasis(value or NutritionBasis.UNKNOWN)
    except ValueError as error:
        raise ProviderOutputError(f"{description} has an unsupported basis") from error


def _preparation(value: Any, description: str) -> PreparationState:
    try:
        return PreparationState(value or PreparationState.UNKNOWN)
    except ValueError as error:
        raise ProviderOutputError(f"{description} has an unsupported preparation state") from error


_BASIS_PATTERNS: list[tuple[NutritionBasis, re.Pattern[str]]] = [
    # Non-basis columns (percent daily value / reference intake) come first so a
    # header like "% Daily Value per 100g" is never mistaken for a basis.
    (
        NutritionBasis.OTHER,
        re.compile(
            r"%\s*(daily value|dv|nrv|ri|rda|ai)\b|daily value|valeur quotidienne|"
            r"reference intake|nilai harian|每日(营养素)?(参考|摄入)|%\s*ndv|ndv\b"
        ),
    ),
    (
        NutritionBasis.PER_100ML,
        re.compile(
            r"(per|setiap|pour|par|/|ក្នុង|ต่อ|每)\s*100\s*(ml|mL|millilit|毫升|មីលីលីត្រ|มล)|"
            r"^100\s*(ml|毫升|មីលីលីត្រ|មល)"
        ),
    ),
    (
        NutritionBasis.PER_100G,
        re.compile(
            r"(per|setiap|pour|par|/|ក្នុង|ต่อ|每)\s*100\s*(g|gm|gram|克|公克|ក្រាម|กรัม)|"
            r"^100\s*(g|gm|克|ក្រាម|กรัม)"
        ),
    ),
    (
        NutritionBasis.PER_SERVING,
        re.compile(
            r"per serv|per portion|par portion|per hidangan|setiap hidangan|per sajian|"
            r"每食用分量|每份|每一份|ក្នុងមួយចំណែក|ต่อหนึ่งหน่วยบริโภค|ต่อหน่วยบริโภค|"
            r"serving size|amount per serving"
        ),
    ),
    (
        NutritionBasis.PER_PACKAGE,
        re.compile(
            r"per (pack|package|packet|container|bottle|can)\b|setiap (bungkus|pek|bekas)|"
            r"par (paquet|emballage)|每包|每盒|每罐|每瓶|ក្នុងមួយកញ្ចប់|ต่อซอง|ต่อขวด|ต่อกล่อง"
        ),
    ),
]


def infer_basis_from_label(label: str | None) -> NutritionBasis:
    """Infer a column basis from its printed header, in any supported language."""
    if not label:
        return NutritionBasis.UNKNOWN
    folded = unicodedata.normalize("NFKC", label).casefold()
    candidates = [" ".join(folded.split()), *_segments(folded)]
    for basis, pattern in _BASIS_PATTERNS:
        if any(pattern.search(candidate) for candidate in candidates):
            return basis
    return NutritionBasis.UNKNOWN


def _column(
    value: Any, description: str, *, fallback_image_id: str | None = None
) -> NutritionColumn:
    raw = _require_mapping(value, description)
    _check_keys(
        raw,
        {
            "column_id",
            "label",
            "basis",
            "preparation_state",
            "serving_quantity",
            "serving_quantity_state",
            "basis_evidence",
            "preparation_evidence",
            "fields",
        },
        description,
    )
    fields_raw = raw.get("fields", [])
    if not isinstance(fields_raw, list):
        raise ProviderOutputError(f"{description} fields must be a list")
    serving_raw = raw.get("serving_quantity")
    serving = (
        _quantity(
            serving_raw,
            f"{description} serving quantity",
            fallback_image_id=fallback_image_id,
        )
        if serving_raw
        else None
    )
    try:
        serving_state = serving.state if serving is not None else FieldState.NOT_VISIBLE
        label = _optional_text(raw.get("label"), f"{description} label", 256)
        fields = [_field(item, f"{description} field") for item in fields_raw]
        basis = _basis(raw.get("basis"), description)
        basis_evidence = _evidence(raw.get("basis_evidence"), f"{description} basis evidence")
        if basis is NutritionBasis.UNKNOWN:
            # The provider only classifies bases it is sure about; recover the
            # common multilingual headers locally so the app can auto-pick a column.
            inferred = infer_basis_from_label(label)
            if (
                inferred is NutritionBasis.UNKNOWN
                and fields
                and all(field.row_kind is NutrientRowKind.PERCENTAGE for field in fields)
            ):
                inferred = NutritionBasis.OTHER
            if inferred is not NutritionBasis.UNKNOWN:
                if not basis_evidence:
                    basis_evidence = next(
                        (list(field.evidence) for field in fields if field.evidence), []
                    )
                if basis_evidence:
                    basis = inferred
        return NutritionColumn(
            column_id=_required_text(raw.get("column_id") or uuid4().hex, f"{description} ID", 128),
            label=label,
            basis=basis,
            preparation_state=_preparation(raw.get("preparation_state"), description),
            serving_quantity=serving,
            serving_quantity_state=serving_state,
            basis_evidence=basis_evidence,
            preparation_evidence=_evidence(
                raw.get("preparation_evidence"), f"{description} preparation evidence"
            ),
            fields=fields,
        )
    except ValueError as error:
        raise ProviderOutputError(f"{description} is not contract-valid") from error


def _identity(value: Any) -> ProductIdentity | None:
    if value is None:
        return None
    raw = _require_mapping(value, "identity")
    _check_keys(raw, {"name", "brand"}, "identity")

    def observation(key: str) -> FieldObservation | None:
        if raw.get(key) is None:
            return None
        item = dict(_require_mapping(raw[key], f"identity {key}"))
        item["label"] = item.get("label") or key.title()
        item["original_script"] = item.get("original_script") or item.get("value_text")
        return _field(item, f"identity {key}")

    return ProductIdentity(name=observation("name"), brand=observation("brand"))


def build_extraction(
    payload: Any,
    *,
    product_id: str,
    images: list[ImageEvidence],
    provider: str,
    model: str,
) -> Extraction:
    raw = _require_mapping(payload, "provider output")
    _check_keys(
        raw,
        {"identity", "package_quantity", "nutrition_columns", "outcome", "retake_reasons"},
        "provider output",
    )
    first_image_id = images[0].image_id if images else None
    columns_raw = raw.get("nutrition_columns", [])
    if not isinstance(columns_raw, list):
        raise ProviderOutputError("nutrition_columns must be a list")
    columns = [
        _column(item, "nutrition column", fallback_image_id=first_image_id) for item in columns_raw
    ]
    package_raw = raw.get("package_quantity")
    package_quantity = (
        _quantity(package_raw, "package quantity", fallback_image_id=first_image_id)
        if package_raw
        else None
    )
    identity = _identity(raw.get("identity"))
    provider_outcome = raw.get("outcome")
    try:
        requested_outcome = ExtractionOutcome(provider_outcome) if provider_outcome else None
    except ValueError as error:
        raise ProviderOutputError("provider output has an unsupported outcome") from error
    reasons = raw.get("retake_reasons", [])
    if not isinstance(reasons, list) or any(not isinstance(reason, str) for reason in reasons):
        raise ProviderOutputError("retake_reasons must be a list of text")
    reasons = [reason[:512] for reason in reasons[:16]]

    readable_fields = [
        field for column in columns for field in column.fields if field.state is FieldState.READABLE
    ]
    if not columns or not readable_fields:
        outcome = ExtractionOutcome.RETAKE_REQUIRED
        if not reasons:
            reasons = ["No readable nutrition column was found in the submitted photos."]
    elif requested_outcome is ExtractionOutcome.RETAKE_REQUIRED:
        outcome = ExtractionOutcome.RETAKE_REQUIRED
        if not reasons:
            reasons = ["Retake the nutrition panel so its values can be read clearly."]
    else:
        incomplete = any(
            field.state is not FieldState.READABLE for column in columns for field in column.fields
        ) or any(
            column.basis is NutritionBasis.UNKNOWN
            or column.preparation_state is PreparationState.UNKNOWN
            for column in columns
        )
        outcome = (
            ExtractionOutcome.PARTIAL
            if incomplete or requested_outcome is ExtractionOutcome.PARTIAL
            else ExtractionOutcome.COMPLETE
        )
        if outcome is ExtractionOutcome.PARTIAL and not reasons and package_quantity is None:
            reasons = ["Add a clear package-weight photo for per-100 comparison."]
        if outcome is ExtractionOutcome.COMPLETE:
            reasons = []

    try:
        return Extraction(
            product_id=product_id,
            identity=identity,
            images=images,
            package_quantity=package_quantity,
            nutrition_columns=columns,
            outcome=outcome,
            retake_reasons=reasons,
            provider=provider,
            model=model,
            configuration_version=CONFIGURATION_VERSION,
        )
    except ValueError as error:
        raise ProviderOutputError("provider output failed evidence validation") from error
