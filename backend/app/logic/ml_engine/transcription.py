"""Transcription providers: Sber SaluteSpeech, OpenAI Whisper, local Whisper."""

import logging
import os
import subprocess
import time
import uuid
from typing import List, Optional

import openai
import requests
import urllib3
from faster_whisper import WhisperModel

from app.config import settings
from app.logic.ml_engine.constants import (
    BASE_FILLER_WORDS,
    SBER_POLL_INTERVAL,
    SBER_POLL_MAX_RETRIES,
    SBER_SEGMENT_MAX_WORDS,
    SBER_SEGMENT_PAUSE_THRESHOLD,
)
from app.models.schemas import TranscribeProvider, TranscriptSegment, TranscriptWord

logger = logging.getLogger(__name__)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

_whisper_local_model: Optional[WhisperModel] = None


# ── Helpers ─────────────────────────────────────────────────────────


def _is_filler(word: str) -> bool:
    """Check if a word is a filler after basic normalisation."""
    return word.strip().lower().replace(",", "").replace(".", "") in BASE_FILLER_WORDS


def _build_word(start: float, end: float, text: str) -> TranscriptWord:
    return TranscriptWord(start=start, end=end, text=text, is_filler=_is_filler(text))


# ── Model loading ───────────────────────────────────────────────────


def load_model(model_name: Optional[str] = None) -> Optional[WhisperModel]:
    """Load (or return cached) local Whisper model.

    Args:
        model_name: Provider name. Only loads if ``TranscribeProvider.whisper_local``.

    Returns:
        Loaded ``WhisperModel`` or ``None``.
    """
    global _whisper_local_model

    if model_name == TranscribeProvider.whisper_local:
        if _whisper_local_model is None:
            logger.info("Load local Whisper model (%s)...", settings.whisper_compute_type)
            _whisper_local_model = WhisperModel(
                settings.whisper_model_type,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )
        return _whisper_local_model

    return None


# ── Audio extraction / conversion ───────────────────────────────────


def extract_audio(video_path: str, output_path: str) -> None:
    """Extract mono PCM audio from a video file using FFmpeg.

    Args:
        video_path: Path to the input video file.
        output_path: Path to save the extracted ``.wav``.
    """
    command = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "44100",
        "-ac",
        "1",
        output_path,
    ]
    try:
        # README:
        # The 'command' variable cannot contain an embedded injection.
        # The input data consists of a string containing the UUID.
        subprocess.run(  # noqa: S603
            command,
            capture_output=True,
            text=True,
            check=True,
            encoding="utf-8",
            errors="ignore",
        )
    except subprocess.CalledProcessError as e:
        logger.error("FFmpeg error: %s", e.stderr)
        raise


def _convert_to_sber_format(input_path: str) -> str:
    """Convert audio to Sber-compatible format (16 kHz, mono, PCM)."""
    temp_path = input_path.replace(".wav", "_sber_16k.wav")
    command = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        temp_path,
    ]
    subprocess.run(command, capture_output=True, check=True)  # noqa: S603
    return temp_path


# ── Provider dispatching ────────────────────────────────────────────


def transcribe(audio_path: str, provider: TranscribeProvider) -> List[TranscriptSegment]:
    """Transcribe audio using the specified provider.

    Args:
        audio_path: Path to a ``.wav`` file.
        provider: Which transcription backend to use.

    Returns:
        List of ``TranscriptSegment`` with word-level timestamps.
    """
    if provider == TranscribeProvider.sber_gigachat:
        logger.info("Using Sber SaluteSpeech API...")
        sber_audio_path = _convert_to_sber_format(audio_path)
        try:
            return _transcribe_sber(sber_audio_path)
        finally:
            if os.path.exists(sber_audio_path):
                os.remove(sber_audio_path)

    if provider == TranscribeProvider.whisper_openai:
        logger.info("Using OpenAI Whisper API...")
        return _transcribe_openai(audio_path)

    if provider == TranscribeProvider.whisper_local:
        logger.info("Using Whisper local...")
        return _transcribe_local(audio_path)

    return []


# ── OpenAI Whisper ──────────────────────────────────────────────────


def _transcribe_openai(audio_path: str) -> List[TranscriptSegment]:
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
        words = [_build_word(w.start, w.end, w.word) for w in (seg.words or [])]
        segments.append(TranscriptSegment(start=seg.start, end=seg.end, text=seg.text, words=words))
    return segments


# ── Local Whisper ───────────────────────────────────────────────────


def _transcribe_local(audio_path: str) -> List[TranscriptSegment]:
    model = load_model(TranscribeProvider.whisper_local)
    segments_gen, _ = model.transcribe(audio_path, language="ru", word_timestamps=True)

    segments: list[TranscriptSegment] = []
    for seg in segments_gen:
        words = [_build_word(w.start, w.end, w.word) for w in (seg.words or [])]
        segments.append(TranscriptSegment(start=seg.start, end=seg.end, text=seg.text, words=words))
    return segments


# ── Sber SaluteSpeech ───────────────────────────────────────────────


def _sber_authenticate() -> str:
    """Obtain Sber SaluteSpeech access token."""
    auth_url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    creds = settings.sber_salute_credentials.strip().strip("'").strip('"')
    if creds.lower().startswith("basic "):
        creds = creds[6:].strip()

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "RqUID": str(uuid.uuid4()),
        "Authorization": f"Basic {creds}",
    }
    response = requests.post(
        auth_url,
        headers=headers,
        data={"scope": settings.sber_speech_scope},
        verify=False,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Sber Auth Error: {response.text}")
    return response.json()["access_token"]


def _sber_upload_audio(audio_path: str, token: str) -> str:
    """Upload audio file to Sber and return file ID."""
    url = "https://smartspeech.sber.ru/rest/v1/data:upload"
    with open(audio_path, "rb") as f:
        file_content = f.read()

    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        data=file_content,
        verify=False,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Sber Upload Error: {resp.text}")

    data = resp.json()
    if "result" in data:
        return data["result"]["request_file_id"]
    return data.get("request_file_id")


def _sber_create_task(file_id: str, token: str) -> str:
    """Create async recognition task and return its ID."""
    url = "https://smartspeech.sber.ru/rest/v1/speech:async_recognize"
    payload = {
        "options": {
            "model": "general",
            "audio_encoding": "PCM_S16LE",
            "sample_rate": 16000,
            "channels_count": 1,
        },
        "request_file_id": file_id,
    }
    logger.info("Sber Task Payload: %s", payload)

    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=payload,
        verify=False,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Sber Task Creation Error: {resp.text}")
    return resp.json()["result"]["id"]


def _sber_poll_task(task_id: str, token: str) -> str:
    """Poll task until DONE, return ``response_file_id``."""
    status_url = f"https://smartspeech.sber.ru/rest/v1/task:get?id={task_id}"
    auth_header = {"Authorization": f"Bearer {token}"}

    for _ in range(SBER_POLL_MAX_RETRIES):
        time.sleep(SBER_POLL_INTERVAL)
        resp = requests.get(status_url, headers=auth_header, verify=False)
        if resp.status_code != 200:
            continue

        result = resp.json()["result"]
        status = result["status"]
        logger.info("Sber Task Status: %s", status)

        if status == "DONE":
            return result["response_file_id"]
        if status in ("ERROR", "CANCELED"):
            raise RuntimeError(f"Sber task failed: {status}")

    raise TimeoutError("Sber transcription timed out")


def _sber_download_result(response_file_id: str, token: str) -> dict:
    """Download recognition result JSON."""
    url = f"https://smartspeech.sber.ru/rest/v1/data:download?response_file_id={response_file_id}"
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        verify=False,
    )
    resp.raise_for_status()
    return resp.json()


def _sber_parse_words(data: dict) -> List[TranscriptWord]:
    """Recursively extract word objects from Sber response."""

    def _extract(obj) -> list[dict]:
        found = []
        if isinstance(obj, dict):
            if "word" in obj and "start" in obj and "end" in obj:
                found.append(obj)
            elif "text" in obj and "start" in obj and "end" in obj and "word" not in obj:
                found.append(obj)
            for v in obj.values():
                found.extend(_extract(v))
        elif isinstance(obj, list):
            for v in obj:
                found.extend(_extract(v))
        return found

    def _to_float(val) -> float:
        if isinstance(val, str):
            return float(val.replace("s", ""))
        return float(val)

    raw_words = _extract(data)
    words = []
    for item in raw_words:
        text = item.get("word") or item.get("text") or ""
        start = _to_float(item.get("start", 0.0))
        end = _to_float(item.get("end", 0.0))
        words.append(_build_word(start, end, text))

    words.sort(key=lambda w: w.start)
    return words


def _sber_group_into_segments(words: List[TranscriptWord]) -> List[TranscriptSegment]:
    """Group flat word list into segments based on pauses and length."""
    if not words:
        return []

    segments: list[TranscriptSegment] = []
    seg_start = words[0].start
    current: list[TranscriptWord] = []

    for i, w in enumerate(words):
        current.append(w)
        is_last = i == len(words) - 1

        pause = (
            not is_last and (words[i + 1].start - w.end) > SBER_SEGMENT_PAUSE_THRESHOLD
        )
        too_long = len(current) > SBER_SEGMENT_MAX_WORDS and (
            w.text.endswith(".") or w.text.endswith(",")
        )

        if pause or is_last or too_long:
            text = " ".join(wd.text for wd in current)
            segments.append(
                TranscriptSegment(start=seg_start, end=w.end, text=text, words=current)
            )
            if not is_last:
                seg_start = words[i + 1].start
                current = []

    logger.info("Sber: Parsed %d segments", len(segments))
    return segments


def _transcribe_sber(audio_path: str) -> List[TranscriptSegment]:
    """Full Sber transcription pipeline: auth → upload → task → poll → parse."""
    token = _sber_authenticate()
    file_id = _sber_upload_audio(audio_path, token)
    logger.info("Sber: File uploaded, request_file_id=%s", file_id)

    task_id = _sber_create_task(file_id, token)
    logger.info("Sber: Task started, id=%s", task_id)

    response_file_id = _sber_poll_task(task_id, token)
    data = _sber_download_result(response_file_id, token)

    words = _sber_parse_words(data)
    return _sber_group_into_segments(words)
