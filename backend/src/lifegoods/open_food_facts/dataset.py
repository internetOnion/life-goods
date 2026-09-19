import json
import logging
import math
import re
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from time import monotonic
from typing import Any, cast

from pymongo import ASCENDING, TEXT
from pymongo.database import Database
from pymongo.errors import ExecutionTimeout, PyMongoError

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
from lifegoods.open_food_facts.search_index import (
    SEARCH_SORT_SPEC,
    SearchCursor,
    SearchIndexError,
    SearchIndexTimeoutError,
    search_sort_key,
    validate_search_index_readiness,
)
from lifegoods.product_lookup.models import (
    DatasetSnapshot,
    DatasetUnavailableError,
    InvalidSourceRecordError,
    SourceRecord,
)
from lifegoods.product_search.contracts import PRODUCT_SEARCH_PAGE_SIZE

CONTROL_COLLECTION = "off_dataset_control"
VERSIONS_COLLECTION = "off_dataset_versions"
ACTIVE_POINTER_ID = "active"
PRODUCT_COLLECTION_PREFIX = "off_products_"
PACKAGE_SEARCH_TEXT_INDEX = "idx_off_package_search_text"
PACKAGE_SEARCH_COUNTRY_INDEX = "idx_off_countries_tags"
PACKAGE_SEARCH_COUNTRY_TAG = "en:cambodia"
OPEN_FOOD_FACTS_BASE_URL = "https://world.openfoodfacts.org"
DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL = "https://images.openfoodfacts.org"
MANIFEST_CACHE_MAX_VERSIONS = 8

logger = logging.getLogger(__name__)

LOCALIZED_NAME_FIELDS = (
    ("product_name", None),
    ("product_name_en", "en"),
    ("product_name_fr", "fr"),
    ("product_name_km", "km"),
    ("product_name_th", "th"),
    ("product_name_vi", "vi"),
    ("product_name_zh", "zh"),
)
PACKAGE_SEARCH_TEXT_FIELDS = tuple((field, TEXT) for field, _language in LOCALIZED_NAME_FIELDS) + (
    ("brands", TEXT),
)
PACKAGE_SEARCH_TEXT_WEIGHTS = {field: 10 for field, _language in LOCALIZED_NAME_FIELDS} | {
    "brands": 8
}
LOCALIZED_INGREDIENT_FIELDS = (
    ("ingredients_text", None),
    ("ingredients_text_en", "en"),
    ("ingredients_text_fr", "fr"),
    ("ingredients_text_km", "km"),
    ("ingredients_text_th", "th"),
    ("ingredients_text_vi", "vi"),
    ("ingredients_text_zh", "zh"),
)
LOCALIZED_STORAGE_FIELDS = (
    ("conservation_conditions", None),
    ("conservation_conditions_en", "en"),
    ("conservation_conditions_fr", "fr"),
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
    def database(self) -> Database[dict[str, Any]]:
        """Expose the backing database to the optional package search index."""
        return self._database

    @property
    def metadata(self) -> ExternalSourceMetadata:
        return self._source_metadata

    def fetch(self, identifier: NormalizedIdentifier) -> ExternalLookupResult:
        try:
            pointer = self._database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID})
            if pointer is None or not isinstance(pointer.get("active_version_id"), str):
                _log_off_unavailable("read_active_pointer", "metadata_invalid")
                return _unavailable(identifier)
            version_id = pointer["active_version_id"]
            resolved = self._cached_manifest(version_id)
            if resolved is None:
                resolved = self._resolve_manifest(version_id)
            if resolved is None:
                return _unavailable(identifier)
            product = self._database[resolved.collection_name].find_one({"code": identifier.value})
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

    def resolve_product_lookup_snapshot(self) -> DatasetSnapshot:
        try:
            pointer = self._database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID})
            if pointer is None or not isinstance(pointer.get("active_version_id"), str):
                _log_off_unavailable("product_lookup_read_active_pointer", "metadata_invalid")
                raise DatasetUnavailableError("Dataset Snapshot pointer unavailable")
            version_id = pointer["active_version_id"]
            resolved = self._cached_manifest(version_id)
            if resolved is None:
                resolved = self._resolve_manifest(version_id)
            if resolved is None:
                raise DatasetUnavailableError("Dataset Snapshot manifest unavailable")
            return DatasetSnapshot(
                version=resolved.version.id,
                retrieved_at=resolved.version.retrieved_at,
                collection_name=resolved.collection_name,
            )
        except DatasetUnavailableError:
            raise
        except (PyMongoError, KeyError, TypeError, ValueError) as error:
            _log_off_unavailable("product_lookup_resolve_snapshot", "dependency_error", error)
            raise DatasetUnavailableError("Dataset Snapshot unavailable") from error

    def fetch_source_record(
        self,
        identifier: NormalizedIdentifier,
        snapshot: DatasetSnapshot,
    ) -> SourceRecord | None:
        try:
            product = self._database[snapshot.collection_name].find_one({"code": identifier.value})
            if product is None:
                if not self._collection_exists(snapshot.collection_name):
                    _log_off_unavailable(
                        "product_lookup_verify_product_collection",
                        "collection_missing",
                    )
                    raise DatasetUnavailableError("Dataset Snapshot Product collection unavailable")
                return None
        except DatasetUnavailableError:
            raise
        except (PyMongoError, KeyError, TypeError, ValueError) as error:
            _log_off_unavailable("product_lookup_fetch", "dependency_error", error)
            raise DatasetUnavailableError("Dataset Snapshot unavailable") from error

        source_record = {key: value for key, value in product.items() if key != "_id"}
        try:
            _validate_json_value(source_record)
        except (TypeError, ValueError) as error:
            raise InvalidSourceRecordError(
                "Source Record contains a non-JSON storage value"
            ) from error
        return cast(SourceRecord, source_record)

    def search_text(
        self,
        snapshot: DatasetSnapshot,
        terms: tuple[str, ...],
        normalized_query: str,
        cursor: SearchCursor | None = None,
        limit: int = PRODUCT_SEARCH_PAGE_SIZE,
    ) -> list[dict[str, Any]]:
        try:
            search_col_name = validate_search_index_readiness(self._database, snapshot.version)
        except SearchIndexError:
            raise
        except (PyMongoError, KeyError, TypeError, ValueError) as error:
            raise DatasetUnavailableError("Dataset Snapshot unavailable") from error

        earlier_terms = list(dict.fromkeys(terms[:-1]))
        final_term = terms[-1]
        escaped_final_term = re.escape(final_term)

        match_conditions: list[dict[str, Any]] = [
            {
                "$or": [
                    {"name_tokens": t},
                    {"brand_tokens": t},
                    {"country_tokens": t},
                ]
            }
            for t in earlier_terms
        ]
        match_conditions.append(
            {
                "$or": [
                    {"name_tokens": {"$regex": f"^{escaped_final_term}"}},
                    {"brand_tokens": {"$regex": f"^{escaped_final_term}"}},
                    {"country_tokens": {"$regex": f"^{escaped_final_term}"}},
                ]
            }
        )

        complete_final = {
            "$or": [
                {"name_tokens": final_term},
                {"brand_tokens": final_term},
                {"country_tokens": final_term},
            ]
        }
        exact_brand = {"brand_values": normalized_query}
        exact_name = {"name_values": normalized_query}
        exact_country = {"country_values": normalized_query}
        complete_conditions = match_conditions[:-1] + [complete_final]
        results: list[dict[str, Any]] = []
        deadline = monotonic() + 2
        try:
            def retrieve(
                conditions: list[dict[str, Any]], count: int, hint: str,
            ) -> list[dict[str, Any]]:
                positions: list[list[dict[str, Any]]] = [[]]
                if cursor is not None and rank == cursor.rank:
                    positions = [
                        [{"information_score": {"$lt": cursor.information_score}}],
                        [
                            {
                                "$or": [
                                    {"information_score": cursor.information_score},
                                    {"information_score": {"$exists": False}},
                                ]
                            },
                            {
                                "$or": [
                                    {"name_sort": {"$gt": cursor.name_sort}},
                                    {
                                        "name_sort": cursor.name_sort,
                                        "code": {"$gt": cursor.code},
                                    },
                                ]
                            },
                        ],
                    ]
                rows: list[dict[str, Any]] = []
                for position in positions:
                    remaining_ms = int((deadline - monotonic()) * 1000)
                    if remaining_ms <= 0:
                        raise ExecutionTimeout("Search execution budget exhausted")
                    rows.extend(self._database[search_col_name].aggregate(
                        [{"$match": {"$and": conditions + position}},
                         {"$sort": SEARCH_SORT_SPEC},
                         {"$limit": count - len(rows)}],
                        hint=hint, maxTimeMS=remaining_ms,
                    ))
                    if monotonic() >= deadline:
                        raise ExecutionTimeout("Search execution budget exhausted")
                    if len(rows) == count:
                        break
                return rows

            for rank in range(4):
                if cursor is not None and rank < cursor.rank:
                    continue
                count = limit + 1 - len(results)
                if rank < 2:
                    field = "brand_values" if rank == 0 else "name_values"
                    conditions = complete_conditions + [{field: normalized_query}]
                    if rank == 1:
                        conditions.append({"$nor": [exact_brand]})
                    rows = retrieve(conditions, count, f"ix_search_{field}_sort")
                elif rank == 2:
                    # Each equality stream has index-provided ordering. Merge only
                    # its bounded page, deduplicating Products matching several fields.
                    merged: dict[str, dict[str, Any]] = {}
                    for field in ("name_tokens", "brand_tokens", "country_tokens"):
                        conditions = complete_conditions + [
                            {field: final_term}, {"$nor": [exact_brand, exact_name]},
                        ]
                        for row in retrieve(conditions, count, f"ix_search_{field}_sort"):
                            merged[row["code"]] = row
                    rows = sorted(
                        merged.values(),
                        key=search_sort_key,
                    )[:count]
                else:
                    conditions = match_conditions + [
                        {"$nor": [exact_brand, exact_name, exact_country, complete_final]},
                    ]
                    if cursor is not None and rank == cursor.rank:
                        conditions.append(
                            {
                                "$or": [
                                    {"information_score": {"$lt": cursor.information_score}},
                                    {
                                        "$and": [
                                            {
                                                "$or": [
                                                    {"information_score": cursor.information_score},
                                                    {"information_score": {"$exists": False}},
                                                ]
                                            },
                                            {
                                                "$or": [
                                                    {"name_sort": {"$gt": cursor.name_sort}},
                                                    {
                                                        "name_sort": cursor.name_sort,
                                                        "code": {"$gt": cursor.code},
                                                    },
                                                ]
                                            },
                                        ]
                                    },
                                ]
                            }
                        )
                    pipeline = [{"$match": {"$and": conditions}},
                                {"$sort": SEARCH_SORT_SPEC}, {"$limit": count}]
                    remaining_ms = int((deadline - monotonic()) * 1000)
                    if remaining_ms <= 0:
                        raise ExecutionTimeout("Search execution budget exhausted")
                    options: dict[str, Any] = {"maxTimeMS": remaining_ms}
                    if len(final_term) <= 2:
                        # A bounded probe avoids a full sort-index scan for sparse prefixes.
                        # Only sort the probe when it contains the entire candidate set.
                        candidates = list(
                            self._database[search_col_name].aggregate(
                                [pipeline[0], {"$limit": 129}], **options
                            )
                        )
                        if len(candidates) <= 128:
                            rows = sorted(
                                candidates,
                                key=search_sort_key,
                            )[:count]
                        else:
                            options["maxTimeMS"] = int((deadline - monotonic()) * 1000)
                            if options["maxTimeMS"] <= 0:
                                raise ExecutionTimeout("Search execution budget exhausted")
                            options["hint"] = "ix_search_sort"
                            rows = list(
                                self._database[search_col_name].aggregate(pipeline, **options)
                            )
                    else:
                        rows = list(self._database[search_col_name].aggregate(pipeline, **options))
                results.extend({**row, "rank": rank} for row in rows)
                if monotonic() >= deadline:
                    raise ExecutionTimeout("Search execution budget exhausted")
                if len(results) == limit + 1:
                    break
            return results
        except ExecutionTimeout as error:
            raise SearchIndexTimeoutError("Search request timed out. Please try again.") from error
        except (PyMongoError, KeyError, TypeError, ValueError) as error:
            raise DatasetUnavailableError("Dataset Snapshot unavailable") from error

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
        try:
            return bool(self._database.list_collection_names(filter={"name": collection_name}))
        except TypeError:
            return collection_name in self._database.list_collection_names()


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


def _validate_json_value(value: Any) -> None:
    if value is None or isinstance(value, (bool, int, str)):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("Non-finite numbers are not JSON-compatible")
        return
    if isinstance(value, list):
        for item in value:
            _validate_json_value(item)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("JSON object keys must be strings")
            _validate_json_value(item)
        return
    raise TypeError("Value is not JSON-compatible")


def ensure_package_search_indexes(collection: Any) -> None:
    collection.create_index(
        list(PACKAGE_SEARCH_TEXT_FIELDS),
        name=PACKAGE_SEARCH_TEXT_INDEX,
        default_language="none",
        weights=PACKAGE_SEARCH_TEXT_WEIGHTS,
    )
    collection.create_index(
        [("countries_tags", ASCENDING)],
        name=PACKAGE_SEARCH_COUNTRY_INDEX,
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
        ingredient_texts=_localized_texts(product, LOCALIZED_INGREDIENT_FIELDS, primary_language),
        allergen_declaration=_string_value(product, "allergens", language=primary_language),
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
    return tuple(values)


def _halal_label_claim(product: dict[str, Any]) -> SourcedValue[tuple[str, ...]] | None:
    raw_value = product.get("labels_tags")
    if not isinstance(raw_value, list):
        return None
    values = tuple(
        value for value in raw_value if isinstance(value, str) and value.lower() == "en:halal"
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
