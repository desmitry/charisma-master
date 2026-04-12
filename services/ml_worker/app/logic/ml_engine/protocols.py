"""Protocol interfaces for ML engine components."""

from typing import Dict, List, Protocol

from charisma_schemas import TranscriptSegment


class Transcriber(Protocol):
    """Protocol for transcription providers."""

    def transcribe(self, audio_path: str) -> List[TranscriptSegment]: ...


class AudioAnalyzer(Protocol):
    """Protocol for audio analysis."""

    def analyze(self, audio_path: str) -> Dict: ...


class VideoAnalyzer(Protocol):
    """Protocol for video analysis."""

    def analyze(self, video_path: str) -> Dict: ...
