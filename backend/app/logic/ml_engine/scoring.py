"""Score-to-label conversion and tempo zone utilities."""

from app.logic.ml_engine.constants import SCORE_LABELS, TEMPO_ZONES


def get_score_label(score: float) -> str:
    """Convert a numeric score (0-100) to a human-readable Russian label.

    Args:
        score: Numeric score value (0-100).

    Returns:
        Russian label describing the score level.
    """
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return SCORE_LABELS[-1][1]


def get_tempo_zone(wpm: float) -> str:
    """Return the tempo colour zone for a given words-per-minute value.

    Args:
        wpm: Words per minute.

    Returns:
        One of 'green', 'yellow', 'red'.
    """
    for zone in TEMPO_ZONES:
        if zone["min_wpm"] <= wpm < zone["max_wpm"]:
            return zone["zone"]
    return "red"
