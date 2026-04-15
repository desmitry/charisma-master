"""Per-subdirectory conftest for ml_engine tests.

Swaps sys.path so that `app` resolves to services/ml_worker, purging
any api_gateway `app.*` modules that a previous test module may have
loaded. An autouse fixture guarantees this happens for every test.
"""

from __future__ import annotations

import pytest

from tests.conftest import load_ml_worker_module


@pytest.fixture(autouse=True)
def _ensure_ml_worker_loaded():
    """Re-load ml_worker's `app` package before each test."""
    load_ml_worker_module("app.logic.ml_engine")
    yield


@pytest.fixture
def ml_engine_module():
    """Return the app.logic.ml_engine module (imported from ml_worker)."""
    return load_ml_worker_module("app.logic.ml_engine")


@pytest.fixture
def llm_client_module():
    """Return the app.logic.llm_client module (imported from ml_worker)."""
    return load_ml_worker_module("app.logic.llm_client")
