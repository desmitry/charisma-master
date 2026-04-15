"""Scoring helpers for confidence and metric labels."""


def get_score_label(score: float) -> str:
    """Convert a numeric score to a human-readable label.

    Args:
        score (float): Numeric score value (0-100).

    Returns:
        str: Russian label describing the score level.
    """
    # TODO: Remove hardcode values from methods code.
    if score >= 90:
        return "Великолепно"
    if score >= 80:
        return "Отлично"
    if score >= 70:
        return "Хорошо"
    if score >= 55:
        return "Нормально"
    if score >= 40:
        return "Слабо"
    return "Требует внимания"
