from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL = "https://images.openfoodfacts.org"
DEFAULT_OPEN_FOOD_FACTS_IMAGE_TIMEOUT_SECONDS = 2.0
DEFAULT_OPEN_FOOD_FACTS_USER_AGENT = (
    "LifeGoods/0.1.0 (https://github.com/internetOnion/life-goods)"
)
DEFAULT_OPEN_FOOD_FACTS_IMAGE_REQUESTS_PER_MINUTE = 60
DEFAULT_PACKAGE_MATCH_REQUESTS_PER_MINUTE = 60
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


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LIFEGOODS_",
        env_file=(".env", "backend/.env"),
        extra="ignore",
    )

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
    package_match_requests_per_minute: int = DEFAULT_PACKAGE_MATCH_REQUESTS_PER_MINUTE
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
    halal_assessments_enabled: bool = False
    halal_ingredient_assessments_enabled: bool = False
    halal_assessment_engine_version: str = DEFAULT_ASSESSMENT_ENGINE_VERSION
    halal_ingredient_assessment_engine_version: str = (
        DEFAULT_ASSESSMENT_ENGINE_VERSION
    )
    redis_url: str = DEFAULT_REDIS_URL
    redis_timeout_seconds: float = DEFAULT_REDIS_TIMEOUT_SECONDS
    assessment_cache_enabled: bool = DEFAULT_ASSESSMENT_CACHE_ENABLED
    assessment_cache_ttl_seconds: int = DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS
    # Retained only for configuration compatibility; MVP-1 never consults it.
    project_catalog_enabled: bool = False
