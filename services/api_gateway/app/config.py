from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_host: str = Field(
        key="SERVICE_HOST",
        default="0.0.0.0",
        validate_default=True,
        frozen=True,
    )
    service_port: int = Field(
        key="SERVICE_PORT",
        default=8000,
        validate_default=True,
        frozen=True,
    )
    origin_url: str = Field(
        key="ORIGIN_URL",
        default="*",
        validate_default=True,
        frozen=True,
    )
    mode: str = Field(
        key="MODE",
        default="prod",
        validate_default=True,
        frozen=True,
    )

    redis_url: str = Field(
        key="REDIS_URL",
        default="redis://localhost:6379/0",
        validate_default=True,
        frozen=True,
    )
    celery_broker_url: str = Field(
        key="CELERY_BROKER_URL",
        default="redis://localhost:6379/0",
        validate_default=True,
        frozen=True,
    )
    celery_result_backend: str = Field(
        key="CELERY_RESULT_BACKEND",
        default="redis://localhost:6379/0",
        validate_default=True,
        frozen=True,
    )

    base_dir: Path = Path(__file__).parent.parent.resolve()
    media_root: Path = base_dir / "app" / "media"
    presets_dir: Path = base_dir / "app" / "presets"
    results_dir: Path = media_root / "results"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()

settings.media_root.mkdir(parents=True, exist_ok=True)
settings.results_dir.mkdir(parents=True, exist_ok=True)
