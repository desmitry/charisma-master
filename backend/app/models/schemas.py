from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.config import settings


class TranscribeProvider(str, Enum):
    """Провайдер транскрибации речи."""

    sber_gigachat = "sber_gigachat"
    whisper_local = "whisper_local"
    whisper_openai = "whisper_openai"


class AnalyzeProvider(str, Enum):
    """Провайдер LLM-анализа текста выступления.

    Attrs:
        model_name: полное название модели для анализа.
    """

    gigachat = "gigachat"
    openai = "openai"

    @property
    def model_name(self) -> str:
        return {
            AnalyzeProvider.gigachat.value: settings.gigachat_model_name,
            AnalyzeProvider.openai.value: settings.openai_model_name,
        }[self.value]


class PersonaRoles(str, Enum):
    """Роль AI-критика при анализе выступления."""

    strict_critic = "strict_critic"
    kind_mentor = "kind_mentor"
    steve_jobs_style = "steve_jobs_style"
    speech_review_specialist = "speech_review_specialist"


class TaskState(str, Enum):
    """Состояние задачи обработки в Celery.

    Attrs:
        hint: текстовое описание состояния.
    """

    queued = "PENDING"
    processing = "PROCESSING"
    finished = "SUCCESS"
    failed = "FAILURE"

    @property
    def hint(self) -> str:
        return self.value


class TaskStage(Enum):
    """Этап обработки задачи с метаданными для Celery и фронтенда.

    Attrs:
        meta: словарь с названием этапа, процентом выполнения и подсказкой для UI.
    """

    transcription = (
        "transcription",
        0.1,
        "Транскрибация аудио...",
    )
    video_analisis = (
        "video_analysis",
        0.25,
        "Анализ видео...",
    )
    audio_analisis = (
        "audio_analisis",
        0.4,
        "Анализ аудио...",
    )
    presentation_text_parsing = (
        "presentation_text_parsing",
        0.45,
        "Просмотр презентации... ",
    )
    evaluation_criteria_report = (
        "evaluation_criteria_report",
        0.5,
        "Изучение критериев оценивания...",
    )
    llm_speech_report = (
        "llm_speech_report",
        0.7,
        "Формирование отчёта по выступлению...",
    )
    llm_criteria_report = (
        "llm_criteria_report",
        0.9,
        "Оценка выступления по критериям...",
    )

    def __init__(self, stage_name: str, stage_percent: float, stage_hint: str):
        self.__stage_name = stage_name
        self.__stage_percent = stage_percent
        self.__stage_hint = stage_hint

    @property
    def meta(self) -> dict:
        return {
            "stage": self.__stage_name,
            "progress": self.__stage_percent,
            "hint": self.__stage_hint,
        }


class TranscriptWord(BaseModel):
    """Отдельное слово из транскрипции с временными метками."""

    start: float = Field(description="Время начала слова в секундах")
    end: float = Field(description="Время окончания слова в секундах")
    text: str = Field(description="Текст слова")
    is_filler: bool = Field(default=False, description="Является ли слово паразитом (ну, типа, как бы)")


class TranscriptSegment(BaseModel):
    """Сегмент транскрипции — фраза или предложение с набором слов."""

    start: float = Field(description="Время начала сегмента в секундах")
    end: float = Field(description="Время окончания сегмента в секундах")
    text: str = Field(description="Полный текст сегмента")
    words: List[TranscriptWord] = Field(description="Список слов в сегменте")


class TempoPoint(BaseModel):
    """Точка измерения темпа речи в определённый момент времени."""

    time: float = Field(description="Время измерения в секундах")
    wpm: float = Field(description="Слов в минуту (words per minute)")
    zone: str = Field(description="Зона темпа: slow, normal, fast")


class PauseInterval(BaseModel):
    """Длинная пауза в речи."""

    start: float = Field(description="Начало паузы в секундах")
    end: float = Field(description="Конец паузы в секундах")
    duration: float = Field(description="Продолжительность паузы в секундах")


class ConfidenceComponents(BaseModel):
    """Компоненты индекса уверенности оратора (0-100 по каждому параметру)."""

    volume_level: str = Field(description="Уровень громкости: quiet, normal, loud")
    volume_score: int = Field(description="Оценка громкости (0-100)")
    volume_label: str = Field(description="Текстовая оценка громкости")
    filler_score: int = Field(description="Оценка по словам-паразитам (0-100, больше = лучше)")
    filler_label: str = Field(description="Текстовая оценка по паразитам")
    gaze_score: int = Field(description="Оценка направления взгляда (0-100)")
    gaze_label: str = Field(description="Текстовая оценка взгляда")
    gesture_score: int = Field(description="Оценка жестикуляции (0-100)")
    gesture_label: str = Field(description="Текстовая оценка жестов")
    gesture_advice: str = Field(description="Рекомендация по улучшению жестикуляции")
    tone_score: int = Field(description="Оценка тона голоса (0-100)")
    tone_label: str = Field(description="Текстовая оценка тона")


class ConfidenceIndex(BaseModel):
    """Итоговый индекс уверенности оратора с компонентами."""

    total: float = Field(description="Общий индекс уверенности (0-100)")
    total_label: str = Field(description="Текстовая оценка: Низкий / Средний / Высокий")
    components: ConfidenceComponents = Field(description="Детализация по компонентам")


class FillersSummary(BaseModel):
    """Сводка по словам-паразитам в речи."""

    count: int = Field(description="Общее количество слов-паразитов")
    ratio: int | float = Field(description="Доля паразитов от общего числа слов (0.0 - 1.0)")


class SpeechReport(BaseModel):
    """Отчёт LLM-анализа содержания выступления."""

    summary: str = Field(description="Краткое резюме выступления")
    structure: str = Field(description="Анализ структуры речи")
    mistakes: str = Field(description="Выявленные ошибки и недочёты")
    ideal_text: str = Field(description="Улучшенная версия текста выступления")
    persona_feedback: str = Field(description="Обратная связь от выбранной AI-персоны")
    dynamic_fillers: list[str] = Field(description="Контекстные слова-паразиты, обнаруженные LLM")
    presentation_feedback: str = Field(description="Обратная связь по содержанию презентации")


class EvaluationCriterion(BaseModel):
    """Отдельный критерий оценки выступления."""

    name: str = Field(description="Название критерия")
    description: str = Field(description="Описание критерия")
    max_value: int = Field(description="Максимальный балл по критерию")
    current_value: int = Field(default=0, description="Набранный балл по критерию")
    feedback: str = Field(default="", description="Комментарий по критерию")


class EvaluationCriteriaReport(BaseModel):
    """Отчёт оценки выступления по заданным критериям."""

    total_score: int = Field(description="Суммарный набранный балл")
    max_score: int = Field(description="Максимально возможный балл")
    criteria: list[EvaluationCriterion] = Field(description="Список критериев с оценками")


class AnalysisResult(BaseModel):
    """Полный результат анализа выступления."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                "video_path": "/media/550e8400-e29b-41d4-a716-446655440000.mp4",
                "transcript": [],
                "tempo": [],
                "long_pauses": [],
                "fillers_summary": {"count": 12, "ratio": 0.05},
                "confidence_index": {
                    "total": 72,
                    "total_label": "Средний",
                    "components": {
                        "volume_level": "normal",
                        "volume_score": 80,
                        "volume_label": "Хорошо",
                        "filler_score": 65,
                        "filler_label": "Средне",
                        "gaze_score": 70,
                        "gaze_label": "Хорошо",
                        "gesture_score": 60,
                        "gesture_label": "Средне",
                        "gesture_advice": "Используйте больше открытых жестов",
                        "tone_score": 75,
                        "tone_label": "Хорошо",
                    },
                },
                "speech_report": {
                    "summary": "Выступление на тему...",
                    "structure": "Логичная структура с введением и заключением",
                    "mistakes": "Частые повторы, нечёткие формулировки",
                    "ideal_text": "Улучшенный вариант текста...",
                    "persona_feedback": "Обратная связь от критика...",
                    "dynamic_fillers": ["как бы", "в принципе"],
                    "presentation_feedback": "Слайды соответствуют речи",
                },
                "evaluation_criteria_report": {
                    "total_score": 35,
                    "max_score": 50,
                    "criteria": [],
                },
                "analyze_provider": "gigachat",
                "analyze_model": "GigaChat",
                "transcribe_model": "sber_gigachat",
            }
        }
    )

    task_id: str = Field(description="UUID задачи обработки")
    video_path: str = Field(description="Путь к видеофайлу для воспроизведения")
    transcript: List[TranscriptSegment] = Field(description="Сегменты транскрипции речи")
    tempo: List[TempoPoint] = Field(description="Точки измерения темпа речи")
    long_pauses: List[PauseInterval] = Field(description="Длинные паузы в речи (> 2 сек)")
    fillers_summary: FillersSummary = Field(description="Сводка по словам-паразитам")
    confidence_index: ConfidenceIndex = Field(description="Индекс уверенности оратора")
    speech_report: SpeechReport = Field(description="LLM-отчёт по содержанию речи")
    evaluation_criteria_report: EvaluationCriteriaReport = Field(
        description="Отчёт по критериям оценивания"
    )
    analyze_provider: str = Field(description="Провайдер LLM-анализа (gigachat / openai)")
    analyze_model: str = Field(description="Название модели анализа")
    transcribe_model: str = Field(description="Провайдер транскрибации")


class TaskStatusResponse(BaseModel):
    """Статус задачи обработки выступления."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                "state": "PROCESSING",
                "hint": "Анализ видео...",
                "progress": 0.25,
                "stage": None,
                "error": None,
            }
        }
    )

    task_id: str = Field(description="UUID задачи")
    state: TaskState = Field(description="Текущее состояние: PENDING, PROCESSING, SUCCESS, FAILURE")
    hint: str = Field(description="Текстовая подсказка о текущем этапе")
    progress: float = Field(default=0.0, description="Прогресс обработки (0.0 - 1.0)")
    stage: Optional[TaskStage] = Field(default=None, description="Текущий этап обработки")
    error: Optional[str] = Field(default=None, description="Описание ошибки (при state=FAILURE)")


class UploadResponse(BaseModel):
    """Ответ на загрузку видео — содержит ID созданной задачи."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
            }
        }
    )

    task_id: str = Field(description="UUID созданной задачи для отслеживания прогресса")


class RatingRequest(BaseModel):
    """Запрос на оценку качества анализа."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "rating": 4,
            }
        }
    )

    rating: int = Field(ge=1, le=5, description="Оценка качества анализа от 1 до 5")


class RatingResponse(BaseModel):
    """Ответ на сохранение оценки."""

    task_id: str = Field(description="UUID задачи")
    rating: int = Field(description="Сохранённая оценка")
    message: str = Field(description="Сообщение о результате")


class TelemetryStatsResponse(BaseModel):
    """Сводная статистика использования сервиса."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_analyses": 150,
                "rated_count": 89,
                "average_rating": 4.2,
                "average_confidence": 68.5,
            }
        }
    )

    total_analyses: int = Field(description="Общее количество обработанных выступлений")
    rated_count: int = Field(description="Количество оценённых пользователями анализов")
    average_rating: Optional[float] = Field(
        default=None, description="Средняя пользовательская оценка (1-5)"
    )
    average_confidence: Optional[float] = Field(
        default=None, description="Средний индекс уверенности оратора"
    )
