"""Audio analysis: ffmpeg extraction, librosa metrics, volume, pauses."""

import logging
import subprocess
from typing import Dict

import librosa
import numpy as np

from app.logic.ml_engine.config import get_db_weights
from app.logic.ml_engine.scoring import get_score_label

logger = logging.getLogger(__name__)


def extract_audio(video_path: str, output_path: str):
    """Extract audio track from a video file using FFmpeg.

    Args:
        video_path (str): Path to the input video file.
        output_path (str): Path to save the extracted audio file.
    """
    command = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "44100",
        "-ac",
        "1",
        output_path,
    ]
    try:
        # README:
        # The 'command' variable cannot contain an embedded injection.
        # The input data consists of a string containing the UUID.
        # The `command` variable must not contain strings that are
        # vulnerable to injection.
        subprocess.run(  # noqa: S603
            command,
            capture_output=True,
            text=True,
            check=True,
            encoding="utf-8",
            errors="ignore",
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg error: {e.stderr}")
        raise


def convert_to_sber_format(input_path: str) -> str:
    """Convert audio file to Sber API format (16kHz, mono, PCM).

    Args:
        input_path (str): Path to the input audio file.

    Returns:
        str: Path to the converted audio file.
    """
    temp_path = input_path.replace(".wav", "_sber_16k.wav")
    command = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        temp_path,
    ]

    # README:
    # The 'command' variable cannot contain an embedded injection.
    # The input data consists of a string containing the UUID.
    # The `command` variable must not contain strings that are
    # vulnerable to injection.
    subprocess.run(command, capture_output=True, check=True)  # noqa: S603
    return temp_path


def analyze_audio(audio_path: str) -> Dict:
    """Analyze audio file for volume and tone metrics.

    Args:
        audio_path (str): Path to the audio file to analyze.

    Returns:
        Dict: Dictionary containing volume and tone scores and labels.
    """
    try:
        y, sr = librosa.load(audio_path, sr=None)

        mean_rms = float(np.mean(librosa.feature.rms(y=y)[0]))
        audio_config = get_db_weights("ml_worker_audio") or {}
        rms_very_quiet = audio_config.get("rms_very_quiet", 0.01)
        rms_quiet = audio_config.get("rms_quiet", 0.03)
        rms_loud = audio_config.get("rms_loud", 0.15)

        vol_label_very_quiet = audio_config.get(
            "vol_label_very_quiet", "Очень тихо"
        )
        vol_label_quiet = audio_config.get("vol_label_quiet", "Тиховато")
        vol_label_loud = audio_config.get("vol_label_loud", "Громко")
        vol_label_normal = audio_config.get("vol_label_normal", "Нормально")

        volume_score_divisor = audio_config.get("volume_score_divisor", 0.06)
        tone_score_divisor = audio_config.get("tone_score_divisor", 35.0)

        # TODO: Remove hardcode values from methods code.
        if mean_rms < rms_very_quiet:
            vol_label = vol_label_very_quiet
        elif mean_rms < rms_quiet:
            vol_label = vol_label_quiet
        elif mean_rms > rms_loud:
            vol_label = vol_label_loud
        else:
            vol_label = vol_label_normal

        volume_score_val = min((mean_rms / volume_score_divisor) * 100, 100)

        f0, _, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=sr,
        )
        valid_f0 = f0[~np.isnan(f0)]
        pitch_std = np.std(valid_f0) if len(valid_f0) > 0 else 0

        tone_score_val = min((pitch_std / tone_score_divisor) * 100, 100)

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
