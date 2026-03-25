from enum import Enum
from typing import List, Optional

from pydantic import BaseModel

from app.config import settings


class TranscribeProvider(str, Enum):
    """Enum of speech transcription providers for the ML engine."""

    sber_gigachat = "sber_gigachat"
    whisper_local = "whisper_local"
    whisper_openai = "whisper_openai"


class AnalyzeProvider(str, Enum):
    """Enum of providers for analyzing speech text for the ML engine.

    Attrs:
        model_name: full name of the model to be used for the analysis.
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
    """Enum of the critic's roles in text analysis."""

    strict_critic = "strict_critic"
    kind_mentor = "kind_mentor"
    steve_jobs_style = "steve_jobs_style"
    speech_review_specialist = "speech_review_specialist"


class TaskState(str, Enum):
    """Enum of Celery task states.

    Attrs:
        hint: default task information
    """

    queued = "PENDING"
    processing = "PROCESSING"
    finished = "SUCCESS"
    failed = "FAILURE"

    @property
    def hint(self) -> str:
        return self.value


class TaskStage(Enum):
    """Enum of all MLEngine task stages with metadata for Celery & frontend.

    Attrs:
        meta: a dict containing the name, completion percentage, and UI text.
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
    """A model that stores about transcribed words."""

    start: float
    end: float
    text: str
    is_filler: bool = False


class TranscriptSegment(BaseModel):
    """A model that stores about transcribed words."""

    start: float
    end: float
    text: str
    words: List[TranscriptWord]


class TempoPoint(BaseModel):
    """A model that stores about speech rate."""

    time: float
    wpm: float
    zone: str


class PauseInterval(BaseModel):
    """A model that stores about speech pauses."""

    start: float
    end: float
    duration: float


class ConfidenceComponents(BaseModel):
    """A model that stores about analysis user gestures and voice."""

    volume_level: str
    volume_score: int
    volume_label: str
    filler_score: int
    filler_label: str
    gaze_score: int
    gaze_label: str
    gesture_score: int
    gesture_label: str
    gesture_advice: str
    tone_score: int
    tone_label: str


class ConfidenceIndex(BaseModel):
    """A model that stores info about the final score and its weighting factors."""

    total: float
    total_label: str
    components: ConfidenceComponents


class FillersSummary(BaseModel):
    """A model that stores info about final assessment of the impact of filler words."""

    count: int
    ratio: int | float


class SpeechReport(BaseModel):
    """A model that stores info about LLM speech analisys."""

    summary: str
    structure: str
    mistakes: str
    ideal_text: str
    persona_feedback: str
    dynamic_fillers: list[str]
    presentation_feedback: str


class EvaluationCriterion(BaseModel):
    """A model that stores info about evaluation criterion."""

    name: str
    description: str
    max_value: int
    current_value: int = 0
    feedback: str = ""


class AnalysisResult(BaseModel):
    """A model for sending the final results of the analysis."""

    task_id: str
    video_path: str
    transcript: List[TranscriptSegment]
    tempo: List[TempoPoint]
    long_pauses: List[PauseInterval]
    fillers_summary: FillersSummary
    confidence_index: ConfidenceIndex
    speech_report: SpeechReport
    evaluation_criteria_report: list[EvaluationCriterion]
    analyze_provider: str
    analyze_model: str
    transcribe_model: str


class TaskStatusResponse(BaseModel):
    """A model for sending the status of a speech processing task."""

    task_id: str
    state: TaskState
    hint: str
    progress: float = 0.0
    stage: Optional[TaskStage] = None
    error: Optional[str] = None


class UploadResponse(BaseModel):
    """A model for sending information about a task that has been assigned."""

    task_id: str
