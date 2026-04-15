"""Per-subdirectory conftest for api_gateway tests.

Ensures the api_gateway `app` package is resolved (rather than
ml_worker's) each time an api_gateway test runs. We can't use a
module-scoped cache here because a different test module may have
swapped the `app` package in sys.modules between test runs.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.conftest import load_api_gateway


@pytest.fixture(autouse=True)
def _ensure_api_gateway_loaded():
    """Autouse fixture that re-loads api_gateway's `app` package.

    This runs before every test in tests/test_api_gateway/, guaranteeing
    that `sys.modules["app.*"]` refers to api_gateway and not ml_worker.
    """
    load_api_gateway()
    yield


@pytest.fixture
def client(_ensure_api_gateway_loaded) -> TestClient:
    """Return a TestClient bound to the api_gateway FastAPI app.

    The autouse ``_ensure_api_gateway_loaded`` fixture guarantees that
    ``sys.modules['app']`` already points at services/api_gateway/app by
    the time this fixture runs, so we can import the FastAPI app directly
    instead of re-triggering another full import sweep.
    """
    from app.main import app  # noqa: PLC0415

    return TestClient(app)
