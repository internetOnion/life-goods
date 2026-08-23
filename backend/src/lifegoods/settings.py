from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LIFEGOODS_", env_file=".env")

    database_url: str = "postgresql+psycopg://lifegoods:lifegoods@localhost:5432/lifegoods"
    allowed_origins: tuple[str, ...] = ("http://localhost:5173",)
