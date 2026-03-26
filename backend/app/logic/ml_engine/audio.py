"""Audio analysis: volume (RMS) and tone (pitch variation)."""

import logging
from typing import Dict

import librosa
import numpy as np

from app.logic.ml_engine.constants import (
    VOLUME_LABELS,
    VOLUME_REFERENCE_RMS,
    VOLUME_THRESHOLDS,
    TONE_REFERENCE_STD,
)
from app.logic.ml_engine.scoring import get_score_label

logger = logging.getLogger(__name__)


def get_empty_audio_metrics() -> Dict:
    """Return a default audio metrics dict."""
    return {
        "volume_score": 0,
        "volume_level": "",
        "volume_label": "",
        "tone_score": 0,
        "tone_label": "",
    }


def analyze_audio(audio_path: str) -> Dict:
    """Analyse an audio file for volume and tonal variation.

    Args:
        audio_path: Path to a ``.wav`` file.

    Returns:
        Dict with ``volume_score``, ``volume_level``, ``volume_label``,
        ``tone_score``, ``tone_label``.
    """
    try:
        y, sr = librosa.load(audio_path, sr=None)

        # ── Volume (RMS) ────────────────────────────────────────
        rms = librosa.feature.rms(y=y)[0]
        mean_rms = float(np.mean(rms))

        if mean_rms < VOLUME_THRESHOLDS["very_quiet"]:
            vol_label = VOLUME_LABELS["very_quiet"]
        elif mean_rms < VOLUME_THRESHOLDS["quiet"]:
            vol_label = VOLUME_LABELS["quiet"]
        elif mean_rms > VOLUME_THRESHOLDS["loud"]:
            vol_label = VOLUME_LABELS["loud"]
        else:
            vol_label = VOLUME_LABELS["normal"]

        volume_score = min((mean_rms / VOLUME_REFERENCE_RMS) * 100, 100)

        # ── Tone (pitch std) ────────────────────────────────────
        f0, _, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=sr,
        )
        valid_f0 = f0[~np.isnan(f0)]
        pitch_std = float(np.std(valid_f0)) if len(valid_f0) > 0 else 0.0

        tone_score = min((pitch_std / TONE_REFERENCE_STD) * 100, 100)

        metrics = get_empty_audio_metrics()
        metrics["volume_score"] = float(volume_score)
        metrics["volume_level"] = vol_label
        metrics["volume_label"] = get_score_label(float(volume_score))
        metrics["tone_score"] = float(tone_score)
        metrics["tone_label"] = get_score_label(float(tone_score))
        return metrics

    except Exception as e:
        logger.error("Audio analysis failed: %s", e)
        return get_empty_audio_metrics()
