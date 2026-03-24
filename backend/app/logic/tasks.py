import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Optional

from celery import shared_task
from celery.signals import worker_process_init

from app.config import settings
from app.logic.llm_client import LLMClient
from app.logic.ml_engine import MLEngine
from app.models.schemas import (
    AnalysisResult,
    AnalyzeProvider,
    ConfidenceComponents,
    ConfidenceIndex,
    FillersSummary,
    PersonaRoles,
    SlideAnalysis,
    TaskStage,
    TaskState,
    TranscribeProvider,
)

logger = logging.getLogger(__name__)


@worker_process_init.connect
def init_worker(**kwargs):
    logger.info("Preloading ML models...")
    try:
        # TODO: Preload all local models
        MLEngine.load_model()
    except Exception as e:
        logger.error(f"Failed to load: {e}")


@shared_task(bind=True)
def process_video_pipeline(
    self,
    task_id: str,
    speech_video_path: str,
    evaluation_criteria_path: str,
    presentation_path: Optional[str],
    analyze_provider: AnalyzeProvider,
    transcribe_provider: TranscribeProvider,
    persona: PersonaRoles,
):
    logger.debug(f"Task {task_id}: {transcribe_provider.value=}, {analyze_provider.value=}")

    try:
        self.update_state(
            state=TaskState.processing.value,
            meta=TaskStage.transcription.meta,
        )

        audio_path = str(Path(speech_video_path).with_suffix(".wav"))
        MLEngine.extract_audio(speech_video_path, audio_path)

        transcript_segments = MLEngine.transcribe(audio_path, provider=transcribe_provider)
        tempo_data = MLEngine.calculate_tempo(transcript_segments)

        full_text = " ".join([s.text for s in transcript_segments])
        long_pauses = MLEngine.get_long_pauses(transcript_segments, threshold=2.0)

    except subprocess.CalledProcessError as e:
        error_msg = f"FFmpeg error: {str(e)}"
        logger.critical(error_msg)
        raise RuntimeError(error_msg)

    except Exception as e:
        logger.critical(f"Global pipeline error: {e}")
        raise RuntimeError(f"Processing failed: {str(e)}")

    self.update_state(
        state=TaskState.processing.value,
        meta=TaskStage.video_analisis.meta,
    )

    video_metrics = MLEngine.get_empty_video_metrics()

    try:
        video_metrics = MLEngine.analyze_video(speech_video_path)
    except Exception as e:
        logger.warning(f"Video analysis failed: {e}")

    self.update_state(
        state=TaskState.processing.value,
        meta=TaskStage.audio_analisis.meta,
    )
    audio_metrics = MLEngine.get_empty_audio_metrics()

    try:
        audio_metrics = MLEngine.analyze_audio(audio_path)
    except Exception as e:
        logger.warning(f"Audio features failed: {e}")

    self.update_state(
        state=TaskState.processing.value,
        meta=TaskStage.llm_personal_report.meta,
    )

    # TODO: Realize presentation text parser.
    presentation_text = ""

    llm_personal_report = {}

    try:
        llm_client = LLMClient()

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        llm_personal_report = loop.run_until_complete(
            llm_client.analyze_speech(
                transcript_text=full_text,
                presentation_text=presentation_text,
                provider=analyze_provider,
                persona=persona,
            )
        )
        loop.close()
    except Exception as e:
        logger.error(f"LLM Client error: {e}")

    # TODO: Realize criteria analisis for LLMClient.

    # TODO: Document and verify these coefficients.
    total_words = len(full_text.split()) if full_text else 1

    base_filler_count = sum(1 for s in transcript_segments for w in s.words if w.is_filler)

    filler_ratio = base_filler_count / total_words if total_words > 0 else 0
    filler_score = max(0, 100 - (filler_ratio * 750))

    # TODO: Document and verify these coefficients.
    total_conf = (
        (filler_score * 0.35)
        + (audio_metrics["tone_score"] * 0.25)
        + (audio_metrics["volume_score"] * 0.20)
        + (video_metrics["gaze_score"] * 0.10)
        + (video_metrics["gesture_score"] * 0.10)
    )
    total_conf = min(total_conf, 100)
    total_conf = round(total_conf)
    total_conf_label = MLEngine.get_score_label(total_conf)

    result_data = AnalysisResult(
        task_id=task_id,
        video_path=f"/media/{Path(speech_video_path).name}",
        transcript=transcript_segments,
        tempo=tempo_data,
        long_pauses=long_pauses,
        fillers_summary=FillersSummary(count=base_filler_count, ratio=round(filler_ratio, 4)),
        dynamic_fillers=llm_personal_report.get("dynamic_fillers", []),
        slide_analysis=SlideAnalysis(
            presentation_summary=llm_personal_report.get("presentation_feedback", "")
        ),
        confidence_index=ConfidenceIndex(
            total=total_conf,
            total_label=total_conf_label,
            components=ConfidenceComponents(
                volume_level=audio_metrics["volume_level"],
                volume_score=round(audio_metrics["volume_score"]),
                volume_label=audio_metrics["volume_label"],
                filler_score=round(filler_score),
                filler_label=MLEngine.get_score_label(filler_score),
                gaze_score=round(video_metrics["gaze_score"]),
                gaze_label=video_metrics["gaze_label"],
                gesture_score=round(video_metrics["gesture_score"]),
                gesture_label=video_metrics["gesture_label"],
                gesture_advice=video_metrics["gesture_advice"],
                tone_score=round(audio_metrics["tone_score"]),
                tone_label=audio_metrics["tone_label"],
            ),
        ),
        summary=llm_personal_report.get("summary", "Нет данных"),
        structure=llm_personal_report.get("structure", "Нет данных"),
        mistakes=llm_personal_report.get("mistakes", "Нет данных"),
        ideal_text=llm_personal_report.get("ideal_text", "Нет данных"),
        persona_feedback=llm_personal_report.get("persona_feedback", "Нет данных"),
        analyze_provider=analyze_provider.value,
        analyze_model=analyze_provider.model_name,
        transcribe_model=transcribe_provider.value,
    )

    with open(settings.results_dir / f"{task_id}.json", "w", encoding="utf-8") as file:
        file.write(result_data.model_dump_json(ensure_ascii=False))

    return {"status": "completed", "task_id": task_id}
