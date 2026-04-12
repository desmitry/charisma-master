from io import BytesIO
from unittest.mock import MagicMock, patch


@patch("app.logic.endpoints.upload.process_video_pipeline")
async def test_process_no_input(mock_pipeline, async_client):
    response = await async_client.post(
        "/api/v1/process",
        data={
            "persona": "speech_review_specialist",
            "analyze_provider": "gigachat",
            "transcribe_provider": "sber_gigachat",
        },
    )
    assert response.status_code == 400


@patch("app.logic.endpoints.upload.process_video_pipeline")
async def test_process_both_file_and_url(mock_pipeline, async_client):
    response = await async_client.post(
        "/api/v1/process",
        data={
            "user_speech_url": "https://rutube.ru/video/123",
            "persona": "speech_review_specialist",
            "analyze_provider": "gigachat",
            "transcribe_provider": "sber_gigachat",
            "evaluation_criteria_id": "preset_1",
        },
        files={"user_speech_file": ("test.mp4", BytesIO(b"data"), "video/mp4")},
    )
    assert response.status_code == 400


@patch("app.logic.endpoints.upload.process_video_pipeline")
async def test_process_with_file_success(mock_pipeline, async_client):
    mock_pipeline.apply_async = MagicMock()
    response = await async_client.post(
        "/api/v1/process",
        data={
            "persona": "speech_review_specialist",
            "analyze_provider": "gigachat",
            "transcribe_provider": "sber_gigachat",
            "evaluation_criteria_id": "preset_1",
        },
        files={"user_speech_file": ("test.mp4", BytesIO(b"videodata"), "video/mp4")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    mock_pipeline.apply_async.assert_called_once()
