import openai
import json
import os
from app.config import settings
from gigachat import GigaChat


class LLMClient:
    def __init__(self, provider: str = "openai"):
        self.provider = provider

        if self.provider == "openai":
            self.client = openai.AsyncOpenAI(
                base_url=settings.llm_api_base, api_key=settings.llm_api_key
            )
            self.model = settings.llm_model_name

        elif self.provider == "gigachat":
            auth_data = os.getenv("GIGACHAT_CREDENTIALS")
            if not auth_data:
                print("WARNING: GIGACHAT_CREDENTIALS not found in env")

            if GigaChat:
                self.giga = GigaChat(credentials=auth_data, verify_ssl_certs=False)
            else:
                raise ImportError("Библиотека gigachat не установлена")

    async def analyze_speech(self, transcript_text: str, slides_text: str, persona: str = None) -> dict:
        persona_prompt = "Ты эксперт по публичным выступлениям."
        if persona == "strict_critic":
            persona_prompt = "Ты строгий критик. Жестко указывай на недостатки."

        system_prompt = f"""
                {persona_prompt}

                Тебе даны:
                1. Текст выступления (транскрипция). ВНИМАНИЕ: Транскрипция получена автоматически, в ней могут отсутствовать знаки препинания и заглавные буквы. Игнорируй отсутствие пунктуации, оценивай только смысл, структуру речи и подбор слов.
                2. Текст, распознанный со слайдов презентации (OCR).

                Твоя задача проанализировать это и вернуть JSON.

                ЗАДАЧА 1: Найди "Динамические слова-паразиты" (Dynamic Fillers).
                Это слова, которые спикер повторяет слишком часто (например: "собственно", "как бы", "вот", "значит"). Верни список из 3-5 таких слов.

                ЗАДАЧА 2: Оцени слайды (если есть текст).
                Если текста много, напиши, что слайды перегружены. Если текста мало/нет, оцени уместность.

                Формат JSON ответа (все поля обязательны):
                {{
                    "summary": "Краткое содержание (2-3 предложения)",
                    "structure": "Вступление, Основная часть, Вывод (оцени наличие)",
                    "mistakes": "Основные ошибки (стилистика, логика, повторы)",
                    "ideal_text": "Улучшенная версия небольшого фрагмента (добавь пунктуацию)",
                    "persona_feedback": "Обратная связь в стиле персоны",
                    "dynamic_fillers": ["слово1", "слово2", "слово3"],
                    "slides_feedback": "Отзыв о слайдах"
                }}
                """

        user_content = f"ТРАНСКРИПЦИЯ:\n{transcript_text[:3000]}\n\nСЛАЙДЫ:\n{slides_text[:1000]}"

        if self.provider == "openai":
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
                return self._error_response(str(e))

        elif self.provider == "gigachat":
            try:
                payload = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ]
                response = self.giga.chat(payload=payload)
                content = response.choices[0].message.content

                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]

                return json.loads(content)
            except Exception as e:
                return self._error_response(f"GigaChat Error: {str(e)}")

        return self._error_response("Unknown provider")

    def _error_response(self, error_msg: str):
        return {
            "summary": "Ошибка анализа",
            "structure": "-",
            "mistakes": error_msg,
            "ideal_text": "-",
            "persona_feedback": "Ошибка LLM",
            "dynamic_fillers": [],
            "slides_feedback": "-"
        }
