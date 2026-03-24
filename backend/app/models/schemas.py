from enum import Enum
from typing import List, Optional

from pydantic import BaseModel

from app.config import settings


class TranscribeProvider(str, Enum):
    "Модели для транскрибации"

    sber_gigachat = "sber_gigachat"
    whisper_local = "whisper_local"
    whisper_openai = "whisper_openai"


class AnalyzeProvider(str, Enum):
    "Провайдеры для анализа текста"

    gigachat = "gigachat"
    openai = "openai"

    @property
    def model_name(self) -> str:
        return {
            AnalyzeProvider.gigachat.value: settings.gigachat_model_name,
            AnalyzeProvider.openai.value: settings.openai_model_name,
        }[self.value]


class PersonaRoles(str, Enum):
    """
    Модель для выбора роли ИИ оценщика.
    """

    strict_critic = "strict_critic"
    kind_mentor = "kind_mentor"
    steve_jobs_style = "steve_jobs_style"
    speech_review_specialist = "speech_review_specialist"


class TaskState(str, Enum):
    queued = "PENDING"
    processing = "PROCESSING"
    finished = "SUCCESS"
    failed = "FAILURE"

    @property
    def hint(self) -> str:
        return self.value


class TaskStage(Enum):
    transcription = ("transcription", 0.1)
    video_analisis = ("video_analysis", 0.25)
    audio_analisis = ("audio_analisis", 0.4)
    llm_personal_report = ("llm_personal_report", 0.7)

    def __init__(self, stage_name: str, stage_percent: float):
        self.__stage_name = stage_name
        self.__stage_percent = stage_percent

    @property
    def meta(self) -> dict:
        return {"stage": self.__stage_name, "progress": self.__stage_percent}


class TranscriptWord(BaseModel):
    start: float
    end: float
    text: str
    is_filler: bool = False


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    words: List[TranscriptWord]


class TempoPoint(BaseModel):
    time: float
    wpm: float
    zone: str


class PauseInterval(BaseModel):
    start: float
    end: float
    duration: float


class SlideAnalysis(BaseModel):
    presentation_summary: str


class ConfidenceComponents(BaseModel):
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
    total: float
    total_label: str
    components: ConfidenceComponents


class FillersSummary(BaseModel):
    count: int
    ratio: int | float


class AnalysisResult(BaseModel):
    task_id: str
    video_path: str
    transcript: List[TranscriptSegment]
    tempo: List[TempoPoint]
    long_pauses: List[PauseInterval]
    fillers_summary: FillersSummary
    dynamic_fillers: List[str]
    slide_analysis: SlideAnalysis
    confidence_index: ConfidenceIndex
    summary: str
    structure: str
    mistakes: str
    ideal_text: str
    persona_feedback: str
    analyze_provider: str
    analyze_model: str
    transcribe_model: str


class TaskStatusResponse(BaseModel):
    task_id: str
    state: TaskState
    hint: str
    progress: float = 0.0
    stage: Optional[TaskStage] = None
    error: Optional[str] = None


class UploadResponse(BaseModel):
    """
    Модель данных, которые возращает /process
    """

    task_id: str
