"""Transcription subpackage: dispatch + re-exports."""

from typing import List

from charisma_schemas import TranscribeProvider, TranscriptSegment

from app.logic.ml_engine.transcription._extract import extract_audio
from app.logic.ml_engine.transcription._model import load_model
from app.logic.ml_engine.transcription.local_whisper import (
    LocalWhisperTranscriber,
)
from app.logic.ml_engine.transcription.openai_whisper import (
    OpenAIWhisperTranscriber,
)
from app.logic.ml_engine.transcription.sber import SberTranscriber

__all__ = [
    "extract_audio",
    "load_model",
    "transcribe",
    "SberTranscriber",
    "OpenAIWhisperTranscriber",
    "LocalWhisperTranscriber",
]


def transcribe(
    audio_path: str,
    provider: TranscribeProvider,
) -> List[TranscriptSegment]:
    """Transcribe audio using the specified provider.

    Args:
        audio_path (str): Path to the audio file.
        provider (TranscribeProvider): Transcription provider to use.

    Returns:
        List[TranscriptSegment]: List of transcribed segments
            with timestamps and words.
    """
    if provider == TranscribeProvider.sber_gigachat:
        return SberTranscriber().transcribe(audio_path)
    elif provider == TranscribeProvider.whisper_openai:
        return OpenAIWhisperTranscriber().transcribe(audio_path)
    elif provider == TranscribeProvider.whisper_local:
        return LocalWhisperTranscriber().transcribe(audio_path)
    return []
