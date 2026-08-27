"""Open Food Facts integration: dataset reader, image caching proxy, CLI, and models."""

from lifegoods.open_food_facts.dataset import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    PRODUCT_COLLECTION_PREFIX,
    VERSIONS_COLLECTION,
    OpenFoodFactsDatasetSource,
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
    "SourcedValue",
    "VERSIONS_COLLECTION",
    "get_image_source",
    "open_food_facts_image_router",
]
