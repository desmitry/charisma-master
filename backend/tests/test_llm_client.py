import pytest

from app.logic.llm_client import LLMClient


def test_parse_json_response_clean():
    client = LLMClient.__new__(LLMClient)
    result = client._parse_json_response('{"summary": "test"}')
    assert result == {"summary": "test"}


def test_parse_json_response_with_markdown():
    client = LLMClient.__new__(LLMClient)
    result = client._parse_json_response('```json\n{"summary": "test"}\n```')
    assert result == {"summary": "test"}


def test_parse_json_response_with_markdown_no_lang():
    client = LLMClient.__new__(LLMClient)
    result = client._parse_json_response('```\n{"key": "value"}\n```')
    assert result == {"key": "value"}


def test_parse_json_response_invalid():
    client = LLMClient.__new__(LLMClient)
    with pytest.raises(Exception):
        client._parse_json_response("not json at all")


def test_empty_speech_report():
    report = LLMClient._get_empty_speech_analysis_response()
    assert report.summary == ""
    assert report.structure == ""
    assert report.mistakes == ""
    assert report.ideal_text == ""
    assert report.persona_feedback == ""
    assert report.dynamic_fillers == []
    assert report.presentation_feedback == ""


def test_transcription_limit():
    assert LLMClient.TRANSCRIPTION_LIMIT == 7_000


def test_presentation_text_limit():
    assert LLMClient.PRESENTATION_TEXT_LIMIT == 5_000
