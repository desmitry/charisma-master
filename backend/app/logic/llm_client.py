import json
import logging
from typing import Any

import openai
from gigachat import GigaChat

from app.config import settings
from app.logic import prompts
from app.models.schemas import AnalyzeProvider, PersonaRoles

logger = logging.getLogger(__name__)


class LLMClient:
    """Client for interacting with LLM providers (OpenAI and GigaChat).
    Allows runtime selection of the provider and model.

    Raises:
        ValueError: If GigaChat client is not properly initialized.

    Returns:
        dict: Analysis results or error response dictionary.
    """

    TRANSCRIPTION_LIMIT = 7_000
    PRESENTATION_TEXT_LIMIT = 5_000

    def __init__(self):
        self.openai_client = openai.AsyncOpenAI(
            base_url=settings.openai_api_base,
            api_key=settings.openai_api_key,
        )
        self.gigachat_client = GigaChat(
            credentials=settings.gigachat_credentials,
            verify_ssl_certs=settings.gigachat_verify_ssl,
            scope=settings.gigachat_scope,
        )

    async def analyze_speech(
        self,
        transcript_text: str,
        presentation_text: str,
        provider: AnalyzeProvider,
        persona: PersonaRoles,
    ) -> dict[str, Any]:
        """Analyze the speech text using the specified provider and model.

        Args:
            transcript_text (str): Transcribed speech text to analyze.
            presentation_text (str): Text content of the user's presentation.
            provider (AnalyzeProvider): LLM provider to use for analysis.
            persona (PersonaRoles): AI persona role for the analysis.

        Returns:
            dict[str, Any]: Dictionary containing analysis results.
        """

        persona_prompt = prompts.get_persona_prompt(persona)
        system_prompt = prompts.get_system_prompt(persona_prompt)

        user_content = (
            f"ТРАНСКРИПЦИЯ:\n"
            f"{transcript_text[: LLMClient.TRANSCRIPTION_LIMIT]}\n\n"
            f"ТЕКСТ ПРЕЗЕНТАЦИИ:\n{presentation_text[: LLMClient.PRESENTATION_TEXT_LIMIT]}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        try:
            if provider == AnalyzeProvider.gigachat:
                content = await self._call_gigachat(messages, provider.model_name)
            else:
                content = await self._call_openai(messages, provider.model_name)

            return self._parse_json_response(content)

        except Exception as error_msg:
            logger.error(
                f"LLM analysis error ({provider}/{provider.model_name}): {str(error_msg)}",
                exc_info=True,
            )
            return self._error_response(str(error_msg))

    async def _call_openai(self, messages: list, model: str) -> str:
        """Send a chat completion request to OpenAI API.

        Args:
            messages (list): List of message dictionaries for the chat completion.
            model (str): Name of the OpenAI model to use.

        Returns:
            str: Response content from the OpenAI API.
        """
        response = await self.openai_client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content

    async def _call_gigachat(self, messages: list, model: str) -> str:
        """Send a chat completion request to GigaChat API.

        Args:
            messages (list): List of message dictionaries for the chat completion.
            model (str): Name of the GigaChat model to use.

        Raises:
            ValueError: If GigaChat client is not initialized.

        Returns:
            str: Response content from the GigaChat API.
        """
        if not self.gigachat_client:
            raise ValueError("GigaChat client is not initialized. Check credentials.")

        response = await self.gigachat_client.achat(payload={"messages": messages, "model": model})
        return response.choices[0].message.content

    def _parse_json_response(self, content: str) -> dict:
        """Clean and parse the JSON string returned by LLM.

        Args:
            content (str): Raw JSON string response from the LLM.

        Returns:
            dict: Parsed JSON as a dictionary, or error response if parsing fails.
        """
        cleaned = content.replace("```json", "").replace("```", "").strip()

        try:
            result = json.loads(cleaned)
            return result
        except Exception as error_msg:
            return self._error_response(str(error_msg))

    @staticmethod
    def _error_response(error_msg: str):
        """Return a standardized error response dictionary.

        Args:
            error_msg (str): Error message to include in the response.

        Returns:
            dict: Dictionary with error placeholders for all LLM analysis fields.
        """
        return {
            "summary": error_msg,
            "structure": "Ошибка анализа",
            "mistakes": "Ошибка анализа",
            "ideal_text": "Ошибка анализа",
            "persona_feedback": "Ошибка анализа",
            "dynamic_fillers": [],
            "slides_feedback": "Ошибка анализа",
        }
