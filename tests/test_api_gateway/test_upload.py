"""Tests for POST /api/v1/process (upload endpoint)."""

import io
from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_process_no_input(async_client):
    """Sending no file and no URL should return 400."""
    response = await async_client.post(
        "/api/v1/process",
        data={
            "evaluation_criteria_id": "preset-1",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_process_both_file_and_url(async_client):
    """Providing both a file and a URL should return 400."""
    dummy_file = io.BytesIO(b"fake video content")
    response = await async_client.post(
        "/api/v1/process",
        files={
            "user_speech_file": ("video.mp4", dummy_file, "video/mp4"),
        },
        data={
            "user_speech_url": "https://rutube.ru/video/abc123/",
            "evaluation_criteria_id": "preset-1",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_process_with_file_success(async_client):
    """Upload with a valid file
    should dispatch a Celery task and return 200."""
    dummy_file = io.BytesIO(b"fake video content")

    with (
        patch(
            "services.api_gateway.app.logic.endpoints.upload._upload_to_seaweedfs",
            return_value="test-task.mp4",
        ),
        patch(
            "services.api_gateway.app.logic.endpoints.upload._load_criteria_preset",
            return_value=[
                {
                    "name": "Criterion",
                    "description": "desc",
                    "max_value": 10,
                }
            ],
        ),
        patch(
            "services.api_gateway.app.logic.endpoints.upload.celery_app"
        ) as mock_celery,
    ):
        mock_celery.send_task = MagicMock()

        response = await async_client.post(
            "/api/v1/process",
            files={
                "user_speech_file": ("video.mp4", dummy_file, "video/mp4"),
            },
            data={
                "evaluation_criteria_id": "preset-1",
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert "task_id" in body
        mock_celery.send_task.assert_called_once()
