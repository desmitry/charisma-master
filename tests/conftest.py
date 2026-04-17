"""Shared fixtures and pre-import stubs for all test modules.

Charisma has two service packages both named `app`
(services/api_gateway/app and services/ml_worker/app). Because Python
caches by fully-qualified module name, we can only have one `app` loaded
at a time. The per-subdirectory conftests in tests/test_api_gateway and
tests/test_ml_engine each swap `sys.path` and purge any cached `app.*`
modules before importing their service.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

# Set minimal env vars BEFORE any service module imports. Pydantic settings
# in services/*/app/config.py will read these on module import.
os.environ.setdefault("MODE", "local")
os.environ.setdefault("ORIGIN_URL", "*")
os.environ.setdefault("SEAWEEDFS_ENDPOINT", "http://localhost:8333")
os.environ.setdefault("SEAWEEDFS_ACCESS_KEY", "test-key")
os.environ.setdefault("SEAWEEDFS_SECRET_KEY", "test-secret")
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")
os.environ.setdefault("POSTGRES_DB", "test")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault(
    "DATABASE_URL", "postgresql://test:test@localhost:5432/test"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
os.environ.setdefault("GIGACHAT_CREDENTIALS", "test-creds")
os.environ.setdefault("GIGACHAT_SCOPE", "GIGACHAT_API_PERS")
os.environ.setdefault("GIGACHAT_MODEL_NAME", "GigaChat")
os.environ.setdefault("GIGACHAT_VERIFY_SSL", "false")
os.environ.setdefault("OPENAI_API_BASE", "https://api.openai.com/v1")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("OPENAI_MODEL_NAME", "gpt-4")
os.environ.setdefault("WHISPER_MODEL_NAME", "whisper-1")
os.environ.setdefault("WHISPER_MODEL_TYPE", "base")
os.environ.setdefault("WHISPER_DEVICE", "cpu")
os.environ.setdefault("WHISPER_COMPUTE_TYPE", "int8")

REPO_ROOT = Path(__file__).resolve().parent.parent
API_GATEWAY_PATH = str(REPO_ROOT / "services" / "api_gateway")
ML_WORKER_PATH = str(REPO_ROOT / "services" / "ml_worker")


def _purge_app_modules() -> None:
    """Remove any cached ``app`` or ``app.*`` modules from sys.modules.

    Needed when swapping between service packages that both live under
    the top-level name ``app``.
    """
    for mod_name in list(sys.modules.keys()):
        if mod_name == "app" or mod_name.startswith("app."):
            del sys.modules[mod_name]


def load_api_gateway():
    """Set up sys.path for api_gateway and return ``app.main.app``.

    Purges any previously loaded ``app.*`` modules so this import
    resolves to services/api_gateway/app rather than ml_worker.
    """
    _purge_app_modules()
    # Remove ml_worker if present; put api_gateway first.
    while ML_WORKER_PATH in sys.path:
        sys.path.remove(ML_WORKER_PATH)
    if API_GATEWAY_PATH in sys.path:
        sys.path.remove(API_GATEWAY_PATH)
    sys.path.insert(0, API_GATEWAY_PATH)
    from app.main import app as fastapi_app  # noqa: PLC0415

    return fastapi_app


def load_ml_worker_module(dotted_name: str):
    """Import a module from services/ml_worker, purging api_gateway.

    Args:
        dotted_name: e.g. ``app.logic.ml_engine`` or
            ``app.logic.llm_client``.

    Returns:
        The imported module object.
    """
    _purge_app_modules()
    while API_GATEWAY_PATH in sys.path:
        sys.path.remove(API_GATEWAY_PATH)
    if ML_WORKER_PATH in sys.path:
        sys.path.remove(ML_WORKER_PATH)
    sys.path.insert(0, ML_WORKER_PATH)
    import importlib  # noqa: PLC0415

    return importlib.import_module(dotted_name)


# Ensure charisma_storage.ensure_buckets_exist does not do real I/O
# when api_gateway's main.py is imported.
import charisma_storage  # noqa: E402

charisma_storage.ensure_buckets_exist = MagicMock(return_value=None)

import pytest  # noqa: E402, F401
