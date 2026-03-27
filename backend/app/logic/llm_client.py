import json
import logging
from pathlib import Path

import openai
from gigachat import GigaChat

from app.config import settings
from app.logic import prompts
from app.models.schemas import AnalyzeProvider, EvaluationCriterion, PersonaRoles, SpeechReport

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
    ) -> SpeechReport:
        """Analyze the speech text using the specified provider and model.

        Args:
            transcript_text (str): Transcribed speech text to analyze.
            presentation_text (str): Text content of the user's presentation.
            provider (AnalyzeProvider): LLM provider to use for analysis.
            persona (PersonaRoles): AI persona role for the analysis.

        Returns:
            SpeechReport: Response containing analysis results.
        """
        system_prompt = prompts.get_analyze_speech_system_prompt(persona)

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

            return SpeechReport(**self._parse_json_response(content))

        except Exception as error_msg:
            logger.error(
                f"LLM analysis error ({provider}/{provider.model_name}): {str(error_msg)}",
                exc_info=True,
            )
            response = LLMClient._get_empty_speech_analysis_response()
            response.summary = str(error_msg)
            return response

    async def get_evaluation_criteria(
        self,
        evaluation_criteria_path: str,
    ) -> list[EvaluationCriterion]:
        """Extract evaluation criteria from uploaded file or preset.

        Args:
            evaluation_criteria_path (str): Path to criteria file (.json, .docx, .txt).

        Raises:
            RuntimeError: If criteria extraction fails.

        Returns:
            list[EvaluationCriterion]: List of criteria without current_value/feedback.
        """
        if not evaluation_criteria_path:
            return []

        file_ext = Path(evaluation_criteria_path).suffix.lower()

        # Case 1: JSON preset file - load directly
        if file_ext == ".json":
            return self._load_criteria_from_json(evaluation_criteria_path)

        # Case 2: DOCX or TXT - use LLM to extract criteria
        document_text = self._read_document_text(evaluation_criteria_path, file_ext)

        system_prompt = prompts.get_evaluation_criteria_identity_prompt()

        user_content = (
            f"Исходный документ с требованиями/критериями:\n{document_text[:10000]}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        content = await self._call_gigachat(messages, settings.gigachat_model_name)
        parsed = self._parse_json_response(content)

        criteria_list = parsed.get("criteria", [])
        if not criteria_list:
            raise RuntimeError("Failed to extract criteria from document: empty result")

        return [
            EvaluationCriterion(
                name=c["name"],
                description=c["description"],
                max_value=c["max_value"],
            )
            for c in criteria_list
        ]

    def _load_criteria_from_json(self, json_path: str) -> list[EvaluationCriterion]:
        """Load criteria from JSON preset file."""
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        criteria_list = data.get("criteria", [])
        if not criteria_list:
            raise RuntimeError("Empty criteria list in JSON preset")

        return [
            EvaluationCriterion(
                name=c["name"],
                description=c["description"],
                max_value=c["max_value"],
            )
            for c in criteria_list
        ]

    def _read_document_text(self, file_path: str, file_ext: str) -> str:
        """Read text from DOCX or TXT file."""
        if file_ext == ".txt":
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        elif file_ext == ".docx":
            from docx import Document
            doc = Document(file_path)
            text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
            if not text:
                raise RuntimeError("Empty DOCX file")
            return text
        else:
            raise RuntimeError(f"Unsupported document format: {file_ext}")

    async def analyze_with_evalution_criteria(
        self,
        transcript_text: str,
        presentation_text: str,
        provider: AnalyzeProvider,
        evaluation_criteria: list[EvaluationCriterion],
    ) -> list[EvaluationCriterion]:
        """Analyze speech against evaluation criteria using LLM.

        Args:
            transcript_text (str): Transcribed speech text.
            presentation_text (str): Presentation slide text.
            provider (AnalyzeProvider): LLM provider (ignored, always uses GigaChat).
            evaluation_criteria (list[EvaluationCriterion]): Criteria to evaluate against.

        Raises:
            RuntimeError: If criteria analysis fails.

        Returns:
            list[EvaluationCriterion]: Criteria with current_value and feedback filled.
        """
        if not evaluation_criteria:
            return []

        system_prompt = prompts.get_evaluation_criteria_rate_prompt()

        criteria_json = json.dumps([
            {"name": c.name, "description": c.description, "max_value": c.max_value}
            for c in evaluation_criteria
        ], ensure_ascii=False)

        user_content = (
            f"ТРАНСКРИПЦИЯ ВЫСТУПЛЕНИЯ:\n{transcript_text[:7000]}\n\n"
            f"ТЕКСТ ПРЕЗЕНТАЦИИ:\n{presentation_text[:5000]}\n\n"
            f"КРИТЕРИИ ОЦЕНИВАНИЯ:\n{criteria_json}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        content = await self._call_gigachat(messages, settings.gigachat_model_name)
        parsed = self._parse_json_response(content)

        scored_criteria = parsed.get("criteria", [])
        if not scored_criteria:
            raise RuntimeError("LLM returned empty criteria analysis")

        if len(scored_criteria) != len(evaluation_criteria):
            raise RuntimeError(
                f"Criteria count mismatch: expected {len(evaluation_criteria)}, "
                f"got {len(scored_criteria)}"
            )

        result = []
        for orig, scored in zip(evaluation_criteria, scored_criteria):
            current_value = scored.get("current_value", 0)
            if not isinstance(current_value, int) or current_value < 0:
                raise RuntimeError(f"Invalid current_value for criterion '{orig.name}'")

            result.append(
                EvaluationCriterion(
                    name=orig.name,
                    description=orig.description,
                    max_value=orig.max_value,
                    current_value=current_value,
                    feedback=scored.get("feedback", ""),
                )
            )
        return result

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
            raise error_msg

    @staticmethod
    def _get_empty_speech_analysis_response() -> SpeechReport:
        """Get empty speech analysis report.

        Returns:
            SpeechAnalysis: Response containing empty analysis results.
        """
        return SpeechReport(
            summary="",
            structure="",
            mistakes="",
            ideal_text="",
            persona_feedback="",
            dynamic_fillers=list(),
            presentation_feedback="",
        )
