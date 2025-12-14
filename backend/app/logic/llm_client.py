import openai
import json
from app.config import settings


class LLMClient:
    def __init__(self):
        self.client = openai.AsyncOpenAI(
            base_url=settings.llm_api_base, api_key=settings.llm_api_key
        )
        self.model = settings.llm_model_name

    async def analyze_speech(self, transcript_text: str, slides_text: str, persona: str = None) -> dict:
        persona_prompt = "Ты эксперт по публичным выступлениям."
        if persona == "strict_critic":
            persona_prompt = "Ты строгий критик. Жестко указывай на недостатки."

        system_prompt = f"""
        {persona_prompt}

        Тебе даны:
        1. Текст выступления (транскрипция).
        2. Текст, распознанный со слайдов презентации (OCR).

        Твоя задача проанализировать это и вернуть JSON.

        ЗАДАЧА 1: Найди "Динамические слова-паразиты" (Dynamic Fillers).
        Это слова, которые спикер повторяет слишком часто, и которые можно удалить без потери смысла (например: "собственно", "как бы", "вот", "значит", или специфичные слова-паразиты спикера). Верни список из 3-5 таких слов.

        ЗАДАЧА 2: Оцени слайды (если есть текст).
        Если текста много, напиши, что слайды перегружены. Если текста мало/нет, оцени уместность.

        Формат JSON ответа:
        {{
            "summary": "Краткое содержание (2-3 предложения)",
            "structure": "Вступление, Основная часть, Вывод",
            "mistakes": "Основные ошибки (стилистика, логика, повторы)",
            "ideal_text": "Улучшенная версия небольшого фрагмента текста",
            "persona_feedback": "Обратная связь в стиле персоны",
            "dynamic_fillers": ["слово1", "слово2", "слово3"],
            "slides_feedback": "Отзыв о слайдах (много текста, воды, или ок)"
        }}
        """

        user_content = f"ТРАНСКРИПЦИЯ:\n{transcript_text[:3000]}\n\nТЕКСТ СО СЛАЙДОВ:\n{slides_text[:1000]}"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            return {
                "summary": "Ошибка анализа",
                "structure": "-",
                "mistakes": str(e),
                "ideal_text": "-",
                "persona_feedback": "Ошибка LLM",
                "dynamic_fillers": [],
                "slides_feedback": "Не удалось проанализировать"
            }
