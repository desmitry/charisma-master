"""Tests for POST /api/v1/process upload endpoint."""

from __future__ import annotations

import io
import subprocess
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


def _fake_video_bytes() -> bytes:
    return b"\x00\x01\x02fake-video-bytes"


def _fake_text_bytes() -> bytes:
    return b"hello world text"


class TestHappyPath:
    """Successful end-to-end upload scenarios."""

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
                        io.BytesIO(_fake_video_bytes()),
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

    def test_text_file_only(self, client: TestClient):
        """Text file only is enough - no video analysis required."""
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
                        io.BytesIO(_fake_text_bytes()),
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
                        io.BytesIO(_fake_video_bytes()),
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

    def test_presentation_file_is_uploaded(self, client: TestClient):
        """Presentation file is uploaded to SeaweedFS and passed to Celery."""
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.pptx",
            ) as mock_upload,
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
                        io.BytesIO(b"fake-video-data"),
                        "video/mp4",
                    ),
                    "user_presentation_file": (
                        "slides.pptx",
                        io.BytesIO(b"fake-pptx-data"),
                        "application/vnd.ms-powerpoint",
                    ),
                },
                data={"user_need_video_analysis": "true"},
            )

        assert response.status_code == 200, response.text
        assert mock_upload.called
        task_kwargs = mock_send.call_args.kwargs["kwargs"]
        assert task_kwargs["presentation_key"] == "task123.pptx"


class TestValidation:
    """Input validation scenarios."""

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

    def test_non_rutube_url_returns_400(self, client: TestClient):
        """Non-rutube URL must return 400."""
        with patch(
            "app.logic.endpoints.upload.celery_app.send_task",
            new=MagicMock(),
        ) as mock_send:
            response = client.post(
                "/api/v1/process",
                data={
                    "user_speech_video_url": "https://youtube.com/watch?v=abc123",
                    "user_need_video_analysis": "true",
                },
            )

        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "rutube" in detail.lower()
        # Celery must not be called on the error path
        assert not mock_send.called

    @pytest.mark.xfail(
        reason=(
            "BUG: evaluation_criteria_file content is not validated as"
            " JSON - the endpoint uploads the file verbatim and returns"
            " 200. See services/api_gateway/app/logic/endpoints/upload.py:"
            " evaluation_criteria_file is passed straight to"
            " _upload_to_seaweedfs with no JSON parsing."
        ),
        strict=True,
    )
    def test_invalid_criteria_json_returns_422(self, client: TestClient):
        """A criteria file with invalid JSON yields a validation error."""
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.json",
            ),
            patch(
                "app.logic.endpoints.upload._download_user_speech_from_rutube",
                return_value="rutube_task.mp4",
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
                        "bad.json",
                        io.BytesIO(b"{invalid json content}"),
                        "application/json",
                    ),
                },
                data={
                    "user_speech_video_url": "https://rutube.ru/video/abc",
                    "user_need_video_analysis": "true",
                },
            )

        assert response.status_code in (422, 500)
        assert not mock_send.called


class TestErrorPaths:
    """Error / failure scenarios in downstream helpers."""

    @pytest.mark.xfail(
        reason=(
            "BUG: ffmpeg stderr leaks to response - see"
            " services/api_gateway/app/logic/endpoints/upload.py"
            " (_download_user_speech_from_rutube embeds e.stderr in"
            " HTTPException detail). Internal paths / codec info /"
            " stack traces leak to clients."
        ),
        strict=True,
    )
    def test_ffmpeg_stderr_does_not_leak_to_client(self, client: TestClient):
        """ffmpeg stderr is logged but does NOT appear in the HTTP response.

        BUG: services/api_gateway/app/logic/endpoints/upload.py currently
        embeds stderr into the 500 response body. Internal paths, codec
        info, and stack traces leak to clients. This test documents that
        leak and should FAIL until the source is fixed to return a generic
        message.

        Note: The stderr leak lives in _download_user_speech_from_rutube
        (the file-upload path does not wrap CalledProcessError at all),
        so this test exercises the RuTube URL path to reach the buggy
        branch.
        """
        ffmpeg_stderr = (
            b"Error opening /tmp/internal_path_12345.tmp:"
            b" codec not supported\n"
            b"Stack trace: ffmpeg_main.c:42"
        )

        with (
            patch(
                "app.logic.endpoints.upload._convert_to_faststart",
                side_effect=subprocess.CalledProcessError(
                    1, "ffmpeg", stderr=ffmpeg_stderr,
                ),
            ),
            patch(
                "app.logic.endpoints.upload.celery_app.send_task",
                new=MagicMock(),
            ),
        ):
            response = client.post(
                "/api/v1/process",
                data={
                    "user_speech_video_url": "https://rutube.ru/video/abc",
                    "user_need_video_analysis": "true",
                },
            )

        assert response.status_code == 500
        body = response.json()
        assert "/tmp/internal_path_12345" not in body["detail"]
        assert "codec not supported" not in body["detail"]
        assert "Stack trace" not in body["detail"]
        assert "Ошибка преобразования видео" in body["detail"]

    def test_criteria_preset_not_found_returns_404(self, client: TestClient):
        """Non-existent evaluation_criteria_id returns 404."""
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.mp4",
            ),
            patch(
                "app.logic.endpoints.upload._load_criteria_preset",
                side_effect=HTTPException(
                    status_code=404,
                    detail=(
                        "Пресет с критериями 'nonexistent-preset' не найден"
                    ),
                ),
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
                        io.BytesIO(b"fake-video-data"),
                        "video/mp4",
                    ),
                    "evaluation_criteria_id": (None, "nonexistent-preset"),
                },
                data={"user_need_video_analysis": "true"},
            )

        assert response.status_code == 404
        assert not mock_send.called

    def test_rutube_video_unavailable_returns_500(self, client: TestClient):
        """yt-dlp can't download the video -> 500."""
        with (
            patch(
                "app.logic.endpoints.upload._download_user_speech_from_rutube",
                side_effect=HTTPException(
                    status_code=500,
                    detail="Ошибка загрузки: видео недоступно",
                ),
            ),
            patch(
                "app.logic.endpoints.upload.celery_app.send_task",
                new=MagicMock(),
            ) as mock_send,
        ):
            response = client.post(
                "/api/v1/process",
                data={
                    "user_speech_video_url": "https://rutube.ru/video/deleted-id",
                    "user_need_video_analysis": "true",
                },
            )

        assert response.status_code == 500
        assert not mock_send.called


class TestCeleryDispatch:
    """Celery task dispatch behavior."""

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
                        io.BytesIO(_fake_video_bytes()),
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

    @pytest.mark.parametrize(
        "persona, analyze_provider, transcribe_provider",
        [
            ("strict_critic", "gigachat", "sber_gigachat"),
            ("kind_mentor", "openai", "whisper_openai"),
            ("steve_jobs_style", "gigachat", "whisper_local"),
            ("speech_review_specialist", "openai", "sber_gigachat"),
        ],
    )
    def test_all_providers_passed_to_celery(
        self,
        client: TestClient,
        persona,
        analyze_provider,
        transcribe_provider,
    ):
        """Provider combinations forwarded to Celery task kwargs."""
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
                        io.BytesIO(b"fake"),
                        "video/mp4",
                    ),
                },
                data={
                    "user_need_video_analysis": "true",
                    "persona": persona,
                    "analyze_provider": analyze_provider,
                    "transcribe_provider": transcribe_provider,
                },
            )

        assert response.status_code == 200, response.text
        task_kwargs = mock_send.call_args.kwargs["kwargs"]
        assert task_kwargs["persona"] == persona
        assert task_kwargs["analyze_provider"] == analyze_provider
        assert task_kwargs["transcribe_provider"] == transcribe_provider


class TestEdgeCases:
    """Edge cases documenting current behavior."""

    def test_both_video_file_and_url(self, client: TestClient):
        """When both file and URL are supplied, URL overrides the file.

        Documents current behavior: in upload.py the file branch sets
        video_key first, then the URL branch reassigns it, so the Celery
        kwarg reflects the URL-derived object key.
        """
        with (
            patch(
                "app.logic.endpoints.upload._upload_to_seaweedfs",
                return_value="task123.mp4",
            ),
            patch(
                "app.logic.endpoints.upload._download_user_speech_from_rutube",
                return_value="rutube_task.mp4",
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
                        io.BytesIO(b"fake-video-data"),
                        "video/mp4",
                    ),
                },
                data={
                    "user_speech_video_url": "https://rutube.ru/video/abc",
                    "user_need_video_analysis": "true",
                },
            )

        assert response.status_code == 200, response.text
        assert mock_send.called
        # Documents current behavior: URL overrides video_key
        task_kwargs = mock_send.call_args.kwargs["kwargs"]
        assert task_kwargs["speech_video_key"] == "rutube_task.mp4"
