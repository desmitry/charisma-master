"""Scoring helpers for confidence and metric labels."""
from app.logic.ml_engine.config import get_db_weights

def get_score_label(score: float) -> str:
    """Convert a numeric score to a human-readable label.

    Args:
        score (float): Numeric score value (0-100).

    Returns:
        str: Russian label describing the score level.
    """
    config = get_db_weights("ml_worker_scoring") or {}
    
    label_excellent = config.get("label_excellent", "Великолепно")
    label_great = config.get("label_great", "Отлично")
    label_good = config.get("label_good", "Хорошо")
    label_ok = config.get("label_ok", "Нормально")
    label_poor = config.get("label_poor", "Слабо")
    label_default = config.get("label_default", "Требует внимания")
    
    threshold_excellent = config.get("threshold_excellent", 90)
    threshold_great = config.get("threshold_great", 80)
    threshold_good = config.get("threshold_good", 70)
    threshold_ok = config.get("threshold_ok", 55)
    threshold_poor = config.get("threshold_poor", 40)
    
    if score >= threshold_excellent:
        return label_excellent
    if score >= threshold_great:
        return label_great
    if score >= threshold_good:
        return label_good
    if score >= threshold_ok:
        return label_ok
    if score >= threshold_poor:
        return label_poor
    return label_default
