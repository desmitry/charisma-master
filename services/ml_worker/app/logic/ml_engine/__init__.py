"""MLEngine facade — composes audio/video/tempo/scoring/transcription modules.

Backward compat: `from app.logic.ml_engine import MLEngine` works identically
to the pre-refactor monolithic ml_engine.py. All public staticmethods and
classmethods that tasks.py uses are preserved with the same signatures.
"""

import logging
import os
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
    convert_to_sber_format as _convert_to_sber_format,
)
from app.logic.ml_engine.audio import (
    extract_audio as _extract_audio,
)
from app.logic.ml_engine.audio import (
    get_empty_audio_metrics as _get_empty_audio_metrics,
)
from app.logic.ml_engine.constants import (
    BASE_FILLER_WORDS as _BASE_FILLER_WORDS,
)
from app.logic.ml_engine.constants import (
    MOVEMENT_THRESHOLD as _MOVEMENT_THRESHOLD,
)
from app.logic.ml_engine.constants import (
    TARGET_FRAME_WIDTH as _TARGET_FRAME_WIDTH,
)
from app.logic.ml_engine.constants import (
    VISUAL_DEVIATION as _VISUAL_DEVIATION,
)
from app.logic.ml_engine.scoring import get_score_label as _get_score_label
from app.logic.ml_engine.tempo import (
    calculate_tempo as _calculate_tempo,
)
from app.logic.ml_engine.tempo import (
    get_long_pauses as _get_long_pauses,
)
from app.logic.ml_engine.transcription import (
    load_whisper_model as _load_whisper_model,
)
from app.logic.ml_engine.transcription import (
    transcribe_local_whisper as _transcribe_local_whisper,
)
from app.logic.ml_engine.transcription import (
    transcribe_openai_whisper as _transcribe_openai_whisper,
)
from app.logic.ml_engine.transcription import (
    transcribe_sber as _transcribe_sber,
)
from app.logic.ml_engine.video import (
    analyze_video as _analyze_video,
)
from app.logic.ml_engine.video import (
    get_empty_video_metrics as _get_empty_video_metrics,
)

logger = logging.getLogger(__name__)


class _MLEngineMeta(type):
    """Metaclass for MLEngine that exposes _whisper_local_model as a
    read-through property backed by the live module-level cache in
    transcription.local_whisper.

    This keeps backward compat for code that reads
    `MLEngine._whisper_local_model` while avoiding duplicate state drift.
    """

    @property
    def _whisper_local_model(cls) -> Optional[WhisperModel]:
        # Lazy import to avoid any chance of circular imports during
        # facade module load.
        from app.logic.ml_engine.transcription import local_whisper

        return local_whisper._whisper_local_model


class MLEngine(metaclass=_MLEngineMeta):
    """ML engine for speech and video analysis.
    Provides transcription, audio analysis, and video metrics extraction.

    Backward-compatible facade over audio/video/tempo/scoring/transcription
    modules. Delegates to module-level functions; the public API preserves
    the pre-refactor staticmethod/classmethod signatures exactly.

    Raises:
        RuntimeError: If Sber authentication fails.
        RuntimeError: If Sber audio upload fails.
        RuntimeError: If Sber task creation fails.
        RuntimeError: If Sber task fails during processing.
        TimeoutError: If Sber transcription times out.

    Returns:
        dict: Analysis results containing audio/video metrics.
    """

    VISUAL_DEVIATION = _VISUAL_DEVIATION
    TARGET_FRAME_WIDTH = _TARGET_FRAME_WIDTH
    MOVEMENT_THRESHOLD = _MOVEMENT_THRESHOLD
    BASE_FILLER_WORDS = _BASE_FILLER_WORDS

    @classmethod
    def load_model(
        cls,
        model_name: Optional[str] = None,
    ) -> Optional[WhisperModel]:
        """Load the Whisper model for local transcription.

        Args:
            model_name (Optional[str], optional):
                Provider name to determine which model to load.
                Defaults to None.

        Returns:
            WhisperModel: Loaded Whisper model instance, or None if
                not applicable.
        """
        return _load_whisper_model(model_name)

    @staticmethod
    def extract_audio(video_path: str, output_path: str):
        """Extract audio track from a video file using FFmpeg.

        Args:
            video_path (str): Path to the input video file.
            output_path (str): Path to save the extracted audio file.
        """
        _extract_audio(video_path, output_path)

    @staticmethod
    def _convert_to_sber_format(input_path: str) -> str:
        """Convert audio file to Sber API format (16kHz, mono, PCM).

        Args:
            input_path (str): Path to the input audio file.

        Returns:
            str: Path to the converted audio file.
        """
        return _convert_to_sber_format(input_path)

    # TODO: Refactor this function.
    @staticmethod
    def transcribe(
        audio_path: str,
        provider: TranscribeProvider,
    ) -> List[TranscriptSegment]:
        """Transcribe audio using the specified provider.

        Args:
            audio_path (str): Path to the audio file.
            provider (TranscribeProvider): Transcription provider to use.

        Returns:
            List[TranscriptSegment]: List of transcribed segments
                with timestamps and words.
        """
        if provider == TranscribeProvider.sber_gigachat:
            logger.info("Using Sber SaluteSpeech API...")

            sber_audio_path = _convert_to_sber_format(audio_path)
            try:
                return _transcribe_sber(sber_audio_path)
            finally:
                if os.path.exists(sber_audio_path):
                    os.remove(sber_audio_path)

        elif provider == TranscribeProvider.whisper_openai:
            return _transcribe_openai_whisper(audio_path)

        elif provider == TranscribeProvider.whisper_local:
            return _transcribe_local_whisper(audio_path)

        return []

    @staticmethod
    def get_long_pauses(
        transcript: List[TranscriptSegment],
        threshold: float = 2.0,
    ) -> List[PauseInterval]:
        """Detect long pauses between transcript segments.

        Args:
            transcript (List[TranscriptSegment]):
                List of transcribed segments to analyze.
            threshold (float, optional):
                Minimum pause duration in seconds to be considered long.
                Defaults to 2.0.

        Returns:
            List[PauseInterval]: List of detected pause intervals.
        """
        return _get_long_pauses(transcript, threshold)

    @staticmethod
    def calculate_tempo(
        transcript: List[TranscriptSegment],
        window_sec=5.0,
    ) -> List[TempoPoint]:
        """Calculate speech tempo (words per minute) over time.

        Args:
            transcript (List[TranscriptSegment]):
                List of transcribed segments to analyze.
            window_sec (float, optional):
                Time window in seconds for tempo calculation.
                Defaults to 5.0.

        Returns:
            List[TempoPoint]: List of tempo points with time, WPM, and zone.
        """
        return _calculate_tempo(transcript, window_sec)

    @staticmethod
    def get_score_label(score: float) -> str:
        """Convert a numeric score to a human-readable label.

        Args:
            score (float): Numeric score value (0-100).

        Returns:
            str: Russian label describing the score level.
        """
        return _get_score_label(score)

    @staticmethod
    def analyze_audio(audio_path: str) -> Dict:
        """Analyze audio file for volume and tone metrics.

        Args:
            audio_path (str): Path to the audio file to analyze.

        Returns:
            Dict: Dictionary containing volume and tone scores and labels.
        """
        return _analyze_audio(audio_path)

    @staticmethod
    def analyze_video(
        video_path: str,
    ) -> Dict:
        """Analyze video file for gaze and gesture metrics.

        Args:
            video_path (str): Path to the video file to analyze.

        Returns:
            Dict: Dictionary containing gaze and gesture scores,
                labels, and advice.
        """
        return _analyze_video(video_path)

    @staticmethod
    def get_empty_video_metrics() -> dict:
        """Return an empty video metrics dictionary with default values.

        Returns:
            dict: Dictionary with default values for gaze and gesture metrics.
        """
        return _get_empty_video_metrics()

    @staticmethod
    def get_empty_audio_metrics() -> dict:
        """Return an empty audio metrics dictionary with default values.

        Returns:
            dict: Dictionary with default values for volume and tone metrics.
        """
        return _get_empty_audio_metrics()


__all__ = ["MLEngine"]
