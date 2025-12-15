import asyncio
import json
import logging
from pathlib import Path

from app.config import settings
from app.logic.llm_client import LLMClient
from app.logic.ml_engine import MLEngine
from app.models.schemas import PersonaEnum, ProcessingStage
from celery import shared_task  # current_task
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
    provider: str,
    model: str,
    persona: PersonaEnum | None,
):
    try:
        self.update_state(
            state="PROCESSING",
            meta={"stage": ProcessingStage.listening, "progress": 0.1},
        )
        audio_path = str(Path(video_path).with_suffix(".wav"))

        MLEngine.extract_audio(video_path, audio_path)
        transcript_segments = MLEngine.transcribe(audio_path)

        full_text = " ".join([s.text for s in transcript_segments])
        words = []
        filler_count = 0
        for s in transcript_segments:
            for w in s.words:
                words.append(w)
                if w.is_filler:
                    filler_count += 1
    except Exception as e:
        logger.critical(f"Ошибка при вырезании аудиодорожки: {e}")
        self.update_state(state="FAILURE", meta={"error": str(e)})
        raise e

    self.update_state(state="PROCESSING", meta={"stage": ProcessingStage.gestures, "progress": 0.4})

    vision_metrics = {"gaze_score": 0.0, "gesture_score": 0.0}
    audio_metrics = {"volume_score": 50.0, "tone_score": 0.0}

    try:
        vision_metrics = MLEngine.analyze_video_features(video_path)
        logger.info(f"CV метрика: {vision_metrics}")
    except Exception as e:
        logger.warning(f"CV сломался: {e}")

    try:
        audio_metrics = MLEngine.analyze_audio_features(audio_path)
        logger.info(f"Метрика звука: {audio_metrics}")
    except Exception as e:
        logger.warning(f"Звук сломался: {e}")

    self.update_state(
        state="PROCESSING", meta={"stage": ProcessingStage.analyzing, "progress": 0.7}
    )
    tempo_data = MLEngine.calculate_tempo(transcript_segments)

    context_for_llm = f"""
    Текст выступления: {full_text}

    Технические метрики:
    - Жестикуляция: {vision_metrics.get("gesture_score", 0):.1f}/100 
    (если < 20 - человек стоит столбом, если > 80 - машет руками)
    - Зрительный контакт: {vision_metrics.get("gaze_score", 0):.1f}/100
    - Живость голоса (тон): {audio_metrics.get("tone_score", 0):.1f}/100 (если < 30 - монотонно)
    """

    llm_result = {}
    try:
        llm_client = LLMClient()
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        llm_result = loop.run_until_complete(
            llm_client.analyze_speech(context_for_llm, provider, model, persona)
        )
        loop.close()
    except Exception as e:
        logger.error(f"LLM упал: {e}")

    total_words = len(words) if words else 1
    filler_ratio = filler_count / total_words

    conf_gaze = vision_metrics.get("gaze_score", 0)
    conf_gesture = vision_metrics.get("gesture_score", 0)
    conf_tone = audio_metrics.get("tone_score", 0)
    conf_volume = audio_metrics.get("volume_score", 50)
    conf_filler = max(0, 100 - (filler_ratio * 1000))

    # Формула уверенности (можно тюнить веса)
    # Gaze: 20%, Gesture: 15%, Tone: 25%, Filler: 25%, Volume: 15%
    total_conf = (
        (conf_gaze * 0.20)
        + (conf_gesture * 0.15)
        + (conf_tone * 0.25)
        + (conf_filler * 0.25)
        + (conf_volume * 0.15)
    )

    file_name = Path(video_path).name
    relative_path = f"/media/{file_name}"

    result_data = {
        "task_id": task_id,
        "video_path": relative_path,
        "transcript": transcript_segments,
        "tempo": tempo_data,
        "fillers_summary": {"count": filler_count, "ratio": round(filler_ratio, 4)},
        "confidence_index": {
            "total": round(total_conf, 1),
            "components": {
                "volume_score": round(conf_volume, 1),
                "filler_score": round(conf_filler, 1),
                "gaze_score": round(conf_gaze, 1),
                "gesture_score": round(conf_gesture, 1),
                "tone_score": round(conf_tone, 1),
            },
        },
        "summary": llm_result.get("summary", "N/A"),
        "structure": llm_result.get("structure", "N/A"),
        "mistakes": llm_result.get("mistakes", "N/A"),
        "ideal_text": llm_result.get("ideal_text", "N/A"),
        "persona_feedback": llm_result.get("persona_feedback", "N/A"),
        "raw_metrics": {**vision_metrics, **audio_metrics},
    }

    save_json_result(task_id, result_data)
    return {"status": "completed", "task_id": task_id}
