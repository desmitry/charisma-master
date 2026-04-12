"""Shared helpers for transcription modules."""

from charisma_schemas import TranscriptWord

from app.logic.ml_engine.constants import BASE_FILLER_WORDS


def _is_filler(text: str) -> bool:
    """Check if a word is a filler word.

    Args:
        text (str): The word text to check.

    Returns:
        bool: True if the word is a filler word.
    """
    clean = text.strip().lower().replace(",", "").replace(".", "")
    return clean in BASE_FILLER_WORDS


def _build_word(start: float, end: float, text: str) -> TranscriptWord:
    """Build a TranscriptWord with filler detection.

    Args:
        start (float): Word start time.
        end (float): Word end time.
        text (str): Word text.

    Returns:
        TranscriptWord: Word object with is_filler flag set.
    """
    return TranscriptWord(
        start=start,
        end=end,
        text=text,
        is_filler=_is_filler(text),
    )
