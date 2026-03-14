"""
Thin Celery client used by the FastAPI app to send tasks to the worker.
Avoids importing worker code directly.
"""
from celery import Celery
from config import settings

_celery_app = None


def get_celery_app() -> Celery:
    global _celery_app
    if _celery_app is None:
        _celery_app = Celery(
            "app_client",
            broker=settings.CELERY_BROKER_URL,
            backend=settings.CELERY_RESULT_BACKEND,
        )
        _celery_app.conf.update(
            task_serializer="json",
            result_serializer="json",
            accept_content=["json"],
        )
    return _celery_app
