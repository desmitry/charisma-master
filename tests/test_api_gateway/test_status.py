"""Tests for GET /api/v1/tasks/{task_id}/status."""

from unittest.mock import MagicMock, patch

import pytest


def _make_async_result(state: str, info=None):
    """Build a mock ``AsyncResult`` with the given state and info."""
    mock = MagicMock()
    mock.state = state
    mock.info = info
    return mock


@pytest.mark.asyncio
async def test_status_pending(async_client):
    """PENDING task should return queued state with progress 0."""
    with patch(
        "services.api_gateway.app.logic.endpoints.status.AsyncResult",
        return_value=_make_async_result("PENDING"),
    ):
        response = await async_client.get(
            "/api/v1/tasks/test-task-id/status"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "PENDING"
    assert body["progress"] == 0.0


@pytest.mark.asyncio
async def test_status_processing(async_client):
    """PROCESSING task should return stage info from task metadata."""
    info = {
        "stage": "transcription",
        "progress": 0.1,
        "hint": "Transcribing...",
    }
    with patch(
        "services.api_gateway.app.logic.endpoints.status.AsyncResult",
        return_value=_make_async_result("PROCESSING", info=info),
    ):
        response = await async_client.get(
            "/api/v1/tasks/test-task-id/status"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "PROCESSING"
    assert body["progress"] == 0.1
    assert body["hint"] == "Transcribing..."


@pytest.mark.asyncio
async def test_status_finished(async_client):
    """SUCCESS task should return progress 1.0."""
    with patch(
        "services.api_gateway.app.logic.endpoints.status.AsyncResult",
        return_value=_make_async_result("SUCCESS"),
    ):
        response = await async_client.get(
            "/api/v1/tasks/test-task-id/status"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "SUCCESS"
    assert body["progress"] == 1.0


@pytest.mark.asyncio
async def test_status_failed(async_client):
    """FAILURE task should include the error message."""
    with patch(
        "services.api_gateway.app.logic.endpoints.status.AsyncResult",
        return_value=_make_async_result(
            "FAILURE", info=Exception("boom")
        ),
    ):
        response = await async_client.get(
            "/api/v1/tasks/test-task-id/status"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "FAILURE"
    assert "boom" in body["error"]
