"""Tests for GET /api/v1/analysis/{task_id}."""

from unittest.mock import patch

import pytest


@pytest.mark.asyncio
async def test_analysis_not_found(async_client):
    """When get_object_json raises, the endpoint should return 404."""
    with patch(
        "services.api_gateway.app.logic.endpoints.analysis.get_object_json",
        side_effect=Exception("not found"),
    ):
        response = await async_client.get("/api/v1/analysis/missing-id")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_analysis_found(async_client, sample_analysis_result):
    """When results exist, the endpoint should return 200 with full data."""
    result_dict = sample_analysis_result.model_dump()

    with patch(
        "services.api_gateway.app.logic.endpoints.analysis.get_object_json",
        return_value=result_dict,
    ):
        response = await async_client.get(
            f"/api/v1/analysis/{sample_analysis_result.task_id}"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == sample_analysis_result.task_id
    assert len(body["transcript"]) == 1
    assert body["confidence_index"]["total"] == 75.0
