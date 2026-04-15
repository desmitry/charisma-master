"""Tests for GET /api/v1/tasks/{task_id}/status and /wait endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


class TestTaskStatus:
    def _make_async_result(
        self, state: str, info=None
    ) -> MagicMock:
        """Return a MagicMock standing in for celery.result.AsyncResult."""
        result = MagicMock()
        result.state = state
        result.info = info
        return result

    def test_pending_state(self, client: TestClient):
        mock_result = self._make_async_result("PENDING")
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-1/status")

        assert response.status_code == 200
        body = response.json()
        assert body["task_id"] == "task-1"
        assert body["state"] == "PENDING"
        assert body["hint"] == "PENDING"
        assert body["progress"] == 0.0
        assert body["stage"] is None
        assert body["error"] is None

    def test_processing_with_info_dict(self, client: TestClient):
        mock_result = self._make_async_result(
            "PROCESSING",
            info={
                "stage": "transcription",
                "progress": 0.3,
                "hint": "Транскрибация аудио...",
            },
        )
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-2/status")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "PROCESSING"
        assert body["stage"] == "transcription"
        assert body["progress"] == 0.3
        assert body["hint"] == "Транскрибация аудио..."

    def test_processing_with_no_info(self, client: TestClient):
        mock_result = self._make_async_result("PROCESSING", info=None)
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-3/status")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "PROCESSING"
        assert body["hint"] == "PROCESSING"
        assert body["stage"] is None
        assert body["progress"] == 0.0

    def test_success_state(self, client: TestClient):
        mock_result = self._make_async_result("SUCCESS")
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-4/status")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "SUCCESS"
        assert body["hint"] == "SUCCESS"
        assert body["progress"] == 1.0
        assert body["error"] is None

    def test_failure_state_with_error(self, client: TestClient):
        mock_result = self._make_async_result(
            "FAILURE", info="Custom error message"
        )
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-5/status")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "FAILURE"
        assert body["hint"] == "FAILURE"
        assert "Custom error message" in body["error"]

    def test_wait_returns_same_as_status(self, client: TestClient):
        mock_result = self._make_async_result(
            "PROCESSING",
            info={
                "stage": "video_analysis",
                "progress": 0.25,
                "hint": "Анализ видео...",
            },
        )
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            status_resp = client.get(
                "/api/v1/tasks/task-wait/status"
            )
            wait_resp = client.get(
                "/api/v1/tasks/task-wait/wait"
            )

        assert status_resp.status_code == 200
        assert wait_resp.status_code == 200
        assert status_resp.json() == wait_resp.json()

    def test_wait_with_success(self, client: TestClient):
        mock_result = self._make_async_result("SUCCESS")
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-wait/wait")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "SUCCESS"
        assert body["progress"] == 1.0
