import logging
import subprocess
from typing import Dict, List

import cv2
import librosa
import mediapipe as mp
import numpy as np
from app.config import settings
from app.models.schemas import TranscriptSegment, TranscriptWord
from faster_whisper import WhisperModel

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
        "реально",
        "знаете",
        "так",
        "скажем",
    }

    @classmethod
    def load_model(cls):
        if cls._whisper_model is None:
            logger.info(
                f"Загрузка модели ({settings.whisper_compute_type}) на {settings.whisper_device}..."
            )
            cls._whisper_model = WhisperModel(
                settings.whisper_model_path,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )
            logger.info("Модель загружена")
        return cls._whisper_model

    @classmethod
    def get_whisper_model(cls):
        if cls._whisper_model is None:
            return cls.load_model()
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
        subprocess.run(  # noqa: S603
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )

    @staticmethod
    def transcribe(audio_path: str) -> List[TranscriptSegment]:
        model = MLEngine.get_whisper_model()
        segments_gen, _ = model.transcribe(audio_path, language="ru", word_timestamps=True)

        segments = []
        for seg in segments_gen:
            words = []
            if seg.words:
                for w in seg.words:
                    clean_word = w.word.strip().lower().replace(",", "").replace(".", "")
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
                TranscriptSegment(start=seg.start, end=seg.end, text=seg.text, words=words)
            )
        return segments

    @staticmethod
    def calculate_tempo(transcript: List[TranscriptSegment], window_sec=5.0) -> List[dict]:
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

            count = sum(1 for w in words if w.start >= t_start and w.end < t_end)
            wpm = (count / window_sec) * 60

            zone = "green"
            if wpm < 80 or wpm > 160:
                zone = "red"
            elif wpm > 140 or wpm < 100:
                zone = "yellow"

            points.append({"time": float(t), "wpm": float(round(wpm, 1)), "zone": zone})
        return points

    @staticmethod
    def analyze_audio_features(audio_path: str) -> Dict[str, float]:
        try:
            y, sr = librosa.load(audio_path, sr=None)

            rms = librosa.feature.rms(y=y)[0]
            mean_rms = np.mean(rms)

            volume_score = min(mean_rms * 1000, 100)

            f0, voiced_flag, voiced_probs = librosa.pyin(
                y,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"),
                sr=sr,
                frame_length=2048,
            )

            valid_f0 = f0[~np.isnan(f0)]
            if len(valid_f0) > 0:
                pitch_std = np.std(valid_f0)
                tone_score = min((pitch_std / 40) * 100, 100)
            else:
                tone_score = 0.0

            return {
                "volume_score": float(volume_score),
                "tone_score": float(tone_score),
                "pitch_std": float(pitch_std if len(valid_f0) > 0 else 0),
            }
        except Exception as e:
            logger.error(f"Audio analysis failed: {e}")
            return {"volume_score": 50.0, "tone_score": 50.0}

    @staticmethod
    def analyze_video_features(video_path: str) -> Dict[str, float]:  # noqa: C901
        mp_holistic = mp.solutions.holistic

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"gaze_score": 0.0, "gesture_score": 0.0, "slide_density": 0.0}

        total_frames = 0
        looking_at_camera_frames = 0

        prev_wrist_y = {"left": None, "right": None}
        movement_accum = 0.0

        with mp_holistic.Holistic(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            model_complexity=1,  # 0=Lite, 1=Full, 2=Heavy
        ) as holistic:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                total_frames += 1
                if total_frames % 5 != 0:
                    continue

                image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = holistic.process(image)

                if results.face_landmarks:
                    face = results.face_landmarks.landmark
                    nose_tip = face[1]
                    left_cheek = face[234]
                    right_cheek = face[454]

                    face_center_x = (left_cheek.x + right_cheek.x) / 2
                    diff = abs(nose_tip.x - face_center_x)

                    if diff < 0.06:
                        looking_at_camera_frames += 1

                if results.pose_landmarks:
                    pose = results.pose_landmarks.landmark
                    left_wrist = pose[mp_holistic.PoseLandmark.LEFT_WRIST]
                    right_wrist = pose[mp_holistic.PoseLandmark.RIGHT_WRIST]

                    current_left_y = left_wrist.y
                    current_right_y = right_wrist.y

                    if prev_wrist_y["left"] is not None:
                        delta = abs(current_left_y - prev_wrist_y["left"]) + abs(
                            current_right_y - prev_wrist_y["right"]
                        )

                        if delta > 0.01:
                            movement_accum += delta

                    prev_wrist_y["left"] = current_left_y
                    prev_wrist_y["right"] = current_right_y

        cap.release()

        processed_frames = total_frames / 5
        if processed_frames == 0:
            return {"gaze_score": 0.0, "gesture_score": 0.0}

        gaze_score = (looking_at_camera_frames / processed_frames) * 100

        avg_movement_per_frame = movement_accum / processed_frames
        gesture_score = min(avg_movement_per_frame * 1000, 100)
        return {
            "gaze_score": min(max(gaze_score, 0), 100),
            "gesture_score": min(max(gesture_score, 0), 100),
            "raw_movement": avg_movement_per_frame,
        }
