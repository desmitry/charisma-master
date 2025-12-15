import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    debug: bool = True
    host: str = "0.0.0.0"  # noqa: S104
    port: int = 8000

    # Paths
    base_dir: Path = Path(__file__).parent.parent.resolve() / "app"
    media_root: Path = base_dir / "media"
    results_dir: Path = media_root / "results"

    # Redis & Celery
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    celery_broker_url: str = os.getenv(
        "CELERY_BROKER_URL",
        "redis://localhost:6379/0",
    )
    celery_result_backend: str = os.getenv(
        "CELERY_RESULT_BACKEND",
        "redis://localhost:6379/0",
    )

    # ML Models
    whisper_model_path: str = os.getenv("WHISPER_MODEL_PATH", "base")
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"

    # LLM
    openai_api_base: str = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "sk-placeholder")
    openai_model_name: str = os.getenv("OPENAI_MODEL_NAME", "gpt-3.5-turbo")

    gigachat_credentials: str | None = os.getenv("GIGACHAT_CREDENTIALS", None)
    gigachat_scope: str = "GIGACHAT_API_PERS"
    gigachat_verify_ssl: bool = False

    class Config:
        env_file = ".env"


settings = Settings()

settings.media_root.mkdir(parents=True, exist_ok=True)
settings.results_dir.mkdir(parents=True, exist_ok=True)
