import json
from datetime import UTC, datetime
from typing import Any

from pymongo.database import Database
from pymongo.errors import PyMongoError

from lifegoods.identifiers import NormalizedIdentifier
from lifegoods.open_food_facts.models import (
    ExternalDatasetVersion,
    ExternalLookupResult,
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageRecord,
    ExternalPackageUnavailable,
    ExternalSelectedImage,
    ExternalSourceMetadata,
    ExternalSourceUnavailableReason,
    JsonValue,
    SourcedValue,
)

CONTROL_COLLECTION = "off_dataset_control"
VERSIONS_COLLECTION = "off_dataset_versions"
ACTIVE_POINTER_ID = "active"
PRODUCT_COLLECTION_PREFIX = "off_products_"
OPEN_FOOD_FACTS_BASE_URL = "https://world.openfoodfacts.org"

LOCALIZED_NAME_FIELDS = (
    ("product_name", None),
    ("product_name_en", "en"),
    ("product_name_km", "km"),
    ("product_name_th", "th"),
    ("product_name_vi", "vi"),
    ("product_name_zh", "zh"),
)
LOCALIZED_INGREDIENT_FIELDS = (
    ("ingredients_text", None),
    ("ingredients_text_en", "en"),
    ("ingredients_text_km", "km"),
    ("ingredients_text_th", "th"),
    ("ingredients_text_vi", "vi"),
    ("ingredients_text_zh", "zh"),
)
NUTRITION_DECLARATION_FIELDS = (
    "energy",
    "energy-kj",
    "energy-kcal",
    "fat",
    "saturated-fat",
    "carbohydrates",
    "sugars",
    "fiber",
    "proteins",
    "salt",
    "sodium",
)


class OpenFoodFactsDatasetSource:
    def __init__(self, database: Database[dict[str, Any]]) -> None:
        self._database = database
        self._source_metadata = ExternalSourceMetadata(
            name="Open Food Facts",
            source_type="COMMUNITY_DATABASE",
            base_url=OPEN_FOOD_FACTS_BASE_URL,
            attribution="Open Food Facts contributors",
            database_license="ODbL",
            contents_license="Database Contents License",
            image_license="CC BY-SA",
        )

    @property
    def metadata(self) -> ExternalSourceMetadata:
        return self._source_metadata

    def fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        try:
            pointer = self._database[CONTROL_COLLECTION].find_one(
                {"_id": ACTIVE_POINTER_ID}
            )
            if pointer is None or not isinstance(pointer.get("active_version_id"), str):
                return _unavailable(identifier)
            version_id = pointer["active_version_id"]
            manifest = self._database[VERSIONS_COLLECTION].find_one(
                {"_id": version_id, "status": "ACTIVE"}
            )
            if manifest is None:
                return _unavailable(identifier)
            dataset_version = _dataset_version(manifest)
            collection_name = manifest.get("collection_name")
            if not isinstance(collection_name, str):
                return _unavailable(identifier)
            product = self._database[collection_name].find_one(
                {"code": identifier.value}
            )
        except (PyMongoError, KeyError, TypeError, ValueError):
            return _unavailable(identifier)

        if product is None:
            return ExternalPackageNotFound(
                identifier=identifier.value,
                source=self._source_metadata,
                dataset_version=dataset_version,
            )
        if product.get("code") != identifier.value:
            return _unavailable(identifier)
        return ExternalPackageFound(
            record=_record_from_product(
                identifier,
                product,
                self._source_metadata,
                dataset_version,
            )
        )


def _dataset_version(manifest: dict[str, Any]) -> ExternalDatasetVersion:
    retrieved_at = manifest.get("retrieval_completed_at")
    activated_at = manifest.get("activated_at")
    source_url = manifest.get("source_url")
    sha256 = manifest.get("sha256")
    version_id = manifest.get("_id")
    if not isinstance(retrieved_at, datetime) or not isinstance(activated_at, datetime):
        raise ValueError("Dataset version dates are missing")
    if (
        not isinstance(source_url, str)
        or not source_url
        or not isinstance(sha256, str)
        or not sha256
        or not isinstance(version_id, str)
        or not version_id
    ):
        raise ValueError("Dataset version identity is incomplete")
    return ExternalDatasetVersion(
        id=version_id,
        source_url=source_url,
        retrieved_at=_as_utc(retrieved_at),
        activated_at=_as_utc(activated_at),
        sha256=sha256,
    )


def _record_from_product(
    identifier: NormalizedIdentifier,
    product: dict[str, Any],
    source: ExternalSourceMetadata,
    dataset_version: ExternalDatasetVersion,
) -> ExternalPackageRecord:
    primary_language = _non_empty_string(product.get("lang"))
    source_url = f"{OPEN_FOOD_FACTS_BASE_URL}/product/{identifier.value}"
    return ExternalPackageRecord(
        identifier=identifier.value,
        source_record_id=identifier.value,
        request_url=dataset_version.source_url,
        source_url=source_url,
        retrieved_at=dataset_version.retrieved_at,
        source_revision=_source_revision(product.get("last_modified_t")),
        source=source,
        dataset_version=dataset_version,
        names=_localized_texts(product, LOCALIZED_NAME_FIELDS, primary_language),
        brands=_brands(product),
        quantity=_string_value(product, "quantity"),
        selected_images=_selected_images(product),
        ingredient_texts=_localized_texts(
            product, LOCALIZED_INGREDIENT_FIELDS, primary_language
        ),
        allergen_declaration=_string_value(
            product, "allergens", language=primary_language
        ),
        allergen_tags=_string_tuple_value(product, "allergens_tags"),
        trace_declaration=_string_value(product, "traces", language=primary_language),
        trace_tags=_string_tuple_value(product, "traces_tags"),
        nutrition=_nutrition(product),
        packaging_languages=_string_tuple_value(product, "languages_tags"),
        countries_sold=_string_tuple_value(product, "countries_tags"),
    )


def _unavailable(identifier: NormalizedIdentifier) -> ExternalPackageUnavailable:
    return ExternalPackageUnavailable(
        identifier=identifier.value,
        reason=ExternalSourceUnavailableReason.DATASET_UNAVAILABLE,
    )


def _localized_texts(
    product: dict[str, Any],
    fields: tuple[tuple[str, str | None], ...],
    primary_language: str | None,
) -> tuple[SourcedValue[str], ...]:
    values: list[SourcedValue[str]] = []
    for source_field, language in fields:
        value = _non_empty_string(product.get(source_field))
        if value is not None:
            values.append(
                SourcedValue(
                    value=value,
                    source_field=source_field,
                    language=primary_language if language is None else language,
                )
            )
    return tuple(values)


def _brands(product: dict[str, Any]) -> SourcedValue[tuple[str, ...]] | None:
    value = _non_empty_string(product.get("brands"))
    if value is None:
        return None
    brands = tuple(brand.strip() for brand in value.split(",") if brand.strip())
    return SourcedValue(value=brands, source_field="brands") if brands else None


def _string_value(
    product: dict[str, Any], field: str, *, language: str | None = None
) -> SourcedValue[str] | None:
    value = _non_empty_string(product.get(field))
    return (
        SourcedValue(value=value, source_field=field, language=language)
        if value is not None
        else None
    )


def _string_tuple_value(
    product: dict[str, Any], field: str
) -> SourcedValue[tuple[str, ...]] | None:
    raw_value = product.get(field)
    if not isinstance(raw_value, list):
        return None
    values = tuple(value for value in raw_value if isinstance(value, str) and value)
    return SourcedValue(value=values, source_field=field) if values else None


def _selected_images(product: dict[str, Any]) -> tuple[ExternalSelectedImage, ...]:
    selected_images = product.get("selected_images")
    if not isinstance(selected_images, dict):
        return ()
    images: list[ExternalSelectedImage] = []
    for role, variants in selected_images.items():
        if not isinstance(role, str) or not isinstance(variants, dict):
            continue
        display = variants.get("display")
        if not isinstance(display, dict):
            continue
        for language, raw_url in display.items():
            url = _non_empty_string(raw_url)
            if isinstance(language, str) and url is not None:
                images.append(
                    ExternalSelectedImage(
                        role=role,
                        url=url,
                        source_field=f"selected_images.{role}.display.{language}",
                        language=language,
                    )
                )
    return tuple(images)


def _nutrition(product: dict[str, Any]) -> tuple[SourcedValue[JsonValue], ...]:
    values: list[SourcedValue[JsonValue]] = []
    raw_nutriments = product.get("nutriments")
    if isinstance(raw_nutriments, dict):
        nutriments = {
            field: value
            for field, value in raw_nutriments.items()
            if isinstance(field, str) and _is_nutrition_declaration_field(field)
        }
        if nutriments:
            values.append(SourcedValue(value=nutriments, source_field="nutriments"))
    for field in ("nutrition_data_per", "nutrition_data_prepared_per", "serving_size"):
        value = product.get(field)
        if value not in (None, "", [], {}):
            values.append(SourcedValue(value=value, source_field=field))
    return tuple(values)


def _is_nutrition_declaration_field(field: str) -> bool:
    return any(
        field == declaration or field.startswith(f"{declaration}_")
        for declaration in NUTRITION_DECLARATION_FIELDS
    )


def _source_revision(value: object) -> str | None:
    if isinstance(value, (int, str)) and str(value):
        return str(value)
    return None


def _non_empty_string(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def product_json(product: dict[str, Any]) -> bytes:
    """Stable helper for audit/debug tooling without persisting relational snapshots."""
    return json.dumps(product, sort_keys=True, separators=(",", ":")).encode()
