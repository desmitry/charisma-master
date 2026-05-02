"""Tests for GET /api/v1/analysis/{task_id} endpoint."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


def _make_analysis_result_dict(task_id: str = "t1") -> dict:
    """Build a minimal valid AnalysisResult payload."""
    return {
        "task_id": task_id,
        "video_path": f"videos/{task_id}.mp4",
        "user_need_video_analysis": True,
        "user_need_text_from_video": True,
        "transcript": [],
        "tempo": [],
        "long_pauses": [],
        "fillers_summary": {"count": 0, "ratio": 0},
        "confidence_index": {
            "total": 80.0,
            "total_label": "Отлично",
            "components": {
                "volume_level": "Нормально",
                "volume_score": 85,
                "volume_label": "Отлично",
                "filler_score": 75,
                "filler_label": "Хорошо",
                "gaze_score": 90,
                "gaze_label": "Великолепно",
                "gesture_score": 70,
                "gesture_label": "Хорошо",
                "gesture_advice": "",
                "tone_score": 80,
                "tone_label": "Отлично",
            },
        },
        "speech_report": {
            "summary": "",
            "structure": "",
            "mistakes": "",
            "ideal_text": "",
            "persona_feedback": "",
            "dynamic_fillers": [],
            "presentation_feedback": "",
            "competition_analysis": "",
            "useful_links": "",
        },
        "evaluation_criteria_report": {
            "total_score": 0,
            "max_score": 0,
            "criteria": [],
        },
        "analyze_provider": "gigachat",
        "analyze_model": "GigaChat",
        "transcribe_model": "sber_gigachat",
    }


class TestGetAnalysis:
    def test_happy_path(self, client: TestClient):
        payload = _make_analysis_result_dict("my-task")
        with patch(
            "app.logic.endpoints.analysis.get_object_json",
            return_value=payload,
        ):
            response = client.get("/api/v1/analysis/my-task")

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["task_id"] == "my-task"
        assert body["video_path"] == "videos/my-task.mp4"
        assert body["analyze_provider"] == "gigachat"
        assert body["analyze_model"] == "GigaChat"
        assert body["confidence_index"]["total"] == 80.0

    @pytest.mark.parametrize(
        "exception",
        [
            RuntimeError("object does not exist"),
            Exception("network error"),
            ConnectionError("timeout"),
            ValueError("bad data"),
        ],
        ids=["runtime", "generic", "connection", "value"],
    )
    def test_any_storage_error_returns_404(
        self, client: TestClient, exception: Exception
    ):
        """Any storage error becomes a 404 with the generic detail."""
        with patch(
            "app.logic.endpoints.analysis.get_object_json",
            side_effect=exception,
        ):
            response = client.get("/api/v1/analysis/t1")

        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "Analysis not found or still processing"
        )

    def test_malformed_schema_returns_422(self, client: TestClient):
        """Storage returned a JSON without required AnalysisResult fields.

        FastAPI's ``response_model`` validation runs AFTER the handler
        returns, so it is NOT caught by the handler's broad
        ``except Exception`` block. In modern FastAPI/Pydantic v2 this
        raises ``ResponseValidationError``. The TestClient propagates
        server-side exceptions by default (``raise_server_exceptions=True``),
        so we assert the exception is raised. In a real HTTP deployment the
        client would see a 500. Historically (older FastAPI) this surfaced as
        422.
        """
        from fastapi.exceptions import ResponseValidationError

        # missing video_path, transcript, and other required fields
        broken_payload = {"task_id": "t1"}
        with patch(
            "app.logic.endpoints.analysis.get_object_json",
            return_value=broken_payload,
        ):
            with pytest.raises(ResponseValidationError):
                client.get("/api/v1/analysis/t1")

    def test_error_message_not_leaked(self, client: TestClient):
        """Internal error details must NOT appear in the 404 response body."""
        with patch(
            "app.logic.endpoints.analysis.get_object_json",
            side_effect=RuntimeError("SECRET_INTERNAL_PASSWORD_123"),
        ):
            response = client.get("/api/v1/analysis/t1")

        body = response.json()
        assert "SECRET_INTERNAL_PASSWORD_123" not in body["detail"]
        assert body["detail"] == "Analysis not found or still processing"
