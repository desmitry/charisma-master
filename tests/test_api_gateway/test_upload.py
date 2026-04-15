"""Tests for POST /api/v1/process upload endpoint."""

from __future__ import annotations

import io
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


class TestProcessEndpoint:
    def _fake_video_bytes(self) -> bytes:
        return b"\x00\x01\x02fake-video-bytes"

    def _fake_text_bytes(self) -> bytes:
        return b"hello world text"

    def test_video_file_with_criteria_id(self, client: TestClient):
        """Video file + preset criteria id + video analysis enabled."""
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.mp4",
            ),
            patch(
                "app.logic.endpoints.upload._load_criteria_preset",
                return_value=[
                    {
                        "name": "Clarity",
                        "description": "d",
                        "max_value": 10,
                    }
                ],
            ),
            patch(
                "app.logic.endpoints.upload.celery_app.send_task",
                new=MagicMock(),
            ) as mock_send,
        ):
            response = client.post(
                "/api/v1/process",
                files={
                    "user_speech_video_file": (
                        "clip.mp4",
                        io.BytesIO(self._fake_video_bytes()),
                        "video/mp4",
                    ),
                    "evaluation_criteria_id": (None, "preset-1"),
                },
                data={
                    "user_need_video_analysis": "true",
                },
            )

        assert response.status_code == 200, response.text
        body = response.json()
        assert "task_id" in body
        assert isinstance(body["task_id"], str)
        assert len(body["task_id"]) > 0
        # Celery should have been dispatched once
        assert mock_send.called
        call_args = mock_send.call_args
        assert (
            call_args.args[0] == "app.logic.tasks.process_video_pipeline"
        )
        kwargs = call_args.kwargs["kwargs"]
        assert kwargs["task_id"] == body["task_id"]
        assert kwargs["need_video_analysis"] is True
        assert kwargs["speech_video_key"] == "task123.mp4"

    def test_rutube_url_with_criteria_file(self, client: TestClient):
        """Rutube URL + criteria file + video analysis enabled."""
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.json",
            ) as mock_upload,
            patch(
                "app.logic.endpoints.upload._download_user_speech_from_rutube",
                return_value="task123.mp4",
            ),
            patch(
                "app.logic.endpoints.upload.celery_app.send_task",
                new=MagicMock(),
            ) as mock_send,
        ):
            response = client.post(
                "/api/v1/process",
                files={
                    "evaluation_criteria_file": (
                        "criteria.json",
                        io.BytesIO(b'{"criteria": []}'),
                        "application/json",
                    ),
                },
                data={
                    "user_speech_video_url": "https://rutube.ru/video/abc",
                    "user_need_video_analysis": "true",
                },
            )

        assert response.status_code == 200, response.text
        assert "task_id" in response.json()
        assert mock_send.called
        # Criteria file should have been uploaded
        assert mock_upload.called

    def test_no_source_returns_400(self, client: TestClient):
        """No video, no URL, no text, no video analysis -> 400."""
        with patch(
            "app.logic.endpoints.upload.celery_app.send_task",
            new=MagicMock(),
        ) as mock_send:
            response = client.post(
                "/api/v1/process",
                data={
                    "user_need_video_analysis": "false",
                    "user_need_text_from_video": "false",
                },
            )

        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "Не указан источник" in detail
        # Celery must not be called on the error path
        assert not mock_send.called

    def test_text_file_only(self, client: TestClient):
        """Text file only is enough — no video analysis required."""
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.txt",
            ),
            patch(
                "app.logic.endpoints.upload.celery_app.send_task",
                new=MagicMock(),
            ) as mock_send,
        ):
            response = client.post(
                "/api/v1/process",
                files={
                    "user_speech_text_file": (
                        "speech.txt",
                        io.BytesIO(self._fake_text_bytes()),
                        "text/plain",
                    ),
                },
                data={
                    "user_need_video_analysis": "false",
                },
            )

        assert response.status_code == 200, response.text
        body = response.json()
        assert "task_id" in body
        assert mock_send.called
        kwargs = mock_send.call_args.kwargs["kwargs"]
        assert kwargs["speech_text_key"] == "task123.txt"
        assert kwargs["speech_video_key"] is None

    def test_celery_task_is_dispatched(self, client: TestClient):
        """Verify celery send_task is called with the right task name."""
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.mp4",
            ),
            patch(
                "app.logic.endpoints.upload.celery_app.send_task",
                new=MagicMock(),
            ) as mock_send,
        ):
            response = client.post(
                "/api/v1/process",
                files={
                    "user_speech_video_file": (
                        "clip.mp4",
                        io.BytesIO(self._fake_video_bytes()),
                        "video/mp4",
                    ),
                },
                data={
                    "user_need_video_analysis": "true",
                    "persona": "strict_critic",
                    "analyze_provider": "gigachat",
                    "transcribe_provider": "sber_gigachat",
                },
            )

        assert response.status_code == 200, response.text
        assert mock_send.call_count == 1
        kwargs = mock_send.call_args.kwargs
        assert (
            mock_send.call_args.args[0]
            == "app.logic.tasks.process_video_pipeline"
        )
        task_kwargs = kwargs["kwargs"]
        assert task_kwargs["persona"] == "strict_critic"
        assert task_kwargs["analyze_provider"] == "gigachat"
        assert task_kwargs["transcribe_provider"] == "sber_gigachat"

    def test_need_text_from_video_with_video(self, client: TestClient):
        """user_need_text_from_video=True with video is a valid text source."""
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.mp4",
            ),
            patch(
                "app.logic.endpoints.upload.celery_app.send_task",
                new=MagicMock(),
            ) as mock_send,
        ):
            response = client.post(
                "/api/v1/process",
                files={
                    "user_speech_video_file": (
                        "clip.mp4",
                        io.BytesIO(self._fake_video_bytes()),
                        "video/mp4",
                    ),
                },
                data={
                    "user_need_text_from_video": "true",
                    "user_need_video_analysis": "false",
                },
            )

        assert response.status_code == 200, response.text
        assert mock_send.called
        task_kwargs = mock_send.call_args.kwargs["kwargs"]
        assert task_kwargs["need_text_from_video"] is True
        assert task_kwargs["need_video_analysis"] is False
