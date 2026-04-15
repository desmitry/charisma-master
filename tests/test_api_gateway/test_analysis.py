"""Tests for GET /api/v1/analysis/{task_id} endpoint."""

from __future__ import annotations

from unittest.mock import patch

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

    def test_not_found(self, client: TestClient):
        with patch(
            "app.logic.endpoints.analysis.get_object_json",
            side_effect=RuntimeError("object does not exist"),
        ):
            response = client.get("/api/v1/analysis/missing-task")

        assert response.status_code == 404
        body = response.json()
        assert body["detail"] == "Analysis not found or still processing"

    def test_storage_generic_exception(self, client: TestClient):
        """Any exception from storage becomes a 404 with the same detail."""
        with patch(
            "app.logic.endpoints.analysis.get_object_json",
            side_effect=Exception("network error"),
        ):
            response = client.get("/api/v1/analysis/task-fail")

        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "Analysis not found or still processing"
        )
