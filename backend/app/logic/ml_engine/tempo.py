"""Speech tempo and pause analysis."""

from typing import List

import numpy as np

from app.logic.ml_engine.constants import DEFAULT_PAUSE_THRESHOLD, TEMPO_WINDOW_SEC
from app.logic.ml_engine.scoring import get_tempo_zone
from app.models.schemas import PauseInterval, TempoPoint, TranscriptSegment, TranscriptWord


def get_long_pauses(
    transcript: List[TranscriptSegment],
    threshold: float = DEFAULT_PAUSE_THRESHOLD,
) -> List[PauseInterval]:
    """Detect gaps between segments that exceed *threshold* seconds.

    Args:
        transcript: Ordered list of transcript segments.
        threshold: Minimum gap duration to report.

    Returns:
        List of ``PauseInterval``.
    """
    pauses: list[PauseInterval] = []
    for i in range(1, len(transcript)):
        prev_end = transcript[i - 1].end
        curr_start = transcript[i].start
        diff = curr_start - prev_end
        if diff >= threshold:
            pauses.append(PauseInterval(start=prev_end, end=curr_start, duration=round(diff, 2)))
    return pauses


def calculate_tempo(
    transcript: List[TranscriptSegment],
    window_sec: float = TEMPO_WINDOW_SEC,
) -> List[TempoPoint]:
    """Calculate words-per-minute over sliding time windows.

    Args:
        transcript: Ordered list of transcript segments.
        window_sec: Width of the sliding window in seconds.

    Returns:
        List of ``TempoPoint`` (one per second of audio).
    """
    words: list[TranscriptWord] = []
    for seg in transcript:
        if seg.words:
            words.extend(seg.words)
        else:
            seg_words_list = seg.text.split()
            if not seg_words_list:
                continue
            duration = seg.end - seg.start
            word_duration = duration / len(seg_words_list)
            for idx, w_text in enumerate(seg_words_list):
                w_start = seg.start + (idx * word_duration)
                words.append(
                    TranscriptWord(start=w_start, end=w_start + word_duration, text=w_text)
                )

    if not words:
        return []

    total_duration = words[-1].end
    points: list[TempoPoint] = []

    for t in np.arange(0, total_duration, 1.0):
        t_start, t_end = t, t + window_sec
        count = sum(1 for w in words if w.start >= t_start and w.end < t_end)
        wpm = (count / window_sec) * 60
        zone = get_tempo_zone(wpm)
        points.append(TempoPoint(time=float(t), wpm=float(round(wpm, 1)), zone=zone))

    return points
