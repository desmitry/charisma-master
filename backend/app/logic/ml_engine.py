import difflib
import logging
import os
import subprocess
import time
import uuid
from typing import Dict, List

import cv2
import easyocr
import librosa
import mediapipe as mp
import numpy as np
import openai
import requests
import urllib3
from app.config import settings
from app.models.schemas import PauseInterval, TranscriptSegment, TranscriptWord

logger = logging.getLogger(__name__)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class MLEngine:
    _whisper_model = None
    _ocr_reader = None

    BASE_FILLER_WORDS = {
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
    def load_model(cls, model_type="whisper"):
        if model_type == "sber":
            return None

        if model_type == "whisper":
            if settings.whisper_provider == "local" and cls._whisper_model is None:
                logger.info(f"Загрузка local Whisper ({settings.whisper_compute_type})...")
                from faster_whisper import WhisperModel

                cls._whisper_model = WhisperModel(
                    settings.whisper_model_path,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                )
            return cls._whisper_model

        if cls._ocr_reader is None:
            logger.info("Загрузка EasyOCR...")
            cls._ocr_reader = easyocr.Reader(["ru", "en"], gpu=settings.whisper_device == "cuda")

        return None

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
            "44100",
            "-ac",
            "1",
            output_path,
        ]
        try:
            subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                encoding="utf-8",
                errors="ignore",
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg error: {e.stderr}")
            raise

    @staticmethod
    def _convert_to_sber_format(input_path: str) -> str:
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
        subprocess.run(command, capture_output=True, check=True)
        return temp_path

    @staticmethod
    def transcribe(audio_path: str, provider: str = "local") -> List[TranscriptSegment]:
        if provider == "sber":
            logger.info("Используем Sber SaluteSpeech API (Async)...")
            try:
                sber_audio_path = MLEngine._convert_to_sber_format(audio_path)
                try:
                    return MLEngine._transcribe_sber_api_async(sber_audio_path)
                finally:
                    if os.path.exists(sber_audio_path):
                        os.remove(sber_audio_path)
            except Exception as e:
                logger.error(f"Sber API ASR failed: {e}. Fallback to local Whisper.")
                return MLEngine.transcribe(audio_path, provider="local")

        elif provider == "openai":
            logger.info("Используем OpenAI Whisper API...")
            client = openai.OpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_api_base,
            )

            with open(audio_path, "rb") as audio_file:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                )

            segments = []
            for seg in transcript.segments:
                segments.append(
                    TranscriptSegment(start=seg.start, end=seg.end, text=seg.text, words=[])
                )
            return segments

        else:
            model = MLEngine.load_model("whisper")
            if model is None:
                from faster_whisper import WhisperModel

                model = WhisperModel(
                    settings.whisper_model_path,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                )
                MLEngine._whisper_model = model

            segments_gen, _ = model.transcribe(audio_path, language="ru", word_timestamps=True)
            segments = []
            for seg in segments_gen:
                words = []
                if seg.words:
                    for w in seg.words:
                        clean = w.word.strip().lower().replace(",", "").replace(".", "")
                        is_filler = clean in MLEngine.BASE_FILLER_WORDS
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
    def _transcribe_sber_api_async(audio_path: str) -> List[TranscriptSegment]:
        if not settings.gigachat_credentials:
            raise ValueError("GIGACHAT_CREDENTIALS not found in .env")

        auth_url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"

        creds = settings.gigachat_credentials.strip().strip("'").strip('"')
        if creds.lower().startswith("basic "):
            creds = creds[6:].strip()

        headers_auth = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": str(uuid.uuid4()),
            "Authorization": f"Basic {creds}",
        }

        response = requests.post(
            auth_url,
            headers=headers_auth,
            data={"scope": settings.sber_speech_scope},
            verify=False,
        )
        if response.status_code != 200:
            raise RuntimeError(f"Sber Auth Error: {response.text}")

        access_token = response.json()["access_token"]
        auth_header = {"Authorization": f"Bearer {access_token}"}

        upload_url = "https://smartspeech.sber.ru/rest/v1/data:upload"

        headers_upload = auth_header.copy()

        with open(audio_path, "rb") as f:
            file_content = f.read()

        r_upload = requests.post(
            upload_url, headers=headers_upload, data=file_content, verify=False
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

        r_task = requests.post(task_url, headers=headers_task, json=payload, verify=False)

        if r_task.status_code != 200:
            raise RuntimeError(f"Sber Task Creation Error: {r_task.text}")

        task_id = r_task.json()["result"]["id"]
        logger.info(f"Sber: Task started, id={task_id}")

        status_url = f"https://smartspeech.sber.ru/rest/v1/task:get?id={task_id}"
        response_file_id = None

        for _ in range(90):
            time.sleep(10)
            r_status = requests.get(status_url, headers=auth_header, verify=False)

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

        download_url = (
            f"https://smartspeech.sber.ru/rest/v1/data:download?response_file_id={response_file_id}"
        )
        r_res = requests.get(download_url, headers=auth_header, verify=False)
        r_res.raise_for_status()
        data = r_res.json()

        segments = []
        words_objs = []

        def extract_words(obj):
            found = []
            if isinstance(obj, dict):
                # Проверяем наличие ключей слова
                if "word" in obj and "start" in obj and "end" in obj:
                    found.append(obj)
                # Или просто text (иногда бывает)
                elif "text" in obj and "start" in obj and "end" in obj and "word" not in obj:
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
            is_filler = clean in MLEngine.BASE_FILLER_WORDS

            words_objs.append(
                TranscriptWord(start=w_start, end=w_end, text=w_text, is_filler=is_filler)
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

    @staticmethod
    def get_long_pauses(
        transcript: List[TranscriptSegment], threshold: float = 2.0
    ) -> List[PauseInterval]:
        pauses = []
        if not transcript:
            return pauses
        for i in range(1, len(transcript)):
            prev_end = transcript[i - 1].end
            curr_start = transcript[i].start
            diff = curr_start - prev_end
            if diff >= threshold:
                pauses.append(
                    PauseInterval(start=prev_end, end=curr_start, duration=round(diff, 2))
                )
        return pauses

    @staticmethod
    def calculate_tempo(transcript: List[TranscriptSegment], window_sec=5.0) -> List[dict]:
        words = []
        for seg in transcript:
            if seg.words:
                words.extend(seg.words)
            else:
                seg_words_list = seg.text.split()
                if not seg_words_list:
                    continue
                duration = seg.end - seg.start
                word_duration = duration / len(seg_words_list)
                for idx, w_text in enumerate(seg_words_list):
                    w_start = seg.start + (idx * word_duration)
                    words.append(
                        TranscriptWord(
                            start=w_start,
                            end=w_start + word_duration,
                            text=w_text,
                        )
                    )
        if not words:
            return []
        duration = words[-1].end
        points = []
        for t in np.arange(0, duration, 1.0):
            t_start, t_end = t, t + window_sec
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
    def get_score_label(score: float) -> str:
        if score >= 90:
            return "Великолепно"
        if score >= 80:
            return "Отлично"
        if score >= 70:
            return "Хорошо"
        if score >= 55:
            return "Нормально"
        if score >= 40:
            return "Слабо"
        return "Требует внимания"

    @staticmethod
    def analyze_audio_features(audio_path: str) -> Dict:
        try:
            y, sr = librosa.load(audio_path, sr=None)

            rms = librosa.feature.rms(y=y)[0]
            mean_rms = np.mean(rms)

            if mean_rms < 0.01:
                vol_label = "Очень тихо"
            elif mean_rms < 0.03:
                vol_label = "Тиховато"
            elif mean_rms > 0.15:
                vol_label = "Громко"
            else:
                vol_label = "Нормально"

            volume_score_val = min((mean_rms / 0.06) * 100, 100)

            f0, _, _ = librosa.pyin(
                y,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"),
                sr=sr,
            )
            valid_f0 = f0[~np.isnan(f0)]
            pitch_std = np.std(valid_f0) if len(valid_f0) > 0 else 0

            tone_score_val = min((pitch_std / 35) * 100, 100)
            return {
                "volume_level": vol_label,
                "volume_score": float(volume_score_val),
                "tone_score": float(tone_score_val),
            }
        except Exception as e:
            logger.error(f"Audio analysis failed: {e}")
            return {
                "volume_level": "Ошибка",
                "volume_score": 0.0,
                "tone_score": 0.0,
                "tone_label": "Нет данных",
            }

    @staticmethod
    def analyze_slides_and_video(video_path: str, do_slides: bool) -> Dict:
        logger.info(f"--- START DEBUG CV: {video_path} ---")

        # 1. ПРОВЕРКА ФАЙЛА
        if not os.path.exists(video_path):
            logger.critical(f"CRITICAL: File does not exist at path: {video_path}")
            return MLEngine._get_empty_cv_metrics()

        file_size = os.path.getsize(video_path)
        logger.info(f"File size: {file_size / (1024 * 1024):.2f} MB")

        # 2. ПРОВЕРКА OPENCV
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.critical("CRITICAL: OpenCV could not open the video. Check codecs/path.")
            return MLEngine._get_empty_cv_metrics()

        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        logger.info(f"Video Metadata: {width}x{height}, {fps} FPS, {frame_count} frames")

        reader = None
        if do_slides:
            # Инициализация OCR
            reader = MLEngine._ocr_reader
            if reader is None:
                logger.info("Initializing EasyOCR...")
                try:
                    reader = easyocr.Reader(["ru", "en"], gpu=settings.whisper_device == "cuda")
                except Exception as e:
                    logger.error(f"EasyOCR init failed: {e}")
                    # Продолжаем без OCR, чтобы хоть жесты посчитать

            mp_holistic = mp.solutions.holistic

        # Счетчики
        total_frames_processed = 0
        frames_with_face = 0
        frames_with_pose = 0
        looking_at_camera_frames = 0

        movement_accum = 0.0
        prev_wrist = {"left": None, "right": None}

        unique_slides_text = []
        last_slide_text = ""

        try:
            # ВАЖНО: static_image_mode=False для видео (быстрее и стабильнее трекинг)
            with mp_holistic.Holistic(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
                model_complexity=1,
                static_image_mode=False,
            ) as holistic:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        logger.info("End of video stream (ret=False).")
                        break

                    total_frames_processed += 1

                    # --- DEBUG: Проверяем первые 5 кадров ---
                    if total_frames_processed <= 5:
                        logger.info(f"Processing frame {total_frames_processed}...")

                    # Оптимизация: обрабатываем каждый 5-й кадр
                    if total_frames_processed % 5 != 0:
                        continue

                    # OCR (раз в 2 секунды)
                    if reader and total_frames_processed % int(fps * 2) == 0:
                        try:
                            # Для OCR берем кадр побольше, но не 4K
                            scale_ocr = 1.0
                            if width > 1280:
                                scale_ocr = 1280 / width

                            ocr_frame = cv2.resize(frame, (0, 0), fx=scale_ocr, fy=scale_ocr)
                            # detail=0 -> просто список строк
                            res_txt = reader.readtext(ocr_frame, detail=0)
                            txt_joined = " ".join(res_txt).strip()

                            if len(txt_joined) > 15:
                                # Проверка на дубликаты
                                sim = 0.0
                                if last_slide_text:
                                    sim = difflib.SequenceMatcher(
                                        None, last_slide_text, txt_joined
                                    ).ratio()

                                if sim < 0.8:
                                    unique_slides_text.append(txt_joined)
                                    last_slide_text = txt_joined
                        except Exception as e_ocr:
                            logger.warning(f"OCR step error: {e_ocr}")

                    # MediaPipe
                    try:
                        # Ресайз для скорости
                        target_w = 480
                        scale_mp = target_w / width
                        small_frame = cv2.resize(frame, (0, 0), fx=scale_mp, fy=scale_mp)

                        img_rgb = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
                        img_rgb.flags.writeable = False
                        results = holistic.process(img_rgb)
                        img_rgb.flags.writeable = True

                        # --- Логика Взгляда ---
                        if results.face_landmarks:
                            frames_with_face += 1
                            face = results.face_landmarks.landmark
                            nose_x = face[1].x
                            left_ear = face[234].x
                            right_ear = face[454].x  # Используем уши/скулы для ширины

                            face_width = abs(right_ear - left_ear)
                            face_center = (left_ear + right_ear) / 2

                            if face_width > 0:
                                deviation = abs(nose_x - face_center) / face_width
                                if deviation < 0.25:  # Чуть поднял порог
                                    looking_at_camera_frames += 1

                        # --- Логика Жестов ---
                        if results.pose_landmarks:
                            frames_with_pose += 1
                            pl = results.pose_landmarks.landmark

                            # Индексы: 15=Left Wrist, 16=Right Wrist
                            lw = (pl[15].x, pl[15].y)
                            rw = (pl[16].x, pl[16].y)

                            if prev_wrist["left"] is not None:
                                # Считаем евклидово расстояние
                                d_left = (
                                    (lw[0] - prev_wrist["left"][0]) ** 2
                                    + (lw[1] - prev_wrist["left"][1]) ** 2
                                ) ** 0.5
                                d_right = (
                                    (rw[0] - prev_wrist["right"][0]) ** 2
                                    + (rw[1] - prev_wrist["right"][1]) ** 2
                                ) ** 0.5

                                delta = d_left + d_right

                                # Фильтр шума
                                if delta > 0.002:
                                    movement_accum += delta

                            prev_wrist = {"left": lw, "right": rw}
                        else:
                            prev_wrist = {"left": None, "right": None}

                    except Exception as e_mp:
                        logger.error(
                            f"MediaPipe processing error at frame {total_frames_processed}: {e_mp}"
                        )

        except Exception as e_global:
            logger.critical(f"Global CV Loop crash: {e_global}")
        finally:
            cap.release()

        # --- ЛОГИРУЕМ ИТОГИ ПЕРЕД РАСЧЕТОМ ---
        logger.info("--- DEBUG STATS ---")
        logger.info(f"Total processed frames: {total_frames_processed}")
        logger.info(f"Frames with Face detected: {frames_with_face}")
        logger.info(f"Frames with Pose detected: {frames_with_pose}")
        logger.info(f"Accumulated Movement: {movement_accum}")
        logger.info(f"Unique Slides Count: {len(unique_slides_text)}")

        # --- РАСЧЕТ БАЛЛОВ ---

        # 1. Взгляд
        gaze_score = 0
        if frames_with_face > 10:
            gaze_score = (looking_at_camera_frames / frames_with_face) * 100

        # 2. Жесты
        gesture_score = 0
        gesture_advice = "Анализ не удался (мало данных)"

        if frames_with_pose > 10:
            avg_move = movement_accum / frames_with_pose
            gesture_score = min(avg_move * 3500, 100)

            if gesture_score < 15:
                gesture_advice = "Вы почти неподвижны (или мы не видим рук). Добавьте энергии!"
            elif gesture_score > 85:
                gesture_advice = "Очень много движений, попробуйте контролировать жесты."
            else:
                gesture_advice = "Отличная, естественная жестикуляция."

        # 3. Слайды
        full_text = " ".join(unique_slides_text)
        has_slides = len(unique_slides_text) > 0
        density_score = 100

        if has_slides:
            avg_len = len(full_text) / len(unique_slides_text)
            if avg_len > 600:
                density_score = max(0, 100 - (avg_len - 600) / 10)

        return {
            "gaze_score": int(gaze_score),
            "gesture_score": int(gesture_score),
            "gesture_advice": gesture_advice,
            "ocr_text": full_text,
            "slide_density": int(density_score),
            "has_slides": has_slides,
        }

    @staticmethod
    def _get_empty_cv_metrics():
        return {
            "gaze_score": 0,
            "gesture_score": 0,
            "gesture_advice": "Ошибка чтения видео",
            "ocr_text": "",
            "slide_density": 0,
            "has_slides": False,
        }
