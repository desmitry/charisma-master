from unittest.mock import AsyncMock, MagicMock, patch


@patch("app.logic.endpoints.telemetry.get_session")
async def test_rate_not_found(mock_get_session, async_client):
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result
    mock_get_session.return_value = mock_session

    response = await async_client.post(
        "/api/v1/telemetry/nonexistent/rate",
        json={"rating": 4},
    )
    assert response.status_code == 404


@patch("app.logic.endpoints.telemetry.get_session")
async def test_rate_already_rated(mock_get_session, async_client):
    mock_record = MagicMock()
    mock_record.user_rating = 3
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_record
    mock_session.execute.return_value = mock_result
    mock_get_session.return_value = mock_session

    response = await async_client.post(
        "/api/v1/telemetry/test-id/rate",
        json={"rating": 4},
    )
    assert response.status_code == 400


@patch("app.logic.endpoints.telemetry.get_session")
async def test_rate_success(mock_get_session, async_client):
    mock_record = MagicMock()
    mock_record.user_rating = None
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_record
    mock_session.execute.return_value = mock_result
    mock_get_session.return_value = mock_session

    response = await async_client.post(
        "/api/v1/telemetry/test-id/rate",
        json={"rating": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["rating"] == 5


@patch("app.logic.endpoints.telemetry.get_session")
async def test_stats(mock_get_session, async_client):
    mock_session = AsyncMock()
    results = []
    for val in [10, 5, 4.2, 72.5]:
        r = MagicMock()
        r.scalar.return_value = val
        results.append(r)
    mock_session.execute = AsyncMock(side_effect=results)
    mock_get_session.return_value = mock_session

    response = await async_client.get("/api/v1/telemetry/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_analyses"] == 10
    assert data["rated_count"] == 5
