"""MLEngine package — backwards-compatible facade.

All existing imports like ``from app.logic.ml_engine import MLEngine``
continue to work unchanged.
"""

from app.logic.ml_engine.audio import analyze_audio, get_empty_audio_metrics
from app.logic.ml_engine.scoring import get_score_label
from app.logic.ml_engine.tempo import calculate_tempo, get_long_pauses
from app.logic.ml_engine.transcription import extract_audio, load_model, transcribe
from app.logic.ml_engine.video import analyze_video, get_empty_video_metrics


class MLEngine:
    """Thin facade that delegates to focused sub-modules.

    Keeps the same static-method API so callers (``tasks.py``, tests, etc.)
    don't need any changes.
    """

    # Re-export constants for any code that reads them directly
    from app.logic.ml_engine.constants import (
        BASE_FILLER_WORDS,
        MOVEMENT_THRESHOLD,
        TARGET_FRAME_WIDTH,
        VISUAL_DEVIATION,
    )

    load_model = staticmethod(load_model)
    extract_audio = staticmethod(extract_audio)
    transcribe = staticmethod(transcribe)
    get_long_pauses = staticmethod(get_long_pauses)
    calculate_tempo = staticmethod(calculate_tempo)
    get_score_label = staticmethod(get_score_label)
    analyze_audio = staticmethod(analyze_audio)
    analyze_video = staticmethod(analyze_video)
    get_empty_video_metrics = staticmethod(get_empty_video_metrics)
    get_empty_audio_metrics = staticmethod(get_empty_audio_metrics)


__all__ = [
    "MLEngine",
    "analyze_audio",
    "analyze_video",
    "calculate_tempo",
    "extract_audio",
    "get_empty_audio_metrics",
    "get_empty_video_metrics",
    "get_long_pauses",
    "get_score_label",
    "load_model",
    "transcribe",
]
