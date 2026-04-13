"""Unit tests for pure helper methods on LLMClient.

Only ``_parse_json_response`` and ``_get_empty_speech_analysis_response``
are tested here -- they require no network or LLM calls.
"""

import json
from unittest.mock import patch

import pytest
from charisma_schemas import SpeechReport

# ---------------------------------------------------------------------------
# We cannot instantiate LLMClient normally because __init__ tries to create
# openai and gigachat clients that need real credentials / network.
# We patch __init__ to skip that, then test the pure helpers directly.
# ---------------------------------------------------------------------------


def _make_llm_client():
    """Create an LLMClient with a no-op constructor."""
    with patch(
        "services.ml_worker.app.logic.llm_client.LLMClient.__init__",
        lambda self: None,
    ):
        from services.ml_worker.app.logic.llm_client import LLMClient

        return LLMClient()


# ---- _parse_json_response ---------------------------------------------------


class TestParseJsonResponse:
    """Tests for LLMClient._parse_json_response."""

    def test_plain_json(self):
        client = _make_llm_client()
        data = {"summary": "ok", "score": 42}
        result = client._parse_json_response(json.dumps(data))
        assert result == data

    def test_json_wrapped_in_markdown_fences(self):
        client = _make_llm_client()
        raw = '```json\n{"key": "value"}\n```'
        result = client._parse_json_response(raw)
        assert result == {"key": "value"}

    def test_json_with_surrounding_whitespace(self):
        client = _make_llm_client()
        raw = '   \n  {"a": 1}  \n  '
        result = client._parse_json_response(raw)
        assert result == {"a": 1}

    def test_invalid_json_raises(self):
        client = _make_llm_client()
        with pytest.raises(json.JSONDecodeError):
            client._parse_json_response("not json at all")

    def test_nested_json(self):
        client = _make_llm_client()
        data = {
            "criteria": [
                {"name": "A", "current_value": 5, "feedback": "Good"},
                {"name": "B", "current_value": 3, "feedback": "OK"},
            ]
        }
        result = client._parse_json_response(json.dumps(data))
        assert len(result["criteria"]) == 2

    def test_empty_object(self):
        client = _make_llm_client()
        result = client._parse_json_response("{}")
        assert result == {}


# ---- _get_empty_speech_analysis_response ------------------------------------


class TestGetEmptySpeechAnalysisResponse:
    """Tests for LLMClient._get_empty_speech_analysis_response."""

    def test_returns_speech_report(self):
        from services.ml_worker.app.logic.llm_client import LLMClient

        result = LLMClient._get_empty_speech_analysis_response()
        assert isinstance(result, SpeechReport)

    def test_all_string_fields_empty(self):
        from services.ml_worker.app.logic.llm_client import LLMClient

        result = LLMClient._get_empty_speech_analysis_response()
        assert result.summary == ""
        assert result.structure == ""
        assert result.mistakes == ""
        assert result.ideal_text == ""
        assert result.persona_feedback == ""
        assert result.presentation_feedback == ""
        assert result.useful_links == ""

    def test_dynamic_fillers_is_empty_list(self):
        from services.ml_worker.app.logic.llm_client import LLMClient

        result = LLMClient._get_empty_speech_analysis_response()
        assert result.dynamic_fillers == []

    def test_returns_new_instance_each_time(self):
        from services.ml_worker.app.logic.llm_client import LLMClient

        a = LLMClient._get_empty_speech_analysis_response()
        b = LLMClient._get_empty_speech_analysis_response()
        assert a is not b
