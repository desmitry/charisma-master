import json
import logging
from typing import Optional, Dict, Any

import openai
from gigachat import GigaChat

from app.config import settings

logger = logging.getLogger(__name__)


class LLMClient:
    """
    Client for interacting with LLM providers (OpenAI and GigaChat).
    Allows runtime selection of the provider and model.
    """

    def __init__(self):
        self.openai_client = openai.AsyncOpenAI(
            base_url=settings.openai_api_base,
            api_key=settings.openai_api_key
        )

        # Initialize GigaChat client if credentials are present
        self.gigachat_client: Optional[GigaChat] = None
        if getattr(settings, "gigachat_credentials", None):
            self.gigachat_client = GigaChat(
                credentials=settings.gigachat_credentials,
                verify_ssl_certs=getattr(settings, "gigachat_verify_ssl", False),
                scope=getattr(settings, "gigachat_scope", "GIGACHAT_API_PERS"),
            )

    async def analyze_speech(
            self,
            full_text: str,
            provider: str,
            model: str,
            persona: str = None
    ) -> Dict[str, Any]:
        """
        Analyze the speech text using the specified provider and model.

        :param full_text: Transcript of the speech.
        :param persona: Persona identifier for the system prompt.
        :param provider: 'openai' or 'gigachat'. Defaults to settings if None.
        :param model: Specific model name (e.g., 'gpt-4', 'GigaChat-Pro'). Defaults to settings if None.
        """

        persona_prompt = self._get_persona_prompt(persona)
        system_prompt = self._build_system_prompt(persona_prompt, persona)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": full_text[:3500]},
        ]

        try:
            if provider == "gigachat":
                content = await self._call_gigachat(messages, model)
            else:
                content = await self._call_openai(messages, model)

            return self._parse_json_response(content)

        except Exception as e:
            logger.error(f"LLM Analysis Error ({provider}/{model}): {str(e)}", exc_info=True)
            return {
                "summary": "Не удалось сгенерировать саммари.",
                "structure": "Анализ недоступен.",
                "mistakes": f"Ошибка AI провайдера: {provider}",
                "ideal_text": "Ошибка генерации.",
                "persona_feedback": f"Произошла техническая ошибка: {str(e)}",
            }

    async def _call_openai(self, messages: list, model: str) -> str:
        response = await self.openai_client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content

    async def _call_gigachat(self, messages: list, model: str) -> str:
        if not self.gigachat_client:
            raise ValueError("GigaChat client is not initialized. Check credentials.")

        response = await self.gigachat_client.achat(
            payload={
                "messages": messages,
                "model": model
            }
        )
        return response.choices[0].message.content

    @staticmethod
    def _parse_json_response(content: str) -> dict:
        """Clean and parse the JSON string returned by LLM."""
        cleaned = content.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)

    @staticmethod
    def _build_system_prompt(persona_prompt: str) -> str:
        return f"""
        {persona_prompt}
        Проанализируй текст выступления.
        Учти, что текст является автоматической транскрипцией речи.
        В нем могут быть ошибки распознавания (опечатки, неверные окончания).
        Не критикуй спикера за орфографию или странные словоформы,
        оценивай только смысл и структуру.

        ВАЖНО: Верни результат СТРОГО в формате чистого JSON без лишнего текста и форматирования Markdown.
        Ключи JSON:
        - "summary": краткое содержание (2-3 предложения)
        - "structure": описание структуры (Вступление, Основная часть, Вывод)
        - "mistakes": основные ошибки (стилистика, логика, повторы)
        - "ideal_text": перепиши текст, сделав его убедительным и чистым (первые 3-4 предложения)
        - "persona_feedback": обратная связь именно в твоем стиле ({persona_prompt})
        """

    @staticmethod
    def _get_persona_prompt(persona: Optional[str]) -> str:
        if persona == "strict_critic":
            return "Ты строгий критик. Укажи на все недостатки жестко."
        elif persona == "kind_mentor":
            return "Ты добрый наставник. Поддержи и дай мягкие советы."
        elif persona == "steve_jobs_style":
            return "Ты Стив Джобс. Оцени выступление с точки зрения минимализма, страсти и подачи."
        else:
            return "Ты эксперт по публичным выступлениям."
