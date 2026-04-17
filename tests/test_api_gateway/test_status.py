"""Tests for GET /api/v1/tasks/{task_id}/status and /wait endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


def _mock_async_result(state: str, info=None) -> MagicMock:
    """Return a MagicMock standing in for celery.result.AsyncResult."""
    result = MagicMock()
    result.state = state
    result.info = info
    return result


class TestStatusEndpoint:
    """Tests for the GET /api/v1/tasks/{task_id}/status endpoint."""

    def test_pending_state(self, client: TestClient):
        """PENDING state yields the default (queued) response."""
        mock_result = _mock_async_result("PENDING")
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
        """PROCESSING with a dict info pulls stage/progress/hint from it."""
        mock_result = _mock_async_result(
            "PROCESSING",
            info={
                "stage": "transcription",
                "progress": 0.3,
                "hint": "Transcribing audio...",
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
        assert body["hint"] == "Transcribing audio..."

    def test_processing_with_no_info(self, client: TestClient):
        """PROCESSING with info=None keeps the default stage/progress/hint."""
        mock_result = _mock_async_result("PROCESSING", info=None)
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
        """SUCCESS state sets progress=1.0 and leaves error=None."""
        mock_result = _mock_async_result("SUCCESS")
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
        """FAILURE with a string info copies the string into error."""
        mock_result = _mock_async_result(
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

    @pytest.mark.parametrize("unknown_state", [
        "RETRY",
        "REVOKED",
        "STARTED",
        "IGNORED",
        "CUSTOM_STATE",
    ])
    def test_unknown_celery_state_returns_as_queued(
        self, client: TestClient, unknown_state: str,
    ):
        """Any Celery state outside the handled four falls through to PENDING.

        # BUG: _build_task_status_response has no `else` branch -- any
        # unrecognized state (RETRY, REVOKED, STARTED, IGNORED, etc.)
        # returns the default response (state=PENDING, progress=0.0).
        # A cancelled task will appear as 'queued' in the UI. This test
        # documents the current behavior; the source should later be
        # fixed to either raise or return an explicit 'unknown' state.
        """
        mock_result = _mock_async_result(unknown_state)
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-unknown/status")

        assert response.status_code == 200
        body = response.json()
        # Current behavior: unknown state -> PENDING
        assert body["state"] == "PENDING"
        assert body["hint"] == "PENDING"
        assert body["progress"] == 0.0

    def test_failure_with_exception_object_in_info(self, client: TestClient):
        """FAILURE with Exception object in info yields str(exc) in error."""
        mock_result = _mock_async_result(
            "FAILURE",
            info=ValueError("Database connection lost"),
        )
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-fail-obj/status")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "FAILURE"
        # str(ValueError("...")) == "Database connection lost"
        assert "Database connection lost" in body["error"]

    def test_processing_with_info_string(self, client: TestClient):
        """PROCESSING with info as a string leaves stage/progress unset.

        The _build_task_status_response checks isinstance(info, dict)
        before pulling fields. A string info is ignored for
        stage/progress/hint.
        """
        mock_result = _mock_async_result(
            "PROCESSING",
            info="Task is running",
        )
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-info-str/status")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "PROCESSING"
        assert body["stage"] is None
        assert body["progress"] == 0.0
        assert body["hint"] == "PROCESSING"

    def test_processing_with_partial_info(self, client: TestClient):
        """PROCESSING with info dict missing some keys uses defaults."""
        mock_result = _mock_async_result(
            "PROCESSING",
            info={"stage": "llm_analysis"},
        )
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-partial/status")

        assert response.status_code == 200
        body = response.json()
        assert body["stage"] == "llm_analysis"
        assert body["progress"] == 0.0
        assert body["hint"] == "PROCESSING"

    def test_failure_with_no_info(self, client: TestClient):
        """FAILURE with info=None yields the string 'None' in error.

        # BUG: str(None) == 'None'. Clients get the literal string 'None' in
        # the error field when the task failed without carrying an exception
        # in info. Source should treat info=None as an empty error, not
        # stringify it. This test documents the current behavior.
        """
        mock_result = _mock_async_result("FAILURE", info=None)
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-fail-none/status")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "FAILURE"
        # Current behavior: str(None) == "None"
        assert body["error"] == "None"


class TestWaitEndpoint:
    """Tests for the GET /api/v1/tasks/{task_id}/wait endpoint."""

    def test_wait_returns_same_as_status(self, client: TestClient):
        """/wait returns the same payload as /status for the same task."""
        mock_result = _mock_async_result(
            "PROCESSING",
            info={
                "stage": "video_analysis",
                "progress": 0.25,
                "hint": "Analyzing video...",
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
        """/wait for a SUCCESS task reports progress=1.0."""
        mock_result = _mock_async_result("SUCCESS")
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get("/api/v1/tasks/task-wait/wait")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == "SUCCESS"
        assert body["progress"] == 1.0

    def test_wait_with_pending(self, client: TestClient):
        """/wait + PENDING yields the same structure as /status."""
        mock_result = _mock_async_result("PENDING")
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            status_resp = client.get("/api/v1/tasks/task-pending/status")
            wait_resp = client.get("/api/v1/tasks/task-pending/wait")

        assert status_resp.status_code == 200
        assert wait_resp.status_code == 200
        assert status_resp.json() == wait_resp.json()
        assert wait_resp.json()["state"] == "PENDING"

    @pytest.mark.parametrize(
        "state, info, expected_progress, expected_stage",
        [
            ("PENDING", None, 0.0, None),
            (
                "PROCESSING",
                {"stage": "transcription", "progress": 0.3, "hint": "..."},
                0.3,
                "transcription",
            ),
            ("SUCCESS", None, 1.0, None),
            ("FAILURE", "error message", 0.0, None),
        ],
    )
    def test_wait_all_states(
        self,
        client: TestClient,
        state: str,
        info,
        expected_progress: float,
        expected_stage,
    ):
        """/wait handles all four Celery states with expected payload."""
        mock_result = _mock_async_result(state, info=info)
        with patch(
            "app.logic.endpoints.status.AsyncResult",
            return_value=mock_result,
        ):
            response = client.get(f"/api/v1/tasks/task-{state.lower()}/wait")

        assert response.status_code == 200
        body = response.json()
        assert body["state"] == state
        assert body["progress"] == expected_progress
        if expected_stage is not None:
            assert body["stage"] == expected_stage
