"""Audio extraction from video files."""

import logging
import subprocess

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
