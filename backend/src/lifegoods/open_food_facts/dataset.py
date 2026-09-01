import json
import logging
import re
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
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
DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL = "https://images.openfoodfacts.org"
MANIFEST_CACHE_MAX_VERSIONS = 8

logger = logging.getLogger(__name__)

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
LOCALIZED_STORAGE_FIELDS = (
    ("conservation_conditions", None),
    ("conservation_conditions_en", "en"),
    ("conservation_conditions_km", "km"),
    ("conservation_conditions_th", "th"),
    ("conservation_conditions_vi", "vi"),
    ("conservation_conditions_zh", "zh"),
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


@dataclass(frozen=True, slots=True)
class _ResolvedDataset:
    collection_name: str
    version: ExternalDatasetVersion


class OpenFoodFactsDatasetSource:
    def __init__(
        self,
        database: Database[dict[str, Any]],
        *,
        image_base_url: str = DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL,
    ) -> None:
        self._database = database
        self._image_base_url = image_base_url
        self._manifest_cache: OrderedDict[str, _ResolvedDataset] = OrderedDict()
        self._manifest_cache_lock = Lock()
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

    @property
    def database(self) -> Database[dict[str, Any]]:
        """MongoDB database used by this immutable dataset source."""
        return self._database

    def fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        try:
            pointer = self._database[CONTROL_COLLECTION].find_one(
                {"_id": ACTIVE_POINTER_ID}
            )
            if pointer is None or not isinstance(pointer.get("active_version_id"), str):
                _log_off_unavailable("read_active_pointer", "metadata_invalid")
                return _unavailable(identifier)
            version_id = pointer["active_version_id"]
            resolved = self._cached_manifest(version_id)
            if resolved is None:
                resolved = self._resolve_manifest(version_id)
            if resolved is None:
                return _unavailable(identifier)
            product = self._database[resolved.collection_name].find_one(
                {"code": identifier.value}
            )
            if product is None and not self._collection_exists(resolved.collection_name):
                _log_off_unavailable("verify_product_collection", "collection_missing")
                return _unavailable(identifier)
        except (PyMongoError, KeyError, TypeError, ValueError) as error:
            _log_off_unavailable("fetch_package_match", "dependency_error", error)
            return _unavailable(identifier)

        if product is None:
            return ExternalPackageNotFound(
                identifier=identifier.value,
                source=self._source_metadata,
                dataset_version=resolved.version,
            )
        if product.get("code") != identifier.value:
            _log_off_unavailable("validate_product", "record_invalid")
            return _unavailable(identifier)
        return ExternalPackageFound(
            record=_record_from_product(
                identifier,
                product,
                self._source_metadata,
                resolved.version,
                self._image_base_url,
            )
        )

    def fetch_many(
        self,
        version_id: str,
        identifiers: tuple[NormalizedIdentifier, ...],
    ) -> tuple[ExternalLookupResult, ...]:
        """Fetch several Products from one pinned OFF Dataset Version."""
        if not identifiers:
            return ()
        try:
            resolved = self._cached_manifest(version_id)
            if resolved is None:
                resolved = self._resolve_manifest(version_id)
            if resolved is None:
                return tuple(_unavailable(identifier) for identifier in identifiers)
            products = {
                product.get("code"): product
                for product in self._database[resolved.collection_name].find(
                    {"code": {"$in": [identifier.value for identifier in identifiers]}}
                )
                if isinstance(product.get("code"), str)
            }
        except (PyMongoError, KeyError, TypeError, ValueError) as error:
            _log_off_unavailable("fetch_packages", "dependency_error", error)
            return tuple(_unavailable(identifier) for identifier in identifiers)

        results: list[ExternalLookupResult] = []
        for identifier in identifiers:
            product = products.get(identifier.value)
            if product is None:
                results.append(
                    ExternalPackageNotFound(
                        identifier=identifier.value,
                        source=self._source_metadata,
                        dataset_version=resolved.version,
                    )
                )
                continue
            if product.get("code") != identifier.value:
                _log_off_unavailable("validate_product", "record_invalid")
                results.append(_unavailable(identifier))
                continue
            results.append(
                ExternalPackageFound(
                    record=_record_from_product(
                        identifier,
                        product,
                        self._source_metadata,
                        resolved.version,
                        self._image_base_url,
                    )
                )
            )
        return tuple(results)

    def _cached_manifest(self, version_id: str) -> _ResolvedDataset | None:
        with self._manifest_cache_lock:
            resolved = self._manifest_cache.get(version_id)
            if resolved is not None:
                self._manifest_cache.move_to_end(version_id)
            return resolved

    def _resolve_manifest(self, version_id: str) -> _ResolvedDataset | None:
        # The pointer is authoritative. Manifest status is operational metadata and
        # must not make a correctly pointed dataset unreadable during cutover.
        manifest = self._database[VERSIONS_COLLECTION].find_one({"_id": version_id})
        if manifest is None or manifest.get("status") not in {"READY", "ACTIVE"}:
            _log_off_unavailable("resolve_manifest", "metadata_invalid")
            return None
        version = _dataset_version(manifest)
        collection_name = manifest.get("collection_name")
        if not isinstance(collection_name, str) or not collection_name:
            _log_off_unavailable("resolve_manifest", "metadata_invalid")
            return None
        if not self._collection_exists(collection_name):
            _log_off_unavailable("resolve_manifest", "collection_missing")
            return None
        resolved = _ResolvedDataset(collection_name=collection_name, version=version)
        with self._manifest_cache_lock:
            existing = self._manifest_cache.setdefault(version_id, resolved)
            self._manifest_cache.move_to_end(version_id)
            while len(self._manifest_cache) > MANIFEST_CACHE_MAX_VERSIONS:
                self._manifest_cache.popitem(last=False)
            return existing

    def _collection_exists(self, collection_name: str) -> bool:
        return bool(
            self._database.list_collection_names(filter={"name": collection_name})
        )


def _log_off_unavailable(
    operation: str,
    failure_category: str,
    error: Exception | None = None,
) -> None:
    logger.warning(
        "Open Food Facts dataset operation unavailable",
        extra={
            "event": "off_dataset_unavailable",
            "dependency": "mongodb",
            "operation": operation,
            "failure_category": failure_category,
            "error_category": type(error).__name__ if error is not None else None,
        },
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
    image_base_url: str = DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL,
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
        selected_images=_selected_images(product, identifier.value, image_base_url),
        ingredient_texts=_localized_texts(
            product, LOCALIZED_INGREDIENT_FIELDS, primary_language
        ),
        allergen_declaration=_string_value(
            product, "allergens", language=primary_language
        ),
        allergen_tags=_string_tuple_value(product, "allergens_tags"),
        trace_declaration=_string_value(product, "traces", language=primary_language),
        trace_tags=_string_tuple_value(product, "traces_tags"),
        additives=_string_tuple_value(product, "additives_tags"),
        manufacturing_places=_string_value(
            product, "manufacturing_places", language=primary_language
        ),
        storage_conditions=_localized_texts(
            product, LOCALIZED_STORAGE_FIELDS, primary_language, deduplicate=True
        ),
        halal_label_claim=_halal_label_claim(product),
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
    *,
    deduplicate: bool = False,
) -> tuple[SourcedValue[str], ...]:
    values: list[SourcedValue[str]] = []
    seen: set[tuple[str, str | None]] = set()
    for source_field, language in fields:
        value = _non_empty_string(product.get(source_field))
        if value is not None:
            resolved_language = primary_language if language is None else language
            if deduplicate and (value, resolved_language) in seen:
                continue
            seen.add((value, resolved_language))
            values.append(
                SourcedValue(
                    value=value,
                    source_field=source_field,
                    language=resolved_language,
                )
            )
    known_fields = {source_field for source_field, _ in fields}
    base_field = fields[0][0]
    for source_field, raw_value in product.items():
        if source_field in known_fields or not source_field.startswith(f"{base_field}_"):
            continue
        language = source_field.rsplit("_", 1)[-1]
        if len(language) != 2 or not language.isalpha():
            continue
        value = _non_empty_string(raw_value)
        if value is None:
            continue
        resolved = SourcedValue(value=value, source_field=source_field, language=language)
        if not deduplicate or (value, language) not in seen:
            values.append(resolved)
            seen.add((value, language))
    return tuple(values)


def _halal_label_claim(product: dict[str, Any]) -> SourcedValue[tuple[str, ...]] | None:
    raw_value = product.get("labels_tags")
    if not isinstance(raw_value, list):
        return None
    values = tuple(
        value
        for value in raw_value
        if isinstance(value, str) and value.lower() == "en:halal"
    )
    return SourcedValue(value=values, source_field="labels_tags") if values else None


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


def _barcode_image_path(barcode: str) -> str:
    if len(barcode) > 8 and barcode.isdigit():
        match = re.match(r"^(\d{3})(\d{3})(\d{3})(\d+)$", barcode)
        if match:
            return "/".join(match.groups())
    return barcode


def _selected_images(
    product: dict[str, Any],
    barcode: str,
    image_base_url: str = DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL,
) -> tuple[ExternalSelectedImage, ...]:
    images: list[ExternalSelectedImage] = []
    seen_urls: set[str] = set()

    # 1. Raw MongoDB export structure: images.selected.<role>.<language>
    raw_images = product.get("images")
    if isinstance(raw_images, dict):
        selected = raw_images.get("selected")
        if isinstance(selected, dict):
            barcode_path = _barcode_image_path(barcode)
            for role, lang_map in selected.items():
                if not isinstance(role, str) or not isinstance(lang_map, dict):
                    continue
                for language, details in lang_map.items():
                    if not isinstance(language, str) or not isinstance(details, dict):
                        continue
                    rev = details.get("rev")
                    rev_str = str(rev).strip() if rev is not None and str(rev).strip() else None
                    if rev_str is not None:
                        filename = f"{role}_{language}.{rev_str}.400.jpg"
                    else:
                        filename = f"{role}_{language}.400.jpg"
                    url = f"{image_base_url}/images/products/{barcode_path}/{filename}"
                    if url not in seen_urls:
                        seen_urls.add(url)
                        images.append(
                            ExternalSelectedImage(
                                role=role,
                                url=url,
                                source_field=f"images.selected.{role}.{language}",
                                language=language,
                                image_revision=rev_str,
                            )
                        )

    # 2. HTTP API response / fixture structure: selected_images.<role>.display.<language>
    raw_selected_images = product.get("selected_images")
    if isinstance(raw_selected_images, dict):
        for role, variants in raw_selected_images.items():
            if not isinstance(role, str) or not isinstance(variants, dict):
                continue
            display = variants.get("display")
            if not isinstance(display, dict):
                continue
            for language, raw_url in display.items():
                url = _non_empty_string(raw_url)
                if isinstance(language, str) and url is not None and url not in seen_urls:
                    seen_urls.add(url)
                    images.append(
                        ExternalSelectedImage(
                            role=role,
                            url=url,
                            source_field=f"selected_images.{role}.display.{language}",
                            language=language,
                            image_revision=_image_revision_from_url(url),
                        )
                    )

    # 3. Direct URL fields fallback
    primary_language = _non_empty_string(product.get("lang"))
    direct_fields = (
        ("image_front_url", "front"),
        ("image_ingredients_url", "ingredients"),
        ("image_nutrition_url", "nutrition"),
        ("image_packaging_url", "packaging"),
        ("image_url", "front"),
    )
    for field_name, role in direct_fields:
        raw_url = _non_empty_string(product.get(field_name))
        if raw_url is not None and raw_url not in seen_urls:
            seen_urls.add(raw_url)
            images.append(
                ExternalSelectedImage(
                    role=role,
                    url=raw_url,
                    source_field=field_name,
                    language=primary_language,
                    image_revision=_image_revision_from_url(raw_url),
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


def _image_revision_from_url(url: str) -> str | None:
    match = re.search(r"\.(\d+)\.(?:400\.)?(?:jpe?g|png|gif|webp)$", url, re.IGNORECASE)
    return match.group(1) if match else None


def _non_empty_string(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def product_json(product: dict[str, Any]) -> bytes:
    """Stable helper for audit/debug tooling without persisting relational snapshots."""
    return json.dumps(product, sort_keys=True, separators=(",", ":")).encode()
