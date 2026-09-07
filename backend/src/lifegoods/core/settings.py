from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from lifegoods.translation.deadline import DEFAULT_TRANSLATION_DEADLINE_SECONDS

DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL = "https://images.openfoodfacts.org"
DEFAULT_OPEN_FOOD_FACTS_IMAGE_TIMEOUT_SECONDS = 2.0
DEFAULT_OPEN_FOOD_FACTS_USER_AGENT = (
    "LifeGoods/0.1.0 (https://github.com/internetOnion/life-goods)"
)
DEFAULT_OPEN_FOOD_FACTS_IMAGE_REQUESTS_PER_MINUTE = 60
DEFAULT_OFF_MONGODB_URI = (
    "mongodb://lifegoods_reader:lifegoods_reader@localhost:27018/lifegoods_off"
)
DEFAULT_OFF_MONGODB_DATABASE = "lifegoods_off"
DEFAULT_OFF_MONGODB_TIMEOUT_MS = 2_000
DEFAULT_GENERATED_MONGODB_URI = (
    "mongodb://lifegoods_generated:lifegoods_generated@localhost:27018/lifegoods_generated"
)
DEFAULT_GENERATED_MONGODB_DATABASE = "lifegoods_generated"
DEFAULT_GENERATED_MONGODB_TIMEOUT_MS = 2_000
DEFAULT_REDIS_URL = "redis://localhost:6380/0"
DEFAULT_REDIS_TIMEOUT_SECONDS = 0.5
DEFAULT_PRODUCT_LOOKUP_CACHE_ENABLED = True
DEFAULT_PRODUCT_LOOKUP_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
DEFAULT_PRODUCT_LOOKUP_REQUESTS_PER_MINUTE = 60
DEFAULT_GENERATED_TRANSLATION_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
DEFAULT_GENERATED_TRANSLATION_LEASE_TTL_SECONDS = 5.0
DEFAULT_GENERATED_TRANSLATION_COOLDOWN_SECONDS = 60
DEFAULT_GENERATED_TRANSLATION_BUDGET_PER_MINUTE = 60
DEFAULT_GENERATED_TRANSLATION_POLL_INTERVAL_SECONDS = 0.05
DEFAULT_GEMINI_TRANSLATION_TIMEOUT_SECONDS = 12.0


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LIFEGOODS_",
        env_file=(".env", "backend/.env"),
        extra="ignore",
        populate_by_name=True,
    )

    allowed_origins: tuple[str, ...] = ("http://localhost:5173",)
    open_food_facts_image_base_url: str = DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL
    open_food_facts_image_timeout_seconds: float = (
        DEFAULT_OPEN_FOOD_FACTS_IMAGE_TIMEOUT_SECONDS
    )
    open_food_facts_user_agent: str = DEFAULT_OPEN_FOOD_FACTS_USER_AGENT
    open_food_facts_image_requests_per_minute: int = (
        DEFAULT_OPEN_FOOD_FACTS_IMAGE_REQUESTS_PER_MINUTE
    )
    off_mongodb_uri: str = DEFAULT_OFF_MONGODB_URI
    off_mongodb_database: str = DEFAULT_OFF_MONGODB_DATABASE
    off_mongodb_timeout_ms: int = DEFAULT_OFF_MONGODB_TIMEOUT_MS
    generated_mongodb_uri: str = DEFAULT_GENERATED_MONGODB_URI
    generated_mongodb_database: str = DEFAULT_GENERATED_MONGODB_DATABASE
    generated_mongodb_timeout_ms: int = DEFAULT_GENERATED_MONGODB_TIMEOUT_MS
    redis_url: str = DEFAULT_REDIS_URL
    redis_timeout_seconds: float = DEFAULT_REDIS_TIMEOUT_SECONDS
    product_lookup_cache_enabled: bool = DEFAULT_PRODUCT_LOOKUP_CACHE_ENABLED
    product_lookup_cache_ttl_seconds: int = DEFAULT_PRODUCT_LOOKUP_CACHE_TTL_SECONDS
    product_lookup_requests_per_minute: int = DEFAULT_PRODUCT_LOOKUP_REQUESTS_PER_MINUTE
    generated_translation_cache_ttl_seconds: int = (
        DEFAULT_GENERATED_TRANSLATION_CACHE_TTL_SECONDS
    )
    generated_translation_lease_ttl_seconds: float = (
        DEFAULT_GENERATED_TRANSLATION_LEASE_TTL_SECONDS
    )
    generated_translation_cooldown_seconds: int = (
        DEFAULT_GENERATED_TRANSLATION_COOLDOWN_SECONDS
    )
    generated_translation_budget_per_minute: int = (
        DEFAULT_GENERATED_TRANSLATION_BUDGET_PER_MINUTE
    )
    generated_translation_poll_interval_seconds: float = (
        DEFAULT_GENERATED_TRANSLATION_POLL_INTERVAL_SECONDS
    )
    translation_deadline_seconds: float = Field(
        default=DEFAULT_TRANSLATION_DEADLINE_SECONDS,
        gt=0,
        allow_inf_nan=False,
        description="Total translation-stage budget in seconds",
    )
    gemini_translation_timeout_seconds: float = Field(
        default=DEFAULT_GEMINI_TRANSLATION_TIMEOUT_SECONDS,
        gt=0,
        allow_inf_nan=False,
    )
    gemini_api_key: str | None = Field(
        default=None,
        repr=False,
        validation_alias=AliasChoices(
            "LIFEGOODS_GEMINI_API_KEY",
            "GEMINI_API_KEY",
            "gemini_api_key",
        ),
    )
