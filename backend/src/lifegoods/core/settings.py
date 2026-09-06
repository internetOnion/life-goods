from typing import Literal

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_OPEN_FOOD_FACTS_API_BASE_URL = "https://world.openfoodfacts.org/api/v2"
DEFAULT_OPEN_FOOD_FACTS_API_TIMEOUT_SECONDS = 10.0
DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL = "https://images.openfoodfacts.org"
DEFAULT_OPEN_FOOD_FACTS_IMAGE_TIMEOUT_SECONDS = 2.0
DEFAULT_OPEN_FOOD_FACTS_USER_AGENT = (
    "LifeGoods/0.1.0 (https://github.com/internetOnion/life-goods)"
)
DEFAULT_OPEN_FOOD_FACTS_IMAGE_REQUESTS_PER_MINUTE = 60
DEFAULT_PACKAGE_MATCH_REQUESTS_PER_MINUTE = 60
DEFAULT_PACKAGE_SEARCH_REQUESTS_PER_MINUTE = 30
DEFAULT_PACKAGE_MATCH_RATE_LIMIT_FALLBACK_SECONDS = 5.0
DEFAULT_PACKAGE_MATCH_RATE_LIMIT_LOCAL_MAX_KEYS = 10_000
DEFAULT_PACKAGE_SEARCH_REQUESTS_PER_MINUTE = 60
DEFAULT_OFF_MONGODB_URI = (
    "mongodb://lifegoods_reader:lifegoods_reader@localhost:27018/lifegoods_off"
)
DEFAULT_OFF_MONGODB_DATABASE = "lifegoods_off"
DEFAULT_OFF_MONGODB_TIMEOUT_MS = 2_000
DEFAULT_ASSESSMENT_ENGINE_VERSION = "0.1.0"
DEFAULT_REDIS_URL = "redis://localhost:6380/0"
DEFAULT_REDIS_TIMEOUT_SECONDS = 0.5
DEFAULT_ASSESSMENT_CACHE_ENABLED = True
DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
DEFAULT_PRODUCT_LOOKUP_CACHE_ENABLED = True
DEFAULT_PRODUCT_LOOKUP_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
DEFAULT_PRODUCT_LOOKUP_REQUESTS_PER_MINUTE = 60


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LIFEGOODS_",
        env_file=(".env", "backend/.env"),
        extra="ignore",
        populate_by_name=True,
    )

    environment: str = "development"
    database_url: str = "postgresql+psycopg://lifegoods:lifegoods@localhost:5433/lifegoods"
    allowed_origins: tuple[str, ...] = ("http://localhost:5173",)
    open_food_facts_image_base_url: str = DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL
    open_food_facts_image_timeout_seconds: float = (
        DEFAULT_OPEN_FOOD_FACTS_IMAGE_TIMEOUT_SECONDS
    )
    open_food_facts_user_agent: str = DEFAULT_OPEN_FOOD_FACTS_USER_AGENT
    open_food_facts_image_requests_per_minute: int = (
        DEFAULT_OPEN_FOOD_FACTS_IMAGE_REQUESTS_PER_MINUTE
    )
    product_lookup_source: Literal["dataset", "open_food_facts_api"] = "dataset"
    open_food_facts_api_base_url: str = DEFAULT_OPEN_FOOD_FACTS_API_BASE_URL
    open_food_facts_api_timeout_seconds: float = (
        DEFAULT_OPEN_FOOD_FACTS_API_TIMEOUT_SECONDS
    )
    package_match_requests_per_minute: int = DEFAULT_PACKAGE_MATCH_REQUESTS_PER_MINUTE
    package_search_requests_per_minute: int = DEFAULT_PACKAGE_SEARCH_REQUESTS_PER_MINUTE
    package_match_rate_limit_fallback_seconds: float = (
        DEFAULT_PACKAGE_MATCH_RATE_LIMIT_FALLBACK_SECONDS
    )
    package_match_rate_limit_local_max_keys: int = (
        DEFAULT_PACKAGE_MATCH_RATE_LIMIT_LOCAL_MAX_KEYS
    )
    package_search_requests_per_minute: int = DEFAULT_PACKAGE_SEARCH_REQUESTS_PER_MINUTE
    off_mongodb_uri: str = DEFAULT_OFF_MONGODB_URI
    off_mongodb_database: str = DEFAULT_OFF_MONGODB_DATABASE
    off_mongodb_timeout_ms: int = DEFAULT_OFF_MONGODB_TIMEOUT_MS
    allergen_assessments_enabled: bool = False
    assessment_engine_version: str = DEFAULT_ASSESSMENT_ENGINE_VERSION
    halal_ingredient_assessments_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "LIFEGOODS_HALAL_INGREDIENT_ASSESSMENTS_ENABLED",
            "LIFEGOODS_HALAL_ASSESSMENTS_ENABLED",
        ),
    )
    halal_ingredient_assessment_engine_version: str = Field(
        default=DEFAULT_ASSESSMENT_ENGINE_VERSION,
        validation_alias=AliasChoices(
            "LIFEGOODS_HALAL_INGREDIENT_ASSESSMENT_ENGINE_VERSION",
            "LIFEGOODS_HALAL_ASSESSMENT_ENGINE_VERSION",
        ),
    )
    redis_url: str = DEFAULT_REDIS_URL
    redis_timeout_seconds: float = DEFAULT_REDIS_TIMEOUT_SECONDS
    assessment_cache_enabled: bool = DEFAULT_ASSESSMENT_CACHE_ENABLED
    assessment_cache_ttl_seconds: int = DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS
    product_lookup_cache_enabled: bool = DEFAULT_PRODUCT_LOOKUP_CACHE_ENABLED
    product_lookup_cache_ttl_seconds: int = DEFAULT_PRODUCT_LOOKUP_CACHE_TTL_SECONDS
    product_lookup_requests_per_minute: int = DEFAULT_PRODUCT_LOOKUP_REQUESTS_PER_MINUTE
    # Retained only for configuration compatibility; MVP-1 never consults it.
    project_catalog_enabled: bool = False

    @model_validator(mode="after")
    def _fail_fast_on_known_defaults_in_production(self) -> "Settings":
        env = self.environment.strip().lower()
        if env not in {"production", "prod"}:
            return self
        if "lifegoods:lifegoods@" in self.database_url:
            raise ValueError(
                "LIFEGOODS_DATABASE_URL must not use the development default "
                "credentials in the production environment."
            )
        if "lifegoods_reader:lifegoods_reader@" in self.off_mongodb_uri:
            raise ValueError(
                "LIFEGOODS_OFF_MONGODB_URI must not use the development default "
                "credentials in the production environment."
            )
        if "redis://localhost:6380/0" in self.redis_url:
            raise ValueError(
                "LIFEGOODS_REDIS_URL must point at an authenticated Redis instance "
                "in the production environment."
            )
        return self
