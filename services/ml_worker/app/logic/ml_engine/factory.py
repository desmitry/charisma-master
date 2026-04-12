"""Factory for creating ML engine components."""

from charisma_schemas import TranscribeProvider

from app.logic.ml_engine.protocols import Transcriber
from app.logic.ml_engine.transcription.local_whisper import (
    LocalWhisperTranscriber,
)
from app.logic.ml_engine.transcription.openai_whisper import (
    OpenAIWhisperTranscriber,
)
from app.logic.ml_engine.transcription.sber import SberTranscriber


class MLEngineFactory:
    """Factory for creating ML engine components by provider name."""

    @staticmethod
    def create_transcriber(provider: TranscribeProvider) -> Transcriber:
        """Create a transcriber instance for the given provider.

        Args:
            provider (TranscribeProvider): The transcription provider.

        Returns:
            Transcriber: A transcriber instance matching the provider.

        Raises:
            ValueError: If the provider is not supported.
        """
        if provider == TranscribeProvider.sber_gigachat:
            return SberTranscriber()
        elif provider == TranscribeProvider.whisper_openai:
            return OpenAIWhisperTranscriber()
        elif provider == TranscribeProvider.whisper_local:
            return LocalWhisperTranscriber()
        raise ValueError(f"Unsupported transcribe provider: {provider}")
