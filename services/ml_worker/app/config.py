from typing import Literal, Union

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
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

    database_url: str = Field(
        key="DATABASE_URL",
        default="postgresql://charisma:charisma@localhost:5432/charisma",
        validate_default=True,
        frozen=True,
    )

    seaweedfs_endpoint: str = Field(
        key="SEAWEEDFS_ENDPOINT",
        default="localhost:9222",
        validate_default=True,
        frozen=True,
    )
    seaweedfs_access_key: str = Field(
        key="SEAWEEDFS_ACCESS_KEY",
        default="",
        validate_default=True,
        frozen=True,
    )
    seaweedfs_secret_key: str = Field(
        key="SEAWEEDFS_SECRET_KEY",
        default="",
        validate_default=True,
        frozen=True,
    )

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
    sber_salute_credentials: str = Field(
        key="SBER_SALUTE_CREDENTIALS",
        default="",
        validate_default=True,
        frozen=True,
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
