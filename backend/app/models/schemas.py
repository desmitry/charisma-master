from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class PersonaEnum(str, Enum):
    strict_critic = "strict_critic"
    kind_mentor = "kind_mentor"
    steve_jobs_style = "steve_jobs_style"


class ProcessingState(str, Enum):
    queued = "queued"
    processing = "processing"
    finished = "finished"
    failed = "failed"


class ProcessingStage(str, Enum):
    listening = "listening"
    gestures = "gestures"
    analyzing = "analyzing"


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


class ConfidenceComponents(BaseModel):
    volume_score: float
    filler_score: float
    gaze_score: float
    gesture_score: float
    tone_score: float


class ConfidenceIndex(BaseModel):
    total: float
    components: ConfidenceComponents


class AnalysisResult(BaseModel):
    task_id: str
    video_path: str
    transcript: List[TranscriptSegment]
    tempo: List[TempoPoint]
    fillers_summary: dict
    confidence_index: ConfidenceIndex
    summary: str
    structure: str
    mistakes: str
    ideal_text: str
    persona_feedback: Optional[str] = None
    slide_text_density: float = 0.0
    raw_metrics: Optional[dict] = None


class TaskStatusResponse(BaseModel):
    state: ProcessingState
    stage: Optional[ProcessingStage] = None
    progress: float = 0.0
    error: Optional[str] = None
    task_id: str


class UploadResponse(BaseModel):
    task_id: str
    status: str = "queued"
