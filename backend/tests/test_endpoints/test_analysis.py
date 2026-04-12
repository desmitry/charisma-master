from unittest.mock import patch


@patch("app.logic.endpoints.analysis.settings")
async def test_analysis_not_found(mock_settings, async_client, tmp_path):
    mock_settings.results_dir = tmp_path
    response = await async_client.get("/api/v1/analysis/nonexistent-id")
    assert response.status_code == 404


@patch("app.logic.endpoints.analysis.settings")
async def test_analysis_found(mock_settings, async_client, tmp_path, sample_analysis_result):
    mock_settings.results_dir = tmp_path
    result_file = tmp_path / "test-task-id.json"
    result_file.write_text(sample_analysis_result.model_dump_json(ensure_ascii=False))

    response = await async_client.get("/api/v1/analysis/test-task-id")
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "test-task-id"
    assert "confidence_index" in data
    assert "speech_report" in data
