"""Tests for charisma_schemas models and enums."""

from __future__ import annotations

import pytest
from charisma_schemas import (
    AnalysisResult,
    AnalyzeProvider,
    ConfidenceComponents,
    ConfidenceIndex,
    EvaluationCriteriaReport,
    EvaluationCriterion,
    FillersSummary,
    PersonaRoles,
    SpeechReport,
    TaskStage,
    TaskState,
    TranscribeProvider,
    TranscriptSegment,
    TranscriptWord,
)


class TestTranscribeProvider:
    def test_has_all_members(self):
        assert TranscribeProvider.sber_gigachat.value == "sber_gigachat"
        assert TranscribeProvider.whisper_local.value == "whisper_local"
        assert (
            TranscribeProvider.whisper_openai.value == "whisper_openai"
        )

    def test_is_string_enum(self):
        assert isinstance(TranscribeProvider.sber_gigachat, str)
        assert TranscribeProvider("sber_gigachat") == (
            TranscribeProvider.sber_gigachat
        )


class TestAnalyzeProvider:
    def test_members(self):
        assert AnalyzeProvider.gigachat.value == "gigachat"
        assert AnalyzeProvider.openai.value == "openai"

    def test_is_string_enum(self):
        assert isinstance(AnalyzeProvider.gigachat, str)


class TestPersonaRoles:
    def test_all_roles(self):
        assert PersonaRoles.strict_critic.value == "strict_critic"
        assert PersonaRoles.kind_mentor.value == "kind_mentor"
        assert (
            PersonaRoles.steve_jobs_style.value == "steve_jobs_style"
        )
        assert (
            PersonaRoles.speech_review_specialist.value
            == "speech_review_specialist"
        )


class TestTaskState:
    def test_values(self):
        assert TaskState.queued.value == "PENDING"
        assert TaskState.processing.value == "PROCESSING"
        assert TaskState.finished.value == "SUCCESS"
        assert TaskState.failed.value == "FAILURE"

    def test_hint_property(self):
        assert TaskState.queued.hint == "PENDING"
        assert TaskState.processing.hint == "PROCESSING"
        assert TaskState.finished.hint == "SUCCESS"
        assert TaskState.failed.hint == "FAILURE"


class TestTaskStage:
    def test_transcription_meta(self):
        meta = TaskStage.transcription.meta
        assert meta["stage"] == "transcription"
        assert meta["progress"] == pytest.approx(0.1)
        assert "Транскрибация" in meta["hint"]

    def test_video_analisis_meta(self):
        meta = TaskStage.video_analisis.meta
        assert meta["stage"] == "video_analysis"
        assert meta["progress"] == pytest.approx(0.25)

    def test_audio_analisis_meta(self):
        meta = TaskStage.audio_analisis.meta
        assert meta["stage"] == "audio_analisis"
        assert meta["progress"] == pytest.approx(0.4)

    def test_all_stages_have_meta(self):
        expected_keys = {"stage", "progress", "hint"}
        for stage in TaskStage:
            meta = stage.meta
            assert set(meta.keys()) == expected_keys
            assert isinstance(meta["stage"], str)
            assert isinstance(meta["progress"], float)
            assert isinstance(meta["hint"], str)

    def test_presentation_text_parsing(self):
        meta = TaskStage.presentation_text_parsing.meta
        assert meta["stage"] == "presentation_text_parsing"
        assert meta["progress"] == pytest.approx(0.45)

    def test_evaluation_criteria_report(self):
        meta = TaskStage.evaluation_criteria_report.meta
        assert meta["stage"] == "evaluation_criteria_report"
        assert meta["progress"] == pytest.approx(0.5)

    def test_llm_speech_report(self):
        meta = TaskStage.llm_speech_report.meta
        assert meta["stage"] == "llm_speech_report"
        assert meta["progress"] == pytest.approx(0.7)

    def test_llm_criteria_report(self):
        meta = TaskStage.llm_criteria_report.meta
        assert meta["stage"] == "llm_criteria_report"
        assert meta["progress"] == pytest.approx(0.9)


class TestTranscriptWord:
    def test_is_filler_defaults_false(self):
        word = TranscriptWord(start=0.0, end=0.5, text="hi")
        assert word.is_filler is False


class TestTranscriptSegment:
    def test_empty_words(self):
        segment = TranscriptSegment(
            start=0.0, end=0.5, text="", words=[]
        )
        assert segment.words == []


class TestEvaluationCriterion:
    def test_defaults(self):
        crit = EvaluationCriterion(
            name="Tone",
            description="Tone description",
            max_value=5,
        )
        assert crit.current_value == 0
        assert crit.feedback == ""


class TestAnalysisResult:
    def _make_confidence_index(self) -> ConfidenceIndex:
        comps = ConfidenceComponents(
            volume_level="Нормально",
            volume_score=85,
            volume_label="Отлично",
            filler_score=75,
            filler_label="Хорошо",
            gaze_score=90,
            gaze_label="Великолепно",
            gesture_score=70,
            gesture_label="Хорошо",
            gesture_advice="",
            tone_score=80,
            tone_label="Отлично",
        )
        return ConfidenceIndex(
            total=80.0, total_label="Отлично", components=comps
        )

    def _make_speech_report(self) -> SpeechReport:
        return SpeechReport(
            summary="",
            structure="",
            mistakes="",
            ideal_text="",
            persona_feedback="",
            dynamic_fillers=[],
            presentation_feedback="",
            useful_links="",
        )

    def test_create_full(self):
        result = AnalysisResult(
            task_id="abc-123",
            video_path="videos/abc.mp4",
            user_need_video_analysis=True,
            user_need_text_from_video=True,
            transcript=[],
            tempo=[],
            long_pauses=[],
            fillers_summary=FillersSummary(count=0, ratio=0),
            confidence_index=self._make_confidence_index(),
            speech_report=self._make_speech_report(),
            evaluation_criteria_report=EvaluationCriteriaReport(
                total_score=0, max_score=0, criteria=[]
            ),
            analyze_provider="gigachat",
            analyze_model="GigaChat",
            transcribe_model="sber_gigachat",
        )
        assert result.task_id == "abc-123"
        assert result.video_path == "videos/abc.mp4"
        assert result.user_need_video_analysis is True
        assert result.transcript == []

    def test_video_path_optional(self):
        result = AnalysisResult(
            task_id="t1",
            video_path=None,
            user_need_video_analysis=False,
            user_need_text_from_video=False,
            transcript=[],
            tempo=[],
            long_pauses=[],
            fillers_summary=FillersSummary(count=0, ratio=0),
            confidence_index=self._make_confidence_index(),
            speech_report=self._make_speech_report(),
            evaluation_criteria_report=EvaluationCriteriaReport(
                total_score=0, max_score=0, criteria=[]
            ),
            analyze_provider="openai",
            analyze_model="gpt-4",
            transcribe_model="whisper_local",
        )
        assert result.video_path is None
