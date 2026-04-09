from celery import Celery

from app.config import settings

celery_app = Celery(
    "speech_analysis",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
