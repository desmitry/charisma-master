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

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
