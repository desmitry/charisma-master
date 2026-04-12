"""Audio analysis: volume and tone metrics."""

import logging
from typing import Dict

import librosa
import numpy as np

from app.logic.ml_engine.scoring import get_score_label

logger = logging.getLogger(__name__)


def get_empty_audio_metrics() -> dict:
    """Return an empty audio metrics dictionary with default values.

    Returns:
        dict: Dictionary with default values for volume and tone metrics.
    """
    return {
        "volume_score": 0,
        "volume_level": "",
        "volume_label": "",
        "tone_score": 0,
        "tone_label": "",
    }


def analyze_audio(audio_path: str) -> Dict:
    """Analyze audio file for volume and tone metrics.

    Args:
        audio_path (str): Path to the audio file to analyze.

    Returns:
        Dict: Dictionary containing volume and tone scores and labels.
    """
    try:
        y, sr = librosa.load(audio_path, sr=None)

        rms = librosa.feature.rms(y=y)[0]
        mean_rms = np.mean(rms)

        # TODO: Remove hardcode values from methods code.
        if mean_rms < 0.01:
            vol_label = "Очень тихо"
        elif mean_rms < 0.03:
            vol_label = "Тиховато"
        elif mean_rms > 0.15:
            vol_label = "Громко"
        else:
            vol_label = "Нормально"

        volume_score_val = min((mean_rms / 0.06) * 100, 100)

        f0, _, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=sr,
        )
        valid_f0 = f0[~np.isnan(f0)]
        pitch_std = np.std(valid_f0) if len(valid_f0) > 0 else 0

        tone_score_val = min((pitch_std / 35) * 100, 100)

        audio_metrics = get_empty_audio_metrics()

        audio_metrics["volume_score"] = float(volume_score_val)
        audio_metrics["volume_level"] = vol_label
        audio_metrics["volume_label"] = get_score_label(
            float(volume_score_val)
        )
        audio_metrics["tone_score"] = float(tone_score_val)
        audio_metrics["tone_label"] = get_score_label(float(tone_score_val))

        return audio_metrics
    except Exception as e:
        logger.error(f"Audio analysis failed: {e}")
        return get_empty_audio_metrics()
