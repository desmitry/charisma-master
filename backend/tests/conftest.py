import pytest
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient

from app.models.schemas import (
    AnalysisResult,
    ConfidenceComponents,
    ConfidenceIndex,
    EvaluationCriteriaReport,
    FillersSummary,
    SpeechReport,
    TranscriptSegment,
    TranscriptWord,
)


@pytest.fixture
def async_client():
    from app.main import app

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def sample_transcript_segments():
    return [
        TranscriptSegment(
            start=0.0,
            end=2.5,
            text="Привет это тестовое выступление",
            words=[
                TranscriptWord(start=0.0, end=0.5, text="Привет", is_filler=False),
                TranscriptWord(start=0.5, end=0.8, text="это", is_filler=False),
                TranscriptWord(start=0.8, end=1.3, text="тестовое", is_filler=False),
                TranscriptWord(start=1.3, end=2.5, text="выступление", is_filler=False),
            ],
        ),
        TranscriptSegment(
            start=3.0,
            end=5.0,
            text="ну вот значит основная часть",
            words=[
                TranscriptWord(start=3.0, end=3.2, text="ну", is_filler=True),
                TranscriptWord(start=3.2, end=3.5, text="вот", is_filler=True),
                TranscriptWord(start=3.5, end=3.9, text="значит", is_filler=True),
                TranscriptWord(start=3.9, end=4.3, text="основная", is_filler=False),
                TranscriptWord(start=4.3, end=5.0, text="часть", is_filler=False),
            ],
        ),
    ]


@pytest.fixture
def sample_analysis_result():
    return AnalysisResult(
        task_id="test-task-id",
        video_path="/media/test-task-id.mp4",
        transcript=[],
        tempo=[],
        long_pauses=[],
        fillers_summary=FillersSummary(count=3, ratio=0.05),
        confidence_index=ConfidenceIndex(
            total=72,
            total_label="Хорошо",
            components=ConfidenceComponents(
                volume_level="normal",
                volume_score=80,
                volume_label="Отлично",
                filler_score=65,
                filler_label="Нормально",
                gaze_score=70,
                gaze_label="Хорошо",
                gesture_score=60,
                gesture_label="Нормально",
                gesture_advice="Используйте больше открытых жестов",
                tone_score=75,
                tone_label="Хорошо",
            ),
        ),
        speech_report=SpeechReport(
            summary="Тестовое выступление",
            structure="Есть вступление и основная часть",
            mistakes="Много слов-паразитов",
            ideal_text="Улучшенный текст",
            persona_feedback="Хорошее выступление",
            dynamic_fillers=["ну", "вот"],
            presentation_feedback="Слайды отсутствуют",
        ),
        evaluation_criteria_report=EvaluationCriteriaReport(
            total_score=0, max_score=0, criteria=[]
        ),
        analyze_provider="gigachat",
        analyze_model="GigaChat",
        transcribe_model="sber_gigachat",
    )


@pytest.fixture
def sample_audio_metrics():
    return {
        "volume_score": 80.0,
        "volume_level": "Нормально",
        "volume_label": "Отлично",
        "tone_score": 65.0,
        "tone_label": "Нормально",
    }


@pytest.fixture
def sample_video_metrics():
    return {
        "gaze_score": 70,
        "gaze_label": "Хорошо",
        "gesture_score": 55,
        "gesture_label": "Нормально",
        "gesture_advice": "Отличная, естественная жестикуляция.",
    }
