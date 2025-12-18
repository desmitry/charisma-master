import asyncio
import json
import logging
from pathlib import Path

from app.config import settings
from app.logic.llm_client import LLMClient
from app.logic.ml_engine import MLEngine
from app.models.schemas import ProcessingStage
from celery import shared_task
from celery.signals import worker_process_init

logger = logging.getLogger(__name__)


@worker_process_init.connect
def init_worker(**kwargs):
    logger.info("Предварительная загрузка ML-моделей...")
    try:
        MLEngine.load_model()
    except Exception as e:
        logger.error(f"Загрузка не удалась: {e}")


def save_json_result(task_id: str, data: dict):
    file_path = settings.results_dir / f"{task_id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(
            data,
            f,
            ensure_ascii=False,
            default=lambda x: x.dict() if hasattr(x, "dict") else str(x),
        )


@shared_task(bind=True)
def process_video_pipeline(
    self,
    task_id: str,
    video_path: str,
    analyze_provider: str,
    analyze_model: str,
    transcribe_model: str,
    persona: str = None,
):
    transcription_provider = "local"
    if transcribe_model == "sber_gigachat":
        transcription_provider = "sber"
    elif transcribe_model == "whisper_openai":
        transcription_provider = "openai"
    elif transcribe_model == "whisper_local":
        transcription_provider = "local"

    logger.info(
        f"Таска {task_id}: Транскрибация с помощью {transcription_provider}, Анализ с помощью {analyze_provider}"
    )

    try:
        # Аудио и Транскрипция
        self.update_state(
            state="PROCESSING",
            meta={"stage": ProcessingStage.listening, "progress": 0.1},
        )
        audio_path = str(Path(video_path).with_suffix(".wav"))

        MLEngine.extract_audio(video_path, audio_path)
        transcript_segments = MLEngine.transcribe(audio_path, provider=transcription_provider)

        full_text = " ".join([s.text for s in transcript_segments])
        long_pauses = MLEngine.get_long_pauses(transcript_segments, threshold=2.0)

    except Exception as e:
        logger.critical(f"Ошибка при вырезании аудиодорожки: {e}")
        self.update_state(state="FAILURE", meta={"error": str(e)})
        raise e

    # Видео (Жесты + OCR)
    self.update_state(
        state="PROCESSING",
        meta={"stage": ProcessingStage.gestures, "progress": 0.4},
    )

    cv_metrics = {
        "gaze_score": 0,
        "gesture_score": 0,
        "ocr_text": "",
        "gesture_advice": "Нет данных",
        "gaze_label": "-",
        "gesture_label": "-",
        "slide_density": 0,
        "has_slides": False,
    }

    try:
        cv_metrics = MLEngine.analyze_slides_and_video(video_path)
    except Exception as e:
        logger.warning(f"CV analysis failed: {e}")

    # Аудио
    audio_metrics = {
        "volume_level": "Unknown",
        "tone_score": 0,
        "volume_score": 0,
        "tone_label": "-",
    }

    try:
        audio_metrics = MLEngine.analyze_audio_features(audio_path)
    except Exception as e:
        logger.warning(f"Audio features failed: {e}")

    # LLM
    self.update_state(
        state="PROCESSING",
        meta={"stage": ProcessingStage.analyzing, "progress": 0.7},
    )
    tempo_data = MLEngine.calculate_tempo(transcript_segments)
    llm_result = {}

    try:
        llm_client = LLMClient()

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        llm_result = loop.run_until_complete(
            llm_client.analyze_speech(
                full_text,
                cv_metrics.get("ocr_text", ""),
                analyze_provider,
                analyze_model,
                persona,
            )
        )
        loop.close()
    except Exception as e:
        logger.error(f"LLM упал: {e}")

    # Итоги и Расчет баллов
    total_words = len(full_text.split()) if full_text else 1

    base_filler_count = sum(1 for s in transcript_segments for w in s.words if w.is_filler)

    filler_ratio = base_filler_count / total_words if total_words > 0 else 0
    filler_score = max(0, 100 - (filler_ratio * 750))

    total_conf = (
        (filler_score * 0.35)
        + (audio_metrics.get("tone_score", 0) * 0.25)
        + (audio_metrics.get("volume_score", 0) * 0.20)
        + (cv_metrics.get("gaze_score", 0) * 0.10)
        + (cv_metrics.get("gesture_score", 0) * 0.10)
    )
    total_conf = min(total_conf, 100)

    def r(val):
        return int(round(val)) if isinstance(val, (int, float)) else 0

    final_gaze = r(cv_metrics.get("gaze_score", 0))
    final_gesture = r(cv_metrics.get("gesture_score", 0))
    final_tone = r(audio_metrics.get("tone_score", 0))
    final_volume = r(audio_metrics.get("volume_score", 0))
    final_filler = r(filler_score)
    final_total = r(total_conf)
    final_density = r(cv_metrics.get("slide_density", 0))

    result_data = {
        "task_id": task_id,
        "video_path": f"/media/{Path(video_path).name}",
        "transcript": transcript_segments,
        "tempo": tempo_data,
        "long_pauses": long_pauses,
        "fillers_summary": {
            "count": base_filler_count,
            "ratio": round(filler_ratio, 4),
        },
        "dynamic_fillers": llm_result.get("dynamic_fillers", []),
        "slide_analysis": {
            "has_slides": cv_metrics.get("has_slides", False),
            "text_density_score": final_density,
            "text_density_label": MLEngine.get_score_label(100 - final_density),
            "ocr_summary": llm_result.get("slides_feedback", ""),
        },
        "confidence_index": {
            "total": final_total,
            "total_label": MLEngine.get_score_label(final_total),
            "components": {
                # Громкость
                "volume_level": audio_metrics.get("volume_level", "Нормально"),
                "volume_score": final_volume,
                "volume_score_label": MLEngine.get_score_label(final_volume),
                # Чистота речи
                "filler_score": final_filler,
                "filler_label": MLEngine.get_score_label(final_filler),
                # Взгляд
                "gaze_score": final_gaze,
                "gaze_label": MLEngine.get_score_label(final_gaze),
                # Жесты
                "gesture_score": final_gesture,
                "gesture_label": MLEngine.get_score_label(final_gesture),
                "gesture_advice": cv_metrics.get("gesture_advice", "Норма"),
                # Тон
                "tone_score": final_tone,
                "tone_label": MLEngine.get_score_label(final_tone),
            },
        },
        "summary": llm_result.get("summary", "N/A"),
        "structure": llm_result.get("structure", "N/A"),
        "mistakes": llm_result.get("mistakes", "N/A"),
        "ideal_text": llm_result.get("ideal_text", "N/A"),
        "persona_feedback": llm_result.get("persona_feedback", "N/A"),
        "analyze_provider": analyze_provider,
        "analyze_model": analyze_model,
        "transcribe_model": transcribe_model,
    }

    save_json_result(task_id, result_data)
    return {"status": "completed", "task_id": task_id}
