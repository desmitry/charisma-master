"""Sber SaluteSpeech transcription provider."""

import logging
import os
import subprocess
import time
import uuid
from typing import List

import requests
import urllib3
from charisma_schemas import TranscriptSegment, TranscriptWord

from app.config import settings
from app.logic.ml_engine.constants import BASE_FILLER_WORDS

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


class SberTranscriber:
    """Transcriber using Sber SaluteSpeech API."""

    @staticmethod
    def _convert_to_sber_format(input_path: str) -> str:
        """Convert audio file to Sber API format (16kHz, mono, PCM).

        Args:
            input_path (str): Path to the input audio file.

        Returns:
            str: Path to the converted audio file.
        """
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

        # README:
        # The 'command' variable cannot contain an embedded injection.
        # The input data consists of a string containing the UUID.
        # The `command` variable must not contain strings that are
        # vulnerable to injection.
        subprocess.run(command, capture_output=True, check=True)  # noqa: S603
        return temp_path

    def transcribe(self, audio_path: str) -> List[TranscriptSegment]:
        """Transcribe audio using Sber SaluteSpeech API.

        Args:
            audio_path (str): Path to the audio file.

        Returns:
            List[TranscriptSegment]: List of transcribed segments.
        """
        logger.info("Using Sber SaluteSpeech API...")

        sber_audio_path = self._convert_to_sber_format(audio_path)
        try:
            return self._transcribe_async(sber_audio_path)
        finally:
            if os.path.exists(sber_audio_path):
                os.remove(sber_audio_path)

    # TODO: Refactor this function.
    @staticmethod
    def _transcribe_async(  # noqa: C901
        audio_path: str,
    ) -> List[TranscriptSegment]:
        """Transcribe audio using Sber SaluteSpeech API asynchronously.

        Args:
            audio_path (str): Path to the audio file.

        Raises:
            RuntimeError: If Sber authentication fails.
            RuntimeError: If audio upload to Sber fails.
            RuntimeError: If transcription task creation fails.
            RuntimeError: If transcription task fails or is cancelled.
            TimeoutError: If transcription takes too long.

        Returns:
            List[TranscriptSegment]: List of transcribed segments
                with timestamps and words.
        """
        auth_url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"

        creds = settings.sber_salute_credentials.strip().strip("'").strip('"')
        if creds.lower().startswith("basic "):
            creds = creds[6:].strip()

        headers_auth = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": str(uuid.uuid4()),
            "Authorization": f"Basic {creds}",
        }

        # README: Sber SaluteSpeech API requires verify=False because
        # their certificate is not in the system CA bundle.
        # Timeout is omitted because transcription is a long-running
        # operation; the outer loop handles overall timeout.
        response = requests.post(  # noqa: S113
            auth_url,
            headers=headers_auth,
            data={"scope": settings.sber_speech_scope},
            verify=False,  # noqa: S501
        )
        if response.status_code != 200:
            raise RuntimeError(f"Sber Auth Error: {response.text}")

        access_token = response.json()["access_token"]
        auth_header = {"Authorization": f"Bearer {access_token}"}

        upload_url = "https://smartspeech.sber.ru/rest/v1/data:upload"

        headers_upload = auth_header.copy()

        with open(audio_path, "rb") as f:
            file_content = f.read()

        # Look at previous README tag.
        r_upload = requests.post(  # noqa: S113
            upload_url,
            headers=headers_upload,
            data=file_content,
            verify=False,  # noqa: S501
        )

        if r_upload.status_code != 200:
            raise RuntimeError(f"Sber Upload Error: {r_upload.text}")

        upload_resp = r_upload.json()

        if "result" in upload_resp:
            file_id = upload_resp["result"]["request_file_id"]
        else:
            file_id = upload_resp.get("request_file_id")

        logger.info(f"Sber: File uploaded, request_file_id={file_id}")

        task_url = "https://smartspeech.sber.ru/rest/v1/speech:async_recognize"

        headers_task = auth_header.copy()
        headers_task["Content-Type"] = "application/json"

        payload = {
            "options": {
                "model": "general",
                "audio_encoding": "PCM_S16LE",
                "sample_rate": 16000,
                "channels_count": 1,
            },
            "request_file_id": file_id,
        }

        logger.info(f"Sber Task Payload: {payload}")

        # Look at previous README tag.
        r_task = requests.post(  # noqa: S113
            task_url,
            headers=headers_task,
            json=payload,
            verify=False,  # noqa: S501
        )

        if r_task.status_code != 200:
            raise RuntimeError(f"Sber Task Creation Error: {r_task.text}")

        task_id = r_task.json()["result"]["id"]
        logger.info(f"Sber: Task started, id={task_id}")

        status_url = (
            f"https://smartspeech.sber.ru/rest/v1/task:get?id={task_id}"
        )
        response_file_id = None

        for _ in range(90):
            time.sleep(10)
            # Look at previous README tag.
            r_status = requests.get(  # noqa: S113
                status_url,
                headers=auth_header,
                verify=False,  # noqa: S501
            )

            if r_status.status_code != 200:
                continue

            st_data = r_status.json()["result"]
            st = st_data["status"]
            logger.info(f"Sber Task Status: {st}")

            if st == "DONE":
                response_file_id = st_data["response_file_id"]
                break
            elif st in ["ERROR", "CANCELED"]:
                raise RuntimeError(f"Sber task failed: {st}")
        else:
            raise TimeoutError("Sber transcription timed out")

        download_url = f"https://smartspeech.sber.ru/rest/v1/data:download?response_file_id={response_file_id}"

        # Look at previous README tag.
        r_res = requests.get(  # noqa: S113
            download_url,
            headers=auth_header,
            verify=False,  # noqa: S501
        )
        r_res.raise_for_status()
        data = r_res.json()

        segments = []
        words_objs = []

        def extract_words(obj):
            found = []
            if isinstance(obj, dict):
                if "word" in obj and "start" in obj and "end" in obj:
                    found.append(obj)
                elif (
                    "text" in obj
                    and "start" in obj
                    and "end" in obj
                    and "word" not in obj
                ):
                    found.append(obj)

                for v in obj.values():
                    found.extend(extract_words(v))
            elif isinstance(obj, list):
                for v in obj:
                    found.extend(extract_words(v))
            return found

        raw_words = extract_words(data)

        for item in raw_words:

            def to_float(val):
                if isinstance(val, str):
                    return float(val.replace("s", ""))
                return float(val)

            w_text = item.get("word") or item.get("text") or ""
            w_start = to_float(item.get("start", 0.0))
            w_end = to_float(item.get("end", 0.0))

            clean = w_text.strip().lower().replace(",", "").replace(".", "")
            is_filler = clean in BASE_FILLER_WORDS

            words_objs.append(
                TranscriptWord(
                    start=w_start, end=w_end, text=w_text, is_filler=is_filler
                )
            )

        if words_objs:
            words_objs.sort(key=lambda x: x.start)
            seg_start = words_objs[0].start
            current_seg_words = []

            for i, w in enumerate(words_objs):
                current_seg_words.append(w)
                is_last = i == len(words_objs) - 1

                pause = False
                if not is_last:
                    pause = (words_objs[i + 1].start - w.end) > 0.8

                too_long = len(current_seg_words) > 15 and (
                    w.text.endswith(".") or w.text.endswith(",")
                )

                if pause or is_last or too_long:
                    seg_text = " ".join([wd.text for wd in current_seg_words])
                    segments.append(
                        TranscriptSegment(
                            start=seg_start,
                            end=w.end,
                            text=seg_text,
                            words=current_seg_words,
                        )
                    )
                    if not is_last:
                        seg_start = words_objs[i + 1].start
                        current_seg_words = []

        logger.info(f"Sber: Parsed {len(segments)} segments")
        return segments
