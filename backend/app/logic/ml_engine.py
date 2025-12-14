import logging
import subprocess
from typing import Dict, List

import cv2
import librosa
import mediapipe as mp
import numpy as np
import easyocr
import openai
from app.config import settings
from app.models.schemas import TranscriptSegment, TranscriptWord, PauseInterval

logger = logging.getLogger(__name__)


class MLEngine:
    _whisper_model = None
    _ocr_reader = None

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
        if settings.whisper_provider == "local" and cls._whisper_model is None:
            logger.info(f"Загрузка local Whisper ({settings.whisper_compute_type})...")
            from faster_whisper import WhisperModel
            cls._whisper_model = WhisperModel(
                settings.whisper_model_path,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )

        if cls._ocr_reader is None:
            logger.info("Загрузка EasyOCR...")
            cls._ocr_reader = easyocr.Reader(['ru', 'en'], gpu=settings.whisper_device == "cuda")

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
        try:
            subprocess.run(  # noqa: S603
                command,
                capture_output=True,
                text=True,
                check=True,
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg error: {e.stderr}")
            raise

    @staticmethod
    def transcribe(audio_path: str) -> List[TranscriptSegment]:
        segments_data = []

        if settings.whisper_provider == "openai":
            logger.info("Используем OpenAI Whisper API...")
            client = openai.OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_api_base)

            with open(audio_path, "rb") as audio_file:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["word", "segment"]
                )

            for seg in transcript.segments:
                segments_data.append(TranscriptSegment(
                    start=seg['start'],
                    end=seg['end'],
                    text=seg['text'],
                    words=[]
                ))

        else:
            model = MLEngine.load_model()
            segments_gen, _ = model.transcribe(audio_path, language="ru", word_timestamps=True)

            for seg in segments_gen:
                words = []
                if seg.words:
                    for w in seg.words:
                        clean = w.word.strip().lower().replace(",", "").replace(".", "")
                        is_filler = clean in MLEngine.BASE_FILLER_WORDS
                        words.append(TranscriptWord(
                            start=w.start, end=w.end, text=w.word, is_filler=is_filler
                        ))
                segments_data.append(TranscriptSegment(
                    start=seg.start, end=seg.end, text=seg.text, words=words
                ))

        return segments_data

    @staticmethod
    def get_long_pauses(transcript: List[TranscriptSegment], threshold: float = 2.0) -> List[PauseInterval]:

        pauses = []
        for i in range(1, len(transcript)):
            prev_end = transcript[i - 1].end
            curr_start = transcript[i].start
            diff = curr_start - prev_end

            if diff >= threshold:
                pauses.append(PauseInterval(
                    start=prev_end,
                    end=curr_start,
                    duration=round(diff, 2)
                ))
        return pauses

    @staticmethod
    def calculate_tempo(transcript: List[TranscriptSegment], window_sec=5.0) -> List[dict]:
        words = []
        for seg in transcript:
            if not seg.words:
                seg_words_list = seg.text.split()
                duration = seg.end - seg.start
                word_duration = duration / len(seg_words_list) if seg_words_list else 0
                for idx, w_text in enumerate(seg_words_list):
                    w_start = seg.start + (idx * word_duration)
                    words.append(TranscriptWord(start=w_start, end=w_start + word_duration, text=w_text))
            else:
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
    def analyze_audio_features(audio_path: str) -> Dict:
        try:
            y, sr = librosa.load(audio_path, sr=None)
            rms = librosa.feature.rms(y=y)[0]

            mean_rms = np.mean(rms)

            if mean_rms < 0.015:
                vol_level = "Quiet"
            elif mean_rms > 0.08:
                vol_level = "Loud"
            else:
                vol_level = "Normal"

            f0, _, _ = librosa.pyin(y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"), sr=sr)
            valid_f0 = f0[~np.isnan(f0)]
            pitch_std = np.std(valid_f0) if len(valid_f0) > 0 else 0
            tone_score = min((pitch_std / 40) * 100, 100)

            return {
                "volume_level": vol_level,
                "volume_score": float(mean_rms),  # Для дебага
                "tone_score": float(tone_score)
            }
        except Exception as e:
            logger.error(f"Audio analysis failed: {e}")
            return {"volume_level": "Unknown", "volume_score": 0.0, "tone_score": 0.0}

    @staticmethod
    def analyze_slides_and_video(video_path: str) -> Dict:
        mp_holistic = mp.solutions.holistic
        reader = MLEngine._ocr_reader
        if reader is None:
            reader = easyocr.Reader(['ru', 'en'], gpu=settings.whisper_device == "cuda")

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps: fps = 25

        total_frames = 0
        looking_at_camera = 0
        movement_accum = 0.0
        prev_wrist_y = {"left": None, "right": None}

        slide_text_accum = []
        frame_interval_ocr = int(fps * 5)

        with mp_holistic.Holistic(min_detection_confidence=0.5, model_complexity=1) as holistic:
            while True:
                ret, frame = cap.read()
                if not ret: break

                total_frames += 1

                if total_frames % frame_interval_ocr == 0:
                    try:
                        height, width = frame.shape[:2]
                        scale = 1000 / width
                        if scale < 1:
                            ocr_frame = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
                        else:
                            ocr_frame = frame

                        result = reader.readtext(frame, detail=0)
                        text_on_screen = " ".join(result)
                        if len(text_on_screen) > 15:
                            slide_text_accum.append(text_on_screen)
                    except Exception as e:
                        logger.warning(f"OCR fail on frame {total_frames}: {e}")

                if total_frames % 5 != 0: continue

                try:
                    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = holistic.process(image)

                    if results.face_landmarks:
                        face = results.face_landmarks.landmark
                        nose = face[1].x
                        cheeks_mid = (face[234].x + face[454].x) / 2
                        if abs(nose - cheeks_mid) < 0.06:
                            looking_at_camera += 1

                    # Gestures
                    if results.pose_landmarks:
                        pose = results.pose_landmarks.landmark
                        lw = pose[mp_holistic.PoseLandmark.LEFT_WRIST].y
                        rw = pose[mp_holistic.PoseLandmark.RIGHT_WRIST].y

                        if prev_wrist_y["left"]:
                            delta = abs(lw - prev_wrist_y["left"]) + abs(rw - prev_wrist_y["right"])
                            if delta > 0.01: movement_accum += delta
                        prev_wrist_y = {"left": lw, "right": rw}
                except Exception as e:
                    pass

        cap.release()

        proc_frames = total_frames / 5 if total_frames > 0 else 1
        gaze_score = (looking_at_camera / proc_frames) * 100
        avg_movement = movement_accum / proc_frames

        gesture_score = min(avg_movement * 1000, 100)
        gesture_advice = "Отличная жестикуляция!"
        if gesture_score < 20:
            gesture_advice = "Добавьте больше движений руками, вы стоите неподвижно."
        elif gesture_score > 85:
            gesture_advice = "Слишком активная жестикуляция, попробуйте быть спокойнее."

        unique_text = list(set(slide_text_accum))
        full_slide_text = " ".join(unique_text)
        text_density = min(len(full_slide_text) / (len(unique_text) * 100 + 1) * 100, 100)

        return {
            "gaze_score": gaze_score,
            "gesture_score": gesture_score,
            "gesture_advice": gesture_advice,
            "ocr_text": full_slide_text[:2000],
            "slide_density": text_density,
            "has_slides": len(full_slide_text) > 100
        }
