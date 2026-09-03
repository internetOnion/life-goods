"""Open Food Facts integration: dataset reader, image caching proxy, CLI, and models."""

from lifegoods.open_food_facts.dataset import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    PACKAGE_SEARCH_COUNTRY_INDEX,
    PACKAGE_SEARCH_TEXT_INDEX,
    PRODUCT_COLLECTION_PREFIX,
    VERSIONS_COLLECTION,
    OpenFoodFactsDatasetSource,
    ensure_package_search_indexes,
)
from lifegoods.open_food_facts.image_router import (
    get_image_source,
)
from lifegoods.open_food_facts.image_router import (
    router as open_food_facts_image_router,
)
from lifegoods.open_food_facts.images import OpenFoodFactsImageSource
from lifegoods.open_food_facts.models import (
    ExternalDatasetVersion,
    ExternalImage,
    ExternalImageNotFoundError,
    ExternalImageSource,
    ExternalImageUnavailableError,
    ExternalImageUrlInvalidError,
    ExternalLookupResult,
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageRecord,
    ExternalPackageSource,
    ExternalPackageUnavailable,
    ExternalSelectedImage,
    ExternalSourceMetadata,
    ExternalSourceUnavailableReason,
    JsonValue,
    SourcedValue,
)

__all__ = [
    "ACTIVE_POINTER_ID",
    "CONTROL_COLLECTION",
    "ExternalDatasetVersion",
    "ExternalImage",
    "ExternalImageNotFoundError",
    "ExternalImageSource",
    "ExternalImageUnavailableError",
    "ExternalImageUrlInvalidError",
    "ExternalLookupResult",
    "ExternalPackageFound",
    "ExternalPackageNotFound",
    "ExternalPackageRecord",
    "ExternalPackageSource",
    "ExternalPackageUnavailable",
    "ExternalSelectedImage",
    "ExternalSourceMetadata",
    "ExternalSourceUnavailableReason",
    "JsonValue",
    "OpenFoodFactsDatasetSource",
    "OpenFoodFactsImageSource",
    "PRODUCT_COLLECTION_PREFIX",
    "PACKAGE_SEARCH_COUNTRY_INDEX",
    "PACKAGE_SEARCH_TEXT_INDEX",
    "SourcedValue",
    "VERSIONS_COLLECTION",
    "get_image_source",
    "ensure_package_search_indexes",
    "open_food_facts_image_router",
]
