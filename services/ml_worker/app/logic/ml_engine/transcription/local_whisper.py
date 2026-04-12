"""Local Whisper transcription provider."""

import logging
from typing import List

from charisma_schemas import TranscriptSegment

from app.logic.ml_engine.transcription._helpers import _build_word
from app.logic.ml_engine.transcription._model import load_model

logger = logging.getLogger(__name__)


class LocalWhisperTranscriber:
    """Transcriber using local Whisper model."""

    def transcribe(self, audio_path: str) -> List[TranscriptSegment]:
        """Transcribe audio using the local Whisper model.

        Args:
            audio_path (str): Path to the audio file.

        Returns:
            List[TranscriptSegment]: List of transcribed segments
                with timestamps and words.
        """
        logger.info("Using Whisper local...")

        from charisma_schemas import TranscribeProvider

        model = load_model(TranscribeProvider.whisper_local)

        segments_gen, _ = model.transcribe(
            audio_path, language="ru", word_timestamps=True
        )
        segments = []
        for seg in segments_gen:
            words = []
            if seg.words:
                for w in seg.words:
                    words.append(_build_word(w.start, w.end, w.word))
            segments.append(
                TranscriptSegment(
                    start=seg.start,
                    end=seg.end,
                    text=seg.text,
                    words=words,
                )
            )
        return segments
