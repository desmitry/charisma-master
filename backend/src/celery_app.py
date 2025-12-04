from celery import Celery

from src.config import settings

celery_app = Celery(
    "speech_ANALysis",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    imports=["src.logic.tasks"],
)
