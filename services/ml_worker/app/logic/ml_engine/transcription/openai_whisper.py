"""OpenAI Whisper transcription provider."""

import logging
from typing import List

import openai
from charisma_schemas import TranscriptSegment, TranscriptWord

from app.config import settings
from app.logic.ml_engine.constants import BASE_FILLER_WORDS

logger = logging.getLogger(__name__)


def transcribe_openai_whisper(
    audio_path: str,
) -> List[TranscriptSegment]:
    """Transcribe audio using OpenAI Whisper API.

    Args:
        audio_path (str): Path to the audio file.

    Returns:
        List[TranscriptSegment]: List of transcribed segments
            with timestamps and words.
    """
    # FIXME: Added list of words
    # timestamp_granularities=["segment", "words"]
    # Maybe, doesn't work, can't test.
    logger.info("Using OpenAI Whisper API...")
    client = openai.OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base,
    )

    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model=settings.whisper_model_name,
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["word", "segment"],
        )
    segments: list[TranscriptSegment] = []
    for seg in transcript.segments:
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
