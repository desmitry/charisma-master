"""Shared fixtures for the Charisma test suite."""

from unittest.mock import MagicMock, patch

import pytest
from charisma_schemas import (
    AnalysisResult,
    ConfidenceComponents,
    ConfidenceIndex,
    EvaluationCriteriaReport,
    EvaluationCriterion,
    FillersSummary,
    PauseInterval,
    SpeechReport,
    TempoPoint,
    TranscriptSegment,
    TranscriptWord,
)
from httpx import ASGITransport, AsyncClient


@pytest.fixture()
async def async_client():
    """Async HTTP client wired to the FastAPI application.

    The app module triggers ``ensure_buckets_exist`` on import, which
    requires a live SeaweedFS connection.  We patch it (and the Minio
    client factory) so the test suite can run without infrastructure.
    """
    with (
        patch("charisma_storage.ensure_buckets_exist"),
        patch("charisma_storage.get_client", return_value=MagicMock()),
    ):
        from services.api_gateway.app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            yield client


@pytest.fixture()
def sample_transcript_segments() -> list[TranscriptSegment]:
    """A small, realistic list of transcript segments for testing."""
    return [
        TranscriptSegment(
            start=0.0,
            end=3.5,
            text="Добрый день, коллеги",
            words=[
                TranscriptWord(start=0.0, end=0.8, text="Добрый"),
                TranscriptWord(start=0.9, end=1.5, text="день,"),
                TranscriptWord(start=1.6, end=2.5, text="коллеги"),
            ],
        ),
        TranscriptSegment(
            start=4.0,
            end=8.0,
            text="ну сегодня мы обсудим результаты",
            words=[
                TranscriptWord(start=4.0, end=4.3, text="ну", is_filler=True),
                TranscriptWord(start=4.4, end=5.0, text="сегодня"),
                TranscriptWord(start=5.1, end=5.4, text="мы"),
                TranscriptWord(start=5.5, end=6.2, text="обсудим"),
                TranscriptWord(start=6.3, end=7.8, text="результаты"),
            ],
        ),
        TranscriptSegment(
            start=10.0,
            end=14.0,
            text="как бы это важная тема",
            words=[
                TranscriptWord(
                    start=10.0, end=10.3, text="как", is_filler=True
                ),
                TranscriptWord(
                    start=10.4, end=10.6, text="бы", is_filler=True
                ),
                TranscriptWord(start=10.7, end=11.0, text="это"),
                TranscriptWord(start=11.1, end=11.8, text="важная"),
                TranscriptWord(start=11.9, end=12.5, text="тема"),
            ],
        ),
    ]


@pytest.fixture()
def sample_analysis_result() -> AnalysisResult:
    """A complete ``AnalysisResult`` instance for testing."""
    return AnalysisResult(
        task_id="test-task-id-1234",
        video_path="uploads/test-task-id-1234.mp4",
        transcript=[
            TranscriptSegment(
                start=0.0,
                end=3.0,
                text="Привет мир",
                words=[
                    TranscriptWord(start=0.0, end=1.0, text="Привет"),
                    TranscriptWord(start=1.5, end=2.5, text="мир"),
                ],
            ),
        ],
        tempo=[
            TempoPoint(time=0.0, wpm=120.0, zone="green"),
        ],
        long_pauses=[
            PauseInterval(start=3.0, end=6.0, duration=3.0),
        ],
        fillers_summary=FillersSummary(count=2, ratio=0.05),
        confidence_index=ConfidenceIndex(
            total=75.0,
            total_label="Хорошо",
            components=ConfidenceComponents(
                volume_level="Нормально",
                volume_score=70,
                volume_label="Хорошо",
                filler_score=80,
                filler_label="Отлично",
                gaze_score=65,
                gaze_label="Нормально",
                gesture_score=72,
                gesture_label="Хорошо",
                gesture_advice="Отличная, естественная жестикуляция.",
                tone_score=78,
                tone_label="Хорошо",
            ),
        ),
        speech_report=SpeechReport(
            summary="Хорошее выступление",
            structure="Логичная структура",
            mistakes="Мало ошибок",
            ideal_text="Идеальный текст",
            persona_feedback="Хорошая подача",
            dynamic_fillers=["ну", "как бы"],
            presentation_feedback="Хорошая презентация",
            useful_links="https://example.com",
        ),
        evaluation_criteria_report=EvaluationCriteriaReport(
            total_score=85,
            max_score=100,
            criteria=[
                EvaluationCriterion(
                    name="Содержание",
                    description="Полнота раскрытия темы",
                    max_value=30,
                    current_value=25,
                    feedback="Хорошо раскрыта тема",
                ),
            ],
        ),
        analyze_provider="gigachat",
        analyze_model="GigaChat-Max",
        transcribe_model="sber_gigachat",
    )
