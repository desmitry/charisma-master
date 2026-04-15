"""Local Whisper transcription via faster_whisper."""

import logging
from typing import List, Optional

from charisma_schemas import (
    TranscribeProvider,
    TranscriptSegment,
    TranscriptWord,
)
from faster_whisper import WhisperModel

from app.config import settings
from app.logic.ml_engine.constants import BASE_FILLER_WORDS

logger = logging.getLogger(__name__)

# Module-level cached model (preserves the original lazy-load pattern)
_whisper_local_model: Optional[WhisperModel] = None


def load_whisper_model(
    model_name: Optional[str] = None,
) -> Optional[WhisperModel]:
    """Load the Whisper model for local transcription.

    Args:
        model_name (Optional[str], optional):
            Provider name to determine which model to load.
            Defaults to None.

    Returns:
        WhisperModel: Loaded Whisper model instance, or None if
            not applicable.
    """
    global _whisper_local_model
    if model_name == TranscribeProvider.whisper_local:
        if _whisper_local_model is None:
            logger.info(
                "Load local Whisper model (%s)...",
                settings.whisper_compute_type,
            )

            _whisper_local_model = WhisperModel(
                settings.whisper_model_type,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )

        return _whisper_local_model

    return None


def transcribe_local_whisper(
    audio_path: str,
) -> List[TranscriptSegment]:
    """Transcribe audio using the cached local Whisper model.

    Args:
        audio_path (str): Path to the audio file.

    Returns:
        List[TranscriptSegment]: List of transcribed segments
            with timestamps and words.
    """
    logger.info("Using Whisper local...")

    model = load_whisper_model(TranscribeProvider.whisper_local)

    segments_gen, _ = model.transcribe(
        audio_path, language="ru", word_timestamps=True
    )
    segments = []
    for seg in segments_gen:
        words = []
        if seg.words:
            for w in seg.words:
                clean = (
                    w.word.strip()
                    .lower()
                    .replace(",", "")
                    .replace(".", "")
                )
                is_filler = clean in BASE_FILLER_WORDS
                words.append(
                    TranscriptWord(
                        start=w.start,
                        end=w.end,
                        text=w.word,
                        is_filler=is_filler,
                    )
                )
        segments.append(
            TranscriptSegment(
                start=seg.start,
                end=seg.end,
                text=seg.text,
                words=words,
            )
        )
    return segments
