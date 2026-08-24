from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LIFEGOODS_", env_file=".env")

    database_url: str = "postgresql+psycopg://lifegoods:lifegoods@localhost:5433/lifegoods"
    allowed_origins: tuple[str, ...] = ("http://localhost:5173",)
    open_food_facts_base_url: str = "https://world.openfoodfacts.org"
    open_food_facts_timeout_seconds: float = 2.0
    open_food_facts_user_agent: str = (
        "LifeGoods/0.1.0 (https://github.com/internetOnion/life-goods)"
    )
