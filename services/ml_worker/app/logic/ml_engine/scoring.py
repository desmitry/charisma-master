"""Score label and tempo zone helpers."""

from app.logic.ml_engine.constants import (
    SCORE_LABEL_DEFAULT,
    SCORE_LABELS,
    TEMPO_ZONE_RED_HIGH,
    TEMPO_ZONE_RED_LOW,
    TEMPO_ZONE_YELLOW_HIGH,
    TEMPO_ZONE_YELLOW_LOW,
)


def get_score_label(score: float) -> str:
    """Convert a numeric score to a human-readable label.

    Args:
        score (float): Numeric score value (0-100).

    Returns:
        str: Russian label describing the score level.
    """
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return SCORE_LABEL_DEFAULT


def get_tempo_zone(wpm: float) -> str:
    """Determine tempo zone colour from words-per-minute value.

    Args:
        wpm (float): Words per minute.

    Returns:
        str: Zone colour string ("green", "yellow", or "red").
    """
    if wpm < TEMPO_ZONE_RED_LOW or wpm > TEMPO_ZONE_RED_HIGH:
        return "red"
    if wpm > TEMPO_ZONE_YELLOW_HIGH or wpm < TEMPO_ZONE_YELLOW_LOW:
        return "yellow"
    return "green"
