"""Tests for charisma_schemas Pydantic models and enums."""

import pytest
from charisma_schemas import (
    AnalyzeProvider,
    EvaluationCriterion,
    FillersSummary,
    PersonaRoles,
    TaskStage,
    TaskState,
    TaskStatusResponse,
    TranscribeProvider,
    TranscriptSegment,
    TranscriptWord,
    UploadResponse,
)
from pydantic import ValidationError

# ---- TranscriptWord defaults ------------------------------------------------


class TestTranscriptWord:
    """TranscriptWord field defaults and validation."""

    def test_is_filler_defaults_to_false(self):
        word = TranscriptWord(start=0.0, end=1.0, text="hello")
        assert word.is_filler is False

    def test_is_filler_can_be_set_true(self):
        word = TranscriptWord(start=0.0, end=0.5, text="ну", is_filler=True)
        assert word.is_filler is True

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            TranscriptWord(start=0.0, end=1.0)  # missing text


# ---- TaskState --------------------------------------------------------------


class TestTaskState:
    """TaskState enum values and count."""

    def test_member_count(self):
        assert len(TaskState) == 4

    def test_expected_values(self):
        assert TaskState.queued.value == "PENDING"
        assert TaskState.processing.value == "PROCESSING"
        assert TaskState.finished.value == "SUCCESS"
        assert TaskState.failed.value == "FAILURE"

    def test_hint_property(self):
        for member in TaskState:
            assert member.hint == member.value


# ---- TaskStage --------------------------------------------------------------


class TestTaskStage:
    """TaskStage enum meta property."""

    def test_member_count(self):
        assert len(TaskStage) == 7

    def test_meta_has_expected_keys(self):
        for stage in TaskStage:
            meta = stage.meta
            assert "stage" in meta
            assert "progress" in meta
            assert "hint" in meta

    def test_progress_values_are_increasing(self):
        progresses = [stage.meta["progress"] for stage in TaskStage]
        assert progresses == sorted(progresses)

    def test_transcription_stage_meta(self):
        meta = TaskStage.transcription.meta
        assert meta["stage"] == "transcription"
        assert meta["progress"] == 0.1


# ---- TranscribeProvider -----------------------------------------------------


class TestTranscribeProvider:
    """TranscribeProvider enum values."""

    def test_member_count(self):
        assert len(TranscribeProvider) == 3

    def test_values(self):
        assert TranscribeProvider.sber_gigachat.value == "sber_gigachat"
        assert TranscribeProvider.whisper_local.value == "whisper_local"
        assert TranscribeProvider.whisper_openai.value == "whisper_openai"


# ---- AnalyzeProvider --------------------------------------------------------


class TestAnalyzeProvider:
    """AnalyzeProvider enum values."""

    def test_member_count(self):
        assert len(AnalyzeProvider) == 2

    def test_values(self):
        assert AnalyzeProvider.gigachat.value == "gigachat"
        assert AnalyzeProvider.openai.value == "openai"


# ---- PersonaRoles -----------------------------------------------------------


class TestPersonaRoles:
    """PersonaRoles enum values."""

    def test_member_count(self):
        assert len(PersonaRoles) == 4

    def test_known_members(self):
        names = {m.name for m in PersonaRoles}
        assert "strict_critic" in names
        assert "kind_mentor" in names
        assert "steve_jobs_style" in names
        assert "speech_review_specialist" in names


# ---- EvaluationCriterion defaults -------------------------------------------


class TestEvaluationCriterion:
    """EvaluationCriterion default values."""

    def test_defaults(self):
        c = EvaluationCriterion(name="Test", description="desc", max_value=10)
        assert c.current_value == 0
        assert c.feedback == ""


# ---- UploadResponse ---------------------------------------------------------


class TestUploadResponse:
    """UploadResponse basic validation."""

    def test_roundtrip(self):
        resp = UploadResponse(task_id="abc-123")
        assert resp.task_id == "abc-123"

    def test_missing_task_id_raises(self):
        with pytest.raises(ValidationError):
            UploadResponse()


# ---- TaskStatusResponse defaults --------------------------------------------


class TestTaskStatusResponse:
    """TaskStatusResponse field defaults."""

    def test_defaults(self):
        resp = TaskStatusResponse(
            task_id="x",
            state=TaskState.queued,
            hint="PENDING",
        )
        assert resp.progress == 0.0
        assert resp.stage is None
        assert resp.error is None


# ---- FillersSummary ---------------------------------------------------------


class TestFillersSummary:
    """FillersSummary accepts both int and float for ratio."""

    def test_int_ratio(self):
        fs = FillersSummary(count=5, ratio=10)
        assert fs.ratio == 10

    def test_float_ratio(self):
        fs = FillersSummary(count=3, ratio=0.15)
        assert fs.ratio == 0.15


# ---- TranscriptSegment ------------------------------------------------------


class TestTranscriptSegment:
    """TranscriptSegment requires words list."""

    def test_valid_segment(self):
        seg = TranscriptSegment(
            start=0.0,
            end=1.0,
            text="hi",
            words=[TranscriptWord(start=0.0, end=0.5, text="hi")],
        )
        assert len(seg.words) == 1

    def test_empty_words_list(self):
        seg = TranscriptSegment(start=0.0, end=1.0, text="hi", words=[])
        assert seg.words == []

    def test_missing_words_raises(self):
        with pytest.raises(ValidationError):
            TranscriptSegment(start=0.0, end=1.0, text="hi")
