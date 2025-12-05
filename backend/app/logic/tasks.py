import asyncio
import json
import logging
from pathlib import Path

from celery import shared_task  # current_task

from app.config import settings
from app.logic.llm_client import LLMClient
from app.logic.ml_engine import MLEngine
from app.models.schemas import ProcessingStage

logger = logging.getLogger(__name__)


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
def process_video_pipeline(self, task_id: str, video_path: str, persona: str = None):
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

        self.update_state(
            state="PROCESSING",
            meta={"stage": ProcessingStage.gestures, "progress": 0.4},
        )

        vision = MLEngine.analyze_video_features(video_path)
        audio = MLEngine.analyze_audio_features(audio_path)

        self.update_state(
            state="PROCESSING",
            meta={"stage": ProcessingStage.analyzing, "progress": 0.7},
        )

        tempo_data = MLEngine.calculate_tempo(transcript_segments)

        llm_client = LLMClient()
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        analysis = loop.run_until_complete(llm_client.analyze_speech(full_text, persona))
        loop.close()

        total_words = len(words) if words else 1
        filler_ratio = filler_count / total_words

        conf_gaze = vision["gaze_score"]
        conf_filler = max(0, 100 - (filler_ratio * 1000))
        conf_volume = audio["volume_score"]

        conf = (conf_gaze * 0.3) + (conf_filler * 0.4) + (conf_volume * 0.3)

        result_data = {
            "task_id": task_id,
            "video_path": video_path,
            "transcript": transcript_segments,
            "tempo": tempo_data,
            "fillers_summary": {
                "count": filler_count,
                "ratio": round(filler_ratio, 4),
            },
            "confidence_index": {
                "total": round(conf, 1),
                "components": {
                    "volume_score": round(conf_volume, 1),
                    "filler_score": round(conf_filler, 1),
                    "gaze_score": round(conf_gaze, 1),
                },
            },
            "summary": analysis.get("summary", ""),
            "structure": analysis.get("structure", ""),
            "mistakes": analysis.get("mistakes", ""),
            "ideal_text": analysis.get("ideal_text", ""),
            "persona_feedback": analysis.get("persona_feedback", ""),
            "slide_text_density": vision.get("slide_density", 0),
        }

        save_json_result(task_id, result_data)

        return {"status": "completed", "task_id": task_id}

    except Exception as e:
        logger.error(f"Task failed: {e}")
        self.update_state(state="FAILURE", meta={"error": str(e)})
        raise e
