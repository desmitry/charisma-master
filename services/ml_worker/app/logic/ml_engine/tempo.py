"""Tempo and pause analysis for transcribed speech."""

from typing import List

import numpy as np
from charisma_schemas import (
    PauseInterval,
    TempoPoint,
    TranscriptSegment,
    TranscriptWord,
)
from app.logic.ml_engine.config import get_db_weights



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
    pauses = []
    if not transcript:
        return pauses
    config = get_db_weights("ml_worker_tempo") or {}
    actual_threshold = config.get("pause_threshold", threshold)

    for i in range(1, len(transcript)):
        prev_end = transcript[i - 1].end
        curr_start = transcript[i].start
        diff = curr_start - prev_end
        if diff >= actual_threshold:
            pauses.append(
                PauseInterval(
                    start=prev_end, end=curr_start, duration=round(diff, 2)
                )
            )
    return pauses


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
    words = []
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
                    TranscriptWord(
                        start=w_start,
                        end=w_start + word_duration,
                        text=w_text,
                    )
                )
    if not words:
        return []
    duration = words[-1].end
    points = []
    
    config = get_db_weights("ml_worker_tempo") or {}
    actual_window_sec = config.get("wpm_window_sec", window_sec)
    wpm_low_red = config.get("wpm_low_red", 80)
    wpm_high_red = config.get("wpm_high_red", 160)
    wpm_low_yellow = config.get("wpm_low_yellow", 100)
    wpm_high_yellow = config.get("wpm_high_yellow", 140)

    for t in np.arange(0, duration, 1.0):
        t_start, t_end = t, t + actual_window_sec
        count = sum(1 for w in words if w.start >= t_start and w.end < t_end)
        wpm = (count / actual_window_sec) * 60

        # TODO: Move zone values to TempoColorEnum.
        zone = "green"
        if wpm < wpm_low_red or wpm > wpm_high_red:
            zone = "red"
        elif wpm > wpm_high_yellow or wpm < wpm_low_yellow:
            zone = "yellow"
        points.append(
            TempoPoint(
                time=float(t),
                wpm=float(round(wpm, 1)),
                zone=zone,
            )
        )
    return points
