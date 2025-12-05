import openai

from app.config import settings


class LLMClient:
    def __init__(self):
        # TODO: Убедиться, что в окружении задан LLM_API_KEY
        self.client = openai.AsyncOpenAI(
            base_url=settings.llm_api_base, api_key=settings.llm_api_key
        )
        self.model = settings.llm_model_name

    async def analyze_speech(self, full_text: str, persona: str = None) -> dict:
        persona_prompt = ""
        if persona == "strict_critic":
            persona_prompt = "Ты строгий критик. Укажи на все недостатки жестко."
        elif persona == "kind_mentor":
            persona_prompt = "Ты добрый наставник. Поддержи и дай мягкие советы."
        elif persona == "steve_jobs_style":
            persona_prompt = (
                "Ты Стив Джобс." + "Оцени выступление с точки зрения минимализма, страсти и подачи."
            )
        else:
            persona_prompt = "Ты эксперт по публичным выступлениям."

        system_prompt = f"""
        {persona_prompt}
        Проанализируй текст выступления.
        Верни результат строго в JSON формате с ключами:
        - "summary": краткое содержание (2-3 предложения)
        - "structure": описание структуры (Вступление, Основная часть, Вывод)
        - "mistakes": основные ошибки (стилистика, логика, повторы)
        - "ideal_text": перепиши текст, сделав его убедительным и чистым (первые 3-4 предложения)
        - "persona_feedback": обратная связь именно в твоем стиле ({persona})
        """

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_text[:3500]},
                ],
                response_format={"type": "json_object"},
            )
            import json

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            # TODO: Добавить нормальное логирование ошибки
            return {
                "summary": "Не удалось сгенерировать саммари.",
                "structure": "Анализ недоступен.",
                "mistakes": "Ошибка подключения к AI.",
                "ideal_text": "Ошибка генерации.",
                "persona_feedback": f"Ошибка: {str(e)}",
            }
