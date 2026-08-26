from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_OPEN_FOOD_FACTS_BASE_URL = "https://world.openfoodfacts.org"
DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL = "https://images.openfoodfacts.org"
DEFAULT_OPEN_FOOD_FACTS_TIMEOUT_SECONDS = 2.0
DEFAULT_OPEN_FOOD_FACTS_USER_AGENT = (
    "LifeGoods/0.1.0 (https://github.com/internetOnion/life-goods)"
)
DEFAULT_OPEN_FOOD_FACTS_REQUESTS_PER_MINUTE = 12
DEFAULT_OPEN_FOOD_FACTS_IMAGE_REQUESTS_PER_MINUTE = 60


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LIFEGOODS_", env_file=".env")

    database_url: str = "postgresql+psycopg://lifegoods:lifegoods@localhost:5433/lifegoods"
    allowed_origins: tuple[str, ...] = ("http://localhost:5173",)
    open_food_facts_base_url: str = DEFAULT_OPEN_FOOD_FACTS_BASE_URL
    open_food_facts_image_base_url: str = DEFAULT_OPEN_FOOD_FACTS_IMAGE_BASE_URL
    open_food_facts_timeout_seconds: float = DEFAULT_OPEN_FOOD_FACTS_TIMEOUT_SECONDS
    open_food_facts_user_agent: str = DEFAULT_OPEN_FOOD_FACTS_USER_AGENT
    open_food_facts_requests_per_minute: int = DEFAULT_OPEN_FOOD_FACTS_REQUESTS_PER_MINUTE
    open_food_facts_image_requests_per_minute: int = (
        DEFAULT_OPEN_FOOD_FACTS_IMAGE_REQUESTS_PER_MINUTE
    )
