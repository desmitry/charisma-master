from pathlib import Path
from typing import Literal, Union

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_host: str = Field(
        key="SERVICE_HOST",
        default="0.0.0.0",  # noqa: S104
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
    mode: Literal["prod"] | Literal["dev"] = Field(
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

    base_dir: Path = Path(__file__).parent.parent.resolve() / "app"
    media_root: Path = base_dir / "media"
    results_dir: Path = media_root / "results"

    whisper_model_name: str = Field(
        key="WHISPER_MODEL_NAME",
        default="whisper-1",
        validate_default=True,
        frozen=False,
    )
    whisper_model_type: str = Field(
        key="WHISPER_MODEL_TYPE",
        default="medium",
        validate_default=True,
        frozen=False,
    )
    whisper_device: Union[Literal["cuda"], Literal["cpu"]] = Field(
        key="WHISPER_DEVICE",
        default="cuda",
        validate_default=True,
        frozen=False,
    )
    whisper_compute_type: str = Field(
        key="WHISPER_COMPUTE_TYPE",
        default="float16",
        validate_default=True,
        frozen=False,
    )

    openai_api_base: str = Field(
        key="OPENAI_API_BASE",
        default="https://api.openai.com/v1",
        validate_default=True,
        frozen=False,
    )
    openai_api_key: str = Field(
        key="OPENAI_API_KEY",
        default="",
        validate_default=True,
        frozen=False,
    )
    openai_model_name: str = Field(
        key="OPENAI_MODEL_NAME",
        default="gpt-4o-mini",
        validate_default=True,
        frozen=False,
    )

    gigachat_credentials: str = Field(
        key="GIGACHAT_CREDENTIALS",
        default="",
        validate_default=True,
        frozen=False,
    )
    gigachat_scope: str = Field(
        key="GIGACHAT_SCOPE",
        default="GIGACHAT_API_PERS",
        validate_default=True,
        frozen=False,
    )
    gigachat_model_name: str = Field(
        key="GIGACHAT_MODEL_NAME",
        default="GigaChat",
        validate_default=True,
        frozen=False,
    )
    gigachat_verify_ssl: bool = Field(
        key="GIGACHAT_VERIFY_SSL",
        default=False,
        validate_default=True,
        frozen=False,
    )

    sber_speech_scope: str = Field(
        key="SBER_SPEECH_SCOPE",
        default="SALUTE_SPEECH_B2B",
        validate_default=True,
        frozen=False,
    )

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()

settings.media_root.mkdir(parents=True, exist_ok=True)
settings.results_dir.mkdir(parents=True, exist_ok=True)
