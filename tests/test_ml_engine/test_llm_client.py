"""Tests for LLMClient provider dispatch in ml_worker."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from charisma_schemas import AnalyzeProvider, PersonaRoles, SpeechReport


class TestLLMClientConstants:
    def test_transcription_limit(self, llm_client_module):
        assert llm_client_module.LLMClient.TRANSCRIPTION_LIMIT == 7_000

    def test_presentation_text_limit(self, llm_client_module):
        assert (
            llm_client_module.LLMClient.PRESENTATION_TEXT_LIMIT == 5_000
        )


class TestLLMClientInstantiation:
    def test_instantiates_with_patched_clients(self, llm_client_module):
        with (
            patch(
                "app.logic.llm_client.openai.AsyncOpenAI",
                return_value=MagicMock(name="openai_client"),
            ) as mock_openai,
            patch(
                "app.logic.llm_client.GigaChat",
                return_value=MagicMock(name="gigachat_client"),
            ) as mock_gigachat,
        ):
            client = llm_client_module.LLMClient()

        assert client is not None
        mock_openai.assert_called_once()
        mock_gigachat.assert_called_once()


class TestAnalyzeSpeech:
    def _valid_speech_report_json(self) -> str:
        return (
            '{"summary": "good", "structure": "clear", '
            '"mistakes": "none", "ideal_text": "great", '
            '"persona_feedback": "encouraging", '
            '"dynamic_fillers": [], '
            '"presentation_feedback": "nice", '
            '"useful_links": "link"}'
        )

    async def test_analyze_speech_gigachat_path(
        self, llm_client_module
    ):
        with (
            patch("app.logic.llm_client.openai.AsyncOpenAI"),
            patch("app.logic.llm_client.GigaChat"),
            patch(
                "app.logic.llm_client.prompts.get_analyze_speech_system_prompt",
                return_value="system prompt",
            ),
        ):
            client = llm_client_module.LLMClient()
            client._call_gigachat = AsyncMock(
                return_value=self._valid_speech_report_json()
            )
            client._call_openai = AsyncMock()

            result = await client.analyze_speech(
                transcript_text="hi there",
                presentation_text="slides text",
                provider=AnalyzeProvider.gigachat,
                persona=PersonaRoles.speech_review_specialist,
            )

        assert isinstance(result, SpeechReport)
        assert result.summary == "good"
        client._call_gigachat.assert_awaited_once()
        client._call_openai.assert_not_awaited()

    async def test_analyze_speech_openai_path(self, llm_client_module):
        with (
            patch("app.logic.llm_client.openai.AsyncOpenAI"),
            patch("app.logic.llm_client.GigaChat"),
            patch(
                "app.logic.llm_client.prompts.get_analyze_speech_system_prompt",
                return_value="system prompt",
            ),
        ):
            client = llm_client_module.LLMClient()
            client._call_openai = AsyncMock(
                return_value=self._valid_speech_report_json()
            )
            client._call_gigachat = AsyncMock()

            result = await client.analyze_speech(
                transcript_text="hi",
                presentation_text="slides",
                provider=AnalyzeProvider.openai,
                persona=PersonaRoles.strict_critic,
            )

        assert isinstance(result, SpeechReport)
        assert result.summary == "good"
        client._call_openai.assert_awaited_once()
        client._call_gigachat.assert_not_awaited()

    async def test_long_transcript_is_truncated(
        self, llm_client_module
    ):
        """Transcript longer than TRANSCRIPTION_LIMIT gets truncated."""
        long_text = "x" * 10_000
        presentation_text = "y" * 10_000

        captured_messages = {}

        async def capture_call(messages, model):
            captured_messages["messages"] = messages
            captured_messages["model"] = model
            return (
                '{"summary": "ok", "structure": "", '
                '"mistakes": "", "ideal_text": "", '
                '"persona_feedback": "", "dynamic_fillers": [], '
                '"presentation_feedback": "", "useful_links": ""}'
            )

        with (
            patch("app.logic.llm_client.openai.AsyncOpenAI"),
            patch("app.logic.llm_client.GigaChat"),
            patch(
                "app.logic.llm_client.prompts.get_analyze_speech_system_prompt",
                return_value="sys",
            ),
        ):
            client = llm_client_module.LLMClient()
            client._call_gigachat = AsyncMock(side_effect=capture_call)

            await client.analyze_speech(
                transcript_text=long_text,
                presentation_text=presentation_text,
                provider=AnalyzeProvider.gigachat,
                persona=PersonaRoles.kind_mentor,
            )

        user_msg = captured_messages["messages"][1]["content"]
        # TRANSCRIPTION_LIMIT=7000, PRESENTATION_TEXT_LIMIT=5000
        # So we expect at most 7000 x's in the transcription section
        # and at most 5000 y's in the presentation section.
        assert user_msg.count("x") <= 7_000
        assert user_msg.count("y") <= 5_000
        assert user_msg.count("x") == 7_000
        assert user_msg.count("y") == 5_000
        assert "ТРАНСКРИПЦИЯ" in user_msg
        assert "ТЕКСТ ПРЕЗЕНТАЦИИ" in user_msg

    async def test_gigachat_not_initialized_returns_error_report(
        self, llm_client_module
    ):
        with (
            patch("app.logic.llm_client.openai.AsyncOpenAI"),
            patch("app.logic.llm_client.GigaChat", return_value=None),
            patch(
                "app.logic.llm_client.prompts.get_analyze_speech_system_prompt",
                return_value="sys",
            ),
        ):
            client = llm_client_module.LLMClient()
            # gigachat_client will be None; _call_gigachat raises ValueError
            result = await client.analyze_speech(
                transcript_text="hi",
                presentation_text="",
                provider=AnalyzeProvider.gigachat,
                persona=PersonaRoles.steve_jobs_style,
            )

        assert isinstance(result, SpeechReport)
        # Error flow fills summary with the error message
        assert "GigaChat" in result.summary


class TestParseJsonResponse:
    def test_strips_markdown_fences(self, llm_client_module):
        with (
            patch("app.logic.llm_client.openai.AsyncOpenAI"),
            patch("app.logic.llm_client.GigaChat"),
        ):
            client = llm_client_module.LLMClient()

        raw = '```json\n{"summary": "x"}\n```'
        result = client._parse_json_response(raw)
        assert result == {"summary": "x"}

    def test_invalid_json_raises(self, llm_client_module):
        with (
            patch("app.logic.llm_client.openai.AsyncOpenAI"),
            patch("app.logic.llm_client.GigaChat"),
        ):
            client = llm_client_module.LLMClient()

        with pytest.raises(Exception):
            client._parse_json_response("not json")
