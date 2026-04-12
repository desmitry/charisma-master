"""Whisper model loading and caching."""

import logging
from typing import Optional

from charisma_schemas import TranscribeProvider
from faster_whisper import WhisperModel

from app.config import settings

logger = logging.getLogger(__name__)

_whisper_local_model: Optional[WhisperModel] = None


def load_model(
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
