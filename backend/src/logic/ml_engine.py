import subprocess
import logging
import cv2
import numpy as np
import librosa
from faster_whisper import WhisperModel
from typing import List, Dict

from src.config import settings
from src.models.schemas import TranscriptSegment, TranscriptWord

logger = logging.getLogger(__name__)


class MLEngine:
    _whisper_model = None

    FILLER_WORDS = {
        "ну",
        "короче",
        "типа",
        "как",
        "бы",
        "э",
        "ээ",
        "эээ",
        "мм",
        "ммм",
        "вот",
        "значит",
        "собственно",
        "вообще",
        "походу",
    }

    @classmethod
    def get_whisper_model(cls):
        if cls._whisper_model is None:
            logger.info(f"Модель: {settings.whisper_model_path}")
            cls._whisper_model = WhisperModel(
                settings.whisper_model_path,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )
        return cls._whisper_model

    @staticmethod
    def extract_audio(video_path: str, output_path: str):
        command = [
            "ffmpeg",
            "-y",
            "-i",
            video_path,
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "16000",
            "-ac",
            "1",
            output_path,
        ]
        subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )

    @staticmethod
    def transcribe(audio_path: str) -> List[TranscriptSegment]:
        model = MLEngine.get_whisper_model()
        segments_gen, _ = model.transcribe(
            audio_path, language="ru", word_timestamps=True
        )

        segments = []
        for seg in segments_gen:
            words = []
            if seg.words:
                for w in seg.words:
                    clean_word = (
                        w.word.strip().lower().replace(",", "").replace(".", "")
                    )
                    is_filler = clean_word in MLEngine.FILLER_WORDS
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
                    start=seg.start, end=seg.end, text=seg.text, words=words
                )
            )
        return segments

    @staticmethod
    def calculate_tempo(
        transcript: List[TranscriptSegment], window_sec=5.0
    ) -> List[dict]:
        words = []
        for seg in transcript:
            words.extend(seg.words)

        if not words:
            return []

        duration = words[-1].end
        points = []

        for t in np.arange(0, duration, 1.0):
            t_start = t
            t_end = t + window_sec

            count = sum(
                1 for w in words if w.start >= t_start and w.end < t_end
            )
            wpm = (count / window_sec) * 60

            zone = "green"
            if wpm < 80:
                zone = "red"
            elif wpm > 160:
                zone = "red"
            elif wpm > 140 or wpm < 100:
                zone = "yellow"

            points.append(
                {"time": float(t), "wpm": float(round(wpm, 1)), "zone": zone}
            )

        return points

    @staticmethod
    def analyze_audio_features(audio_path: str) -> Dict[str, float]:
        try:
            y, sr = librosa.load(audio_path, sr=None)
            rms = librosa.feature.rms(y=y)[0]

            volume_std = np.std(rms)
            mean_volume = np.mean(rms)

            volume_score = min(mean_volume * 1000, 100)
            return {
                "volume_std": float(volume_std),
                "volume_score": float(volume_score),
            }
        except Exception as e:
            logger.error(f"Аудио завершилось с ошибкой: {e}")
            return {"volume_std": 0.0, "volume_score": 50.0}

    @staticmethod
    def analyze_video_features(video_path: str) -> Dict[str, float]:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"gaze_score": 0.0, "slide_density": 0.0}

        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_eye.xml"
        )

        total_frames = 0
        frames_with_eyes = 0
        frames_with_faces = 0
        slide_density_accum = 0.0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            total_frames += 1
            if total_frames % 10 != 0:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            if len(faces) > 0:
                frames_with_faces += 1
                for x, y, w, h in faces:
                    roi_gray = gray[y : y + h, x : x + w]
                    eyes = eye_cascade.detectMultiScale(roi_gray)
                    if len(eyes) >= 1:
                        frames_with_eyes += 1
                        break

            edges = cv2.Canny(gray, 100, 200)
            slide_density_accum += np.sum(edges) / (
                frame.shape[0] * frame.shape[1]
            )

        cap.release()

        gaze_score = 0.0
        if frames_with_faces > 0:
            gaze_score = (frames_with_eyes / frames_with_faces) * 100

        avg_density = 0.0
        if total_frames > 0:
            avg_density = (slide_density_accum / (total_frames / 10)) * 100

        return {
            "gaze_score": min(max(gaze_score, 0), 100),
            "slide_density": avg_density,
        }
