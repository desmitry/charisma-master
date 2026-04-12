from unittest.mock import MagicMock, patch


@patch("app.logic.endpoints.status.AsyncResult")
async def test_status_pending(mock_result_cls, async_client):
    mock_result = MagicMock()
    mock_result.state = "PENDING"
    mock_result_cls.return_value = mock_result

    response = await async_client.get("/api/v1/tasks/test-id/status")
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "PENDING"


@patch("app.logic.endpoints.status.AsyncResult")
async def test_status_processing(mock_result_cls, async_client):
    mock_result = MagicMock()
    mock_result.state = "PROCESSING"
    mock_result.info = {
        "stage": "transcription",
        "progress": 0.1,
        "hint": "Транскрибация аудио...",
    }
    mock_result_cls.return_value = mock_result

    response = await async_client.get("/api/v1/tasks/test-id/status")
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "PROCESSING"
    assert data["progress"] == 0.1


@patch("app.logic.endpoints.status.AsyncResult")
async def test_status_finished(mock_result_cls, async_client):
    mock_result = MagicMock()
    mock_result.state = "SUCCESS"
    mock_result_cls.return_value = mock_result

    response = await async_client.get("/api/v1/tasks/test-id/status")
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "SUCCESS"
    assert data["progress"] == 1.0


@patch("app.logic.endpoints.status.AsyncResult")
async def test_status_failed(mock_result_cls, async_client):
    mock_result = MagicMock()
    mock_result.state = "FAILURE"
    mock_result.info = Exception("Pipeline error")
    mock_result_cls.return_value = mock_result

    response = await async_client.get("/api/v1/tasks/test-id/status")
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "FAILURE"
    assert "error" in data
