import json
import logging
from pathlib import Path
from typing import Any

import openai
from charisma_schemas import (
    AnalyzeProvider,
    EvaluationCriterion,
    PersonaRoles,
    SpeechReport,
)
from gigachat import GigaChat

from app.config import settings
from app.logic import prompts

logger = logging.getLogger(__name__)


class LLMClient:
    """Client for interacting with LLM providers (OpenAI and GigaChat)."""

    TRANSCRIPTION_LIMIT = 7_000
    PRESENTATION_TEXT_LIMIT = 5_000
    COMPETITION_ANALYSIS_LIMIT = 4_000

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
        competition_analysis: str = "",
    ) -> SpeechReport:
        """Analyze the speech text using the specified provider and model."""
        system_prompt = prompts.get_analyze_speech_system_prompt(persona)

        user_content = (
            "ТРАНСКРИПЦИЯ:\n"
            f"{transcript_text[: self.TRANSCRIPTION_LIMIT]}\n\n"
            "ТЕКСТ ПРЕЗЕНТАЦИИ:\n"
            f"{presentation_text[: self.PRESENTATION_TEXT_LIMIT]}\n\n"
            "ИССЛЕДОВАНИЕ КОНКУРЕНТОВ:\n"
            f"{self._build_competition_context(competition_analysis)}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        try:
            content = await self._call_provider(messages, provider)
            logger.debug("LLM response: %s", content)
            return SpeechReport(**self._parse_json_response(content))
        except Exception as error_msg:
            logger.error(
                "LLM analysis error (%s/%s): %s",
                provider,
                provider.model_name,
                str(error_msg),
                exc_info=True,
            )
            response = self._get_empty_speech_analysis_response()
            response.summary = (
                "Analysis could not be completed. Please try again."
            )
            return response

    async def get_evaluation_criteria(
        self,
        evaluation_criteria_path: str,
    ) -> list[EvaluationCriterion]:
        """Extract evaluation criteria from uploaded file or preset."""
        if not evaluation_criteria_path:
            return []

        file_ext = Path(evaluation_criteria_path).suffix.lower()

        if file_ext == ".json":
            return self._load_criteria_from_json(evaluation_criteria_path)

        document_text = self._read_document_text(
            evaluation_criteria_path, file_ext
        )

        system_prompt = prompts.get_evaluation_criteria_identity_prompt()
        user_content = (
            "Исходный документ с требованиями/критериями:\n"
            f"{document_text[:10000]}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        content = await self._call_gigachat(
            messages, settings.gigachat_model_name
        )
        parsed = self._parse_json_response(content)

        criteria_list = parsed.get("criteria", [])
        if not criteria_list:
            raise RuntimeError(
                "Failed to extract criteria from document: empty result"
            )

        return [
            EvaluationCriterion(
                name=c["name"],
                description=c["description"],
                max_value=c["max_value"],
            )
            for c in criteria_list
        ]

    async def analyze_with_evalution_criteria(
        self,
        transcript_text: str,
        presentation_text: str,
        provider: AnalyzeProvider,
        evaluation_criteria: list[EvaluationCriterion],
        competition_analysis: str = "",
    ) -> list[EvaluationCriterion]:
        """Analyze speech against evaluation criteria using LLM."""
        if not evaluation_criteria:
            return []

        system_prompt = prompts.get_evaluation_criteria_rate_prompt()

        criteria_json = json.dumps(
            [
                {
                    "name": c.name,
                    "description": c.description,
                    "max_value": c.max_value,
                }
                for c in evaluation_criteria
            ],
            ensure_ascii=False,
        )

        user_content = (
            f"ТРАНСКРИПЦИЯ ВЫСТУПЛЕНИЯ:\n"
            f"{transcript_text[: self.TRANSCRIPTION_LIMIT]}\n\n"
            f"ТЕКСТ ПРЕЗЕНТАЦИИ:\n"
            f"{presentation_text[: self.PRESENTATION_TEXT_LIMIT]}\n\n"
            "ИССЛЕДОВАНИЕ КОНКУРЕНТОВ:\n"
            f"{self._build_competition_context(competition_analysis)}\n\n"
            f"КРИТЕРИИ ОЦЕНИВАНИЯ:\n{criteria_json}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        content = await self._call_provider(messages, provider)
        parsed = self._parse_json_response(content)

        scored_criteria = parsed.get("criteria", [])
        if not scored_criteria:
            raise RuntimeError("LLM returned empty criteria analysis")

        if len(scored_criteria) != len(evaluation_criteria):
            raise RuntimeError(
                "Criteria count mismatch: "
                f"expected {len(evaluation_criteria)}, "
                f"got {len(scored_criteria)}"
            )

        result = []
        for orig, scored in zip(evaluation_criteria, scored_criteria):
            current_value = scored.get("current_value", 0)
            if not isinstance(current_value, int) or current_value < 0:
                raise RuntimeError(
                    f"Invalid current_value for criterion '{orig.name}'"
                )

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

    async def identify_competition_subject(
        self,
        transcript_text: str,
        presentation_text: str,
        provider: AnalyzeProvider,
    ) -> dict[str, Any]:
        """Identify the product being pitched in the uploaded talk."""
        system_prompt = prompts.get_competition_product_prompt()
        user_content = (
            "ТРАНСКРИПЦИЯ:\n"
            f"{transcript_text[: self.TRANSCRIPTION_LIMIT]}\n\n"
            "ТЕКСТ ПРЕЗЕНТАЦИИ:\n"
            f"{presentation_text[: self.PRESENTATION_TEXT_LIMIT]}"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        content = await self._call_provider(messages, provider)
        parsed = self._parse_json_response(content)

        product_name = str(parsed.get("product_name", "")).strip()
        search_query = str(parsed.get("search_query", "")).strip()
        can_identify = self._as_bool(parsed.get("can_identify"))
        if can_identify and product_name and not search_query:
            search_query = f"{product_name} конкуренты"

        return {
            "can_identify": can_identify and bool(product_name),
            "product_name": product_name,
            "product_description": str(
                parsed.get("product_description", "")
            ).strip(),
            "search_query": search_query,
        }

    async def analyze_competition_source(
        self,
        product_name: str,
        product_description: str,
        source_title: str,
        source_url: str,
        source_text: str,
        provider: AnalyzeProvider,
    ) -> dict[str, Any]:
        """Review a fetched source for competitor-research relevance."""
        system_prompt = prompts.get_competition_source_prompt()
        user_content = (
            f"ПРОДУКТ:\n{product_name}\n\n"
            f"ОПИСАНИЕ ПРОДУКТА:\n{product_description}\n\n"
            f"ИСТОЧНИК:\n{source_title}\n{source_url}\n\n"
            f"ТЕКСТ ИСТОЧНИКА:\n"
            f"{source_text[: settings.competition_source_text_limit]}"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        content = await self._call_provider(messages, provider)
        parsed = self._parse_json_response(content)
        return {
            "is_relevant": self._as_bool(parsed.get("is_relevant")),
            "competitor_name": str(parsed.get("competitor_name", "")).strip(),
            "summary": str(parsed.get("summary", "")).strip(),
            "evidence": str(parsed.get("evidence", "")).strip(),
            "source_url": source_url,
            "source_title": source_title,
        }

    async def synthesize_competition_report(
        self,
        product_name: str,
        product_description: str,
        source_reviews: list[dict[str, Any]],
        provider: AnalyzeProvider,
    ) -> str:
        """Synthesize the reviewed sources into a final report."""
        if not source_reviews:
            return ""

        system_prompt = prompts.get_competition_summary_prompt()
        user_content = (
            f"ПРОДУКТ:\n{product_name}\n\n"
            f"ОПИСАНИЕ ПРОДУКТА:\n{product_description}\n\n"
            "ПРОАНАЛИЗИРОВАННЫЕ ИСТОЧНИКИ:\n"
            f"{json.dumps(source_reviews, ensure_ascii=False)}"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        content = await self._call_provider(messages, provider)
        parsed = self._parse_json_response(content)
        return str(parsed.get("competition_analysis", "")).strip()

    def _load_criteria_from_json(
        self, json_path: str
    ) -> list[EvaluationCriterion]:
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

    @staticmethod
    def _read_document_text(file_path: str, file_ext: str) -> str:
        """Read text from DOCX or TXT file."""
        if file_ext in (".txt", ".md"):
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        if file_ext in (".docx", ".doc"):
            from docx import Document

            doc = Document(file_path)
            text = "\n".join(
                [p.text for p in doc.paragraphs if p.text.strip()]
            )
            if not text:
                raise RuntimeError("Empty DOCX file")
            return text

        raise RuntimeError(f"Unsupported document format: {file_ext}")

    async def _call_provider(
        self, messages: list[dict[str, str]], provider: AnalyzeProvider
    ) -> str | None:
        if provider == AnalyzeProvider.gigachat:
            return await self._call_gigachat(messages, provider.model_name)
        return await self._call_openai(messages, provider.model_name)

    async def _call_openai(self, messages: list, model: str) -> str | None:
        """Send a chat completion request to OpenAI API."""
        response = await self.openai_client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content

    async def _call_gigachat(self, messages: list, model: str) -> str:
        """Send a chat completion request to GigaChat API."""
        if not self.gigachat_client:
            raise ValueError(
                "GigaChat client is not initialized. Check credentials."
            )

        response = await self.gigachat_client.achat(
            payload={"messages": messages, "model": model}
        )
        return response.choices[0].message.content

    def _parse_json_response(self, content: str) -> dict:
        """Clean and parse the JSON string returned by LLM."""
        cleaned = content.replace("```json", "").replace("```", "").strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise RuntimeError("LLM returned invalid JSON response") from exc

    @staticmethod
    def _build_competition_context(competition_analysis: str) -> str:
        competition_analysis = competition_analysis.strip()
        if competition_analysis:
            return competition_analysis[: LLMClient.COMPETITION_ANALYSIS_LIMIT]
        return "Недостаточно данных для анализа конкурентов."

    @staticmethod
    def _as_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "да"}
        if isinstance(value, int):
            return value != 0
        return False

    @staticmethod
    def _get_empty_speech_analysis_response() -> SpeechReport:
        """Get empty speech analysis report."""
        return SpeechReport(
            summary="",
            structure="",
            mistakes="",
            ideal_text="",
            persona_feedback="",
            dynamic_fillers=[],
            presentation_feedback="",
            competition_analysis="",
            useful_links="",
        )
