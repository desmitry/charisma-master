"""Per-subdirectory conftest for api_gateway tests.

Ensures the api_gateway `app` package is resolved (rather than
ml_worker's) each time an api_gateway test runs. We can't use a
module-scoped cache here because a different test module may have
swapped the `app` package in sys.modules between test runs.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

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


_MOCK_USER = {
    "sub": "test-user-id",
    "email": "test@example.com",
    "roles": ["user"],
}


async def _mock_require_create_analysis():
    return _MOCK_USER


async def _mock_require_view_own_analysis():
    return _MOCK_USER


@pytest.fixture
def client(_ensure_api_gateway_loaded) -> TestClient:
    """Return a TestClient bound to the api_gateway FastAPI app.

    The autouse ``_ensure_api_gateway_loaded`` fixture guarantees that
    ``sys.modules['app']`` already points at services/api_gateway/app by
    the time this fixture runs, so we can import the FastAPI app directly
    instead of re-triggering another full import sweep.

    Auth dependencies (require_create_analysis, require_view_own_analysis)
    are overridden with a mock user to avoid needing JWT tokens or NATS
    during unit tests.
    ``get_redis_client`` is patched to avoid requiring a running Redis.
    """
    from app.auth.dependencies import (  # noqa: PLC0415
        require_create_analysis,
        require_view_own_analysis,
    )
    from app.main import app  # noqa: PLC0415

    app.dependency_overrides[require_create_analysis] = (
        _mock_require_create_analysis
    )
    app.dependency_overrides[require_view_own_analysis] = (
        _mock_require_view_own_analysis
    )

    with patch("app.logic.endpoints.upload.get_redis_client") as mock:
        mock_redis = MagicMock()
        mock_redis.get.return_value = "0"
        mock.return_value = mock_redis
        yield TestClient(app)
