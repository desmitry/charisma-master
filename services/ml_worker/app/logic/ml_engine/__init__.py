"""MLEngine facade -- backwards-compatible re-export of all public functions.

Usage remains unchanged::

    from app.logic.ml_engine import MLEngine

    MLEngine.transcribe(audio_path, provider)
    MLEngine.analyze_audio(audio_path)
    MLEngine.analyze_video(video_path)
    ...
"""

from typing import Dict, List, Optional

from charisma_schemas import (
    PauseInterval,
    TempoPoint,
    TranscribeProvider,
    TranscriptSegment,
)
from faster_whisper import WhisperModel

from app.logic.ml_engine.audio import (
    analyze_audio as _analyze_audio,
)
from app.logic.ml_engine.audio import (
    get_empty_audio_metrics as _get_empty_audio_metrics,
)
from app.logic.ml_engine.constants import BASE_FILLER_WORDS
from app.logic.ml_engine.factory import MLEngineFactory
from app.logic.ml_engine.scoring import get_score_label as _get_score_label
from app.logic.ml_engine.tempo import (
    calculate_tempo as _calculate_tempo,
)
from app.logic.ml_engine.tempo import (
    get_long_pauses as _get_long_pauses,
)
from app.logic.ml_engine.transcription import (
    extract_audio as _extract_audio,
)
from app.logic.ml_engine.transcription import (
    load_model as _load_model,
)
from app.logic.ml_engine.transcription import (
    transcribe as _transcribe,
)
from app.logic.ml_engine.video import (
    analyze_video as _analyze_video,
)
from app.logic.ml_engine.video import (
    get_empty_video_metrics as _get_empty_video_metrics,
)

__all__ = [
    "MLEngine",
    "MLEngineFactory",
]


class MLEngine:
    """ML engine for speech and video analysis.
    Provides transcription, audio analysis, and video metrics extraction.

    This is a backwards-compatible facade that delegates to the
    individual modules in the ml_engine package.

    Raises:
        RuntimeError: If Sber authentication fails.
        RuntimeError: If Sber audio upload fails.
        RuntimeError: If Sber task creation fails.
        RuntimeError: If Sber task fails during processing.
        TimeoutError: If Sber transcription times out.

    Returns:
        dict: Analysis results containing audio/video metrics.
    """

    BASE_FILLER_WORDS = BASE_FILLER_WORDS

    @classmethod
    def load_model(
        cls,
        model_name: Optional[str] = None,
    ) -> Optional[WhisperModel]:
        """Load the Whisper model for local transcription."""
        return _load_model(model_name)

    @staticmethod
    def extract_audio(video_path: str, output_path: str):
        """Extract audio track from a video file using FFmpeg."""
        return _extract_audio(video_path, output_path)

    @staticmethod
    def transcribe(
        audio_path: str,
        provider: TranscribeProvider,
    ) -> List[TranscriptSegment]:
        """Transcribe audio using the specified provider."""
        return _transcribe(audio_path, provider)

    @staticmethod
    def get_long_pauses(
        transcript: List[TranscriptSegment],
        threshold: float = 2.0,
    ) -> List[PauseInterval]:
        """Detect long pauses between transcript segments."""
        return _get_long_pauses(transcript, threshold)

    @staticmethod
    def calculate_tempo(
        transcript: List[TranscriptSegment],
        window_sec=5.0,
    ) -> List[TempoPoint]:
        """Calculate speech tempo (words per minute) over time."""
        return _calculate_tempo(transcript, window_sec)

    @staticmethod
    def get_score_label(score: float) -> str:
        """Convert a numeric score to a human-readable label."""
        return _get_score_label(score)

    @staticmethod
    def analyze_audio(audio_path: str) -> Dict:
        """Analyze audio file for volume and tone metrics."""
        return _analyze_audio(audio_path)

    @staticmethod
    def analyze_video(video_path: str) -> Dict:
        """Analyze video file for gaze and gesture metrics."""
        return _analyze_video(video_path)

    @staticmethod
    def get_empty_video_metrics() -> dict:
        """Return an empty video metrics dictionary with default values."""
        return _get_empty_video_metrics()

    @staticmethod
    def get_empty_audio_metrics() -> dict:
        """Return an empty audio metrics dictionary with default values."""
        return _get_empty_audio_metrics()
