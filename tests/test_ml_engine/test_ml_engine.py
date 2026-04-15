"""Tests for the MLEngine facade (services/ml_worker/app/logic/ml_engine)."""

from __future__ import annotations

from unittest.mock import MagicMock

from charisma_schemas import (
    TranscribeProvider,
    TranscriptSegment,
    TranscriptWord,
)


class TestMLEngineConstants:
    def test_visual_deviation(self, ml_engine_module):
        assert ml_engine_module.MLEngine.VISUAL_DEVIATION == 0.25

    def test_target_frame_width(self, ml_engine_module):
        assert ml_engine_module.MLEngine.TARGET_FRAME_WIDTH == 480

    def test_movement_threshold(self, ml_engine_module):
        assert ml_engine_module.MLEngine.MOVEMENT_THRESHOLD == 0.002

    def test_base_filler_words_count(self, ml_engine_module):
        assert len(ml_engine_module.MLEngine.BASE_FILLER_WORDS) == 19

    def test_base_filler_words_content(self, ml_engine_module):
        fillers = ml_engine_module.MLEngine.BASE_FILLER_WORDS
        assert "ну" in fillers
        assert "типа" in fillers
        assert "короче" in fillers
        assert "ээ" in fillers


class TestMLEngineInstantiation:
    def test_can_instantiate(self, ml_engine_module):
        engine = ml_engine_module.MLEngine()
        assert engine is not None


class TestWhisperLocalModelProperty:
    def test_initially_none(self, ml_engine_module):
        from app.logic.ml_engine.transcription import local_whisper

        local_whisper._whisper_local_model = None
        assert ml_engine_module.MLEngine._whisper_local_model is None

    def test_read_through_to_module(self, ml_engine_module):
        from app.logic.ml_engine.transcription import local_whisper

        sentinel = object()
        local_whisper._whisper_local_model = sentinel
        try:
            assert (
                ml_engine_module.MLEngine._whisper_local_model
                is sentinel
            )
        finally:
            local_whisper._whisper_local_model = None


class TestGetEmptyMetrics:
    def test_empty_audio_metrics_keys(self, ml_engine_module):
        metrics = ml_engine_module.MLEngine.get_empty_audio_metrics()
        assert isinstance(metrics, dict)
        expected_keys = {
            "volume_score",
            "volume_level",
            "volume_label",
            "tone_score",
            "tone_label",
        }
        assert set(metrics.keys()) == expected_keys
        assert metrics["volume_score"] == 0
        assert metrics["tone_score"] == 0
        assert metrics["volume_level"] == ""

    def test_empty_video_metrics_keys(self, ml_engine_module):
        metrics = ml_engine_module.MLEngine.get_empty_video_metrics()
        assert isinstance(metrics, dict)
        expected_keys = {
            "gaze_score",
            "gaze_label",
            "gesture_score",
            "gesture_label",
            "gesture_advice",
        }
        assert set(metrics.keys()) == expected_keys
        assert metrics["gaze_score"] == 0
        assert metrics["gesture_score"] == 0
        assert metrics["gesture_advice"] == ""


class TestGetScoreLabel:
    def test_excellent(self, ml_engine_module):
        assert (
            ml_engine_module.MLEngine.get_score_label(95)
            == "Великолепно"
        )
        assert (
            ml_engine_module.MLEngine.get_score_label(90)
            == "Великолепно"
        )

    def test_great(self, ml_engine_module):
        assert (
            ml_engine_module.MLEngine.get_score_label(85) == "Отлично"
        )
        assert (
            ml_engine_module.MLEngine.get_score_label(80) == "Отлично"
        )

    def test_good(self, ml_engine_module):
        assert (
            ml_engine_module.MLEngine.get_score_label(75) == "Хорошо"
        )
        assert (
            ml_engine_module.MLEngine.get_score_label(70) == "Хорошо"
        )

    def test_normal(self, ml_engine_module):
        assert (
            ml_engine_module.MLEngine.get_score_label(60) == "Нормально"
        )
        assert (
            ml_engine_module.MLEngine.get_score_label(55) == "Нормально"
        )

    def test_weak(self, ml_engine_module):
        assert ml_engine_module.MLEngine.get_score_label(50) == "Слабо"
        assert ml_engine_module.MLEngine.get_score_label(40) == "Слабо"

    def test_needs_attention(self, ml_engine_module):
        assert (
            ml_engine_module.MLEngine.get_score_label(30)
            == "Требует внимания"
        )
        assert (
            ml_engine_module.MLEngine.get_score_label(0)
            == "Требует внимания"
        )


class TestGetLongPauses:
    def test_empty_transcript(self, ml_engine_module):
        result = ml_engine_module.MLEngine.get_long_pauses([])
        assert result == []

    def test_single_segment_no_pauses(self, ml_engine_module):
        segments = [
            TranscriptSegment(
                start=0.0, end=5.0, text="hi", words=[]
            )
        ]
        result = ml_engine_module.MLEngine.get_long_pauses(segments)
        assert result == []

    def test_detects_long_pause(self, ml_engine_module):
        segments = [
            TranscriptSegment(
                start=0.0, end=1.0, text="one", words=[]
            ),
            TranscriptSegment(
                start=5.0, end=6.0, text="two", words=[]
            ),
        ]
        pauses = ml_engine_module.MLEngine.get_long_pauses(
            segments, threshold=2.0
        )
        assert len(pauses) == 1
        assert pauses[0].start == 1.0
        assert pauses[0].end == 5.0
        assert pauses[0].duration == 4.0

    def test_ignores_short_pause(self, ml_engine_module):
        segments = [
            TranscriptSegment(
                start=0.0, end=1.0, text="one", words=[]
            ),
            TranscriptSegment(
                start=1.5, end=2.0, text="two", words=[]
            ),
        ]
        pauses = ml_engine_module.MLEngine.get_long_pauses(
            segments, threshold=2.0
        )
        assert pauses == []


class TestCalculateTempo:
    def test_empty_transcript(self, ml_engine_module):
        result = ml_engine_module.MLEngine.calculate_tempo([])
        assert result == []

    def test_segments_without_words(self, ml_engine_module):
        # Empty-words segments with empty text produce no tempo points
        segments = [
            TranscriptSegment(
                start=0.0, end=1.0, text="", words=[]
            )
        ]
        result = ml_engine_module.MLEngine.calculate_tempo(segments)
        assert result == []

    def test_segments_with_words_returns_points(
        self, ml_engine_module
    ):
        words = [
            TranscriptWord(start=0.1, end=0.5, text="hi"),
            TranscriptWord(start=0.6, end=1.0, text="there"),
            TranscriptWord(start=1.1, end=1.5, text="friend"),
        ]
        segments = [
            TranscriptSegment(
                start=0.0, end=1.5, text="hi there friend", words=words
            )
        ]
        result = ml_engine_module.MLEngine.calculate_tempo(segments)
        assert isinstance(result, list)
        assert len(result) > 0
        for point in result:
            assert hasattr(point, "time")
            assert hasattr(point, "wpm")
            assert hasattr(point, "zone")
            assert point.zone in {"green", "yellow", "red"}


class TestLoadModel:
    def test_load_model_none_returns_none(self, ml_engine_module):
        assert ml_engine_module.MLEngine.load_model(None) is None

    def test_load_model_non_whisper_returns_none(
        self, ml_engine_module
    ):
        assert (
            ml_engine_module.MLEngine.load_model("some-other-provider")
            is None
        )

    def test_load_model_whisper_local(
        self, ml_engine_module, monkeypatch
    ):
        """load_model caches a WhisperModel for whisper_local."""
        from app.logic.ml_engine.transcription import local_whisper

        local_whisper._whisper_local_model = None

        fake_whisper_model = MagicMock(name="FakeWhisperModel")
        fake_whisper_class = MagicMock(return_value=fake_whisper_model)
        monkeypatch.setattr(
            "app.logic.ml_engine.transcription.local_whisper.WhisperModel",
            fake_whisper_class,
        )

        result = ml_engine_module.MLEngine.load_model(
            TranscribeProvider.whisper_local
        )
        assert result is fake_whisper_model
        fake_whisper_class.assert_called_once()
        # Reset cache for other tests
        local_whisper._whisper_local_model = None


class TestTranscribeDispatch:
    def test_dispatch_sber(self, ml_engine_module, monkeypatch):
        fake_segments = [
            TranscriptSegment(
                start=0.0, end=1.0, text="sber", words=[]
            )
        ]
        sber_mock = MagicMock(return_value=fake_segments)
        openai_mock = MagicMock(return_value=[])
        local_mock = MagicMock(return_value=[])
        convert_mock = MagicMock(return_value="/tmp/audio_sber_16k.wav")
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_sber", sber_mock
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_openai_whisper",
            openai_mock,
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_local_whisper",
            local_mock,
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._convert_to_sber_format", convert_mock
        )

        # Prevent os.path.exists from finding the fake file
        monkeypatch.setattr(
            "app.logic.ml_engine.os.path.exists", lambda _: False
        )

        result = ml_engine_module.MLEngine.transcribe(
            "/tmp/audio.wav", TranscribeProvider.sber_gigachat
        )
        assert result == fake_segments
        convert_mock.assert_called_once_with("/tmp/audio.wav")
        sber_mock.assert_called_once_with("/tmp/audio_sber_16k.wav")
        openai_mock.assert_not_called()
        local_mock.assert_not_called()

    def test_dispatch_openai_whisper(
        self, ml_engine_module, monkeypatch
    ):
        fake_segments = [
            TranscriptSegment(
                start=0.0, end=1.0, text="openai", words=[]
            )
        ]
        sber_mock = MagicMock(return_value=[])
        openai_mock = MagicMock(return_value=fake_segments)
        local_mock = MagicMock(return_value=[])
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_sber", sber_mock
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_openai_whisper",
            openai_mock,
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_local_whisper",
            local_mock,
        )
        result = ml_engine_module.MLEngine.transcribe(
            "/tmp/audio.wav", TranscribeProvider.whisper_openai
        )
        assert result == fake_segments
        openai_mock.assert_called_once_with("/tmp/audio.wav")
        sber_mock.assert_not_called()
        local_mock.assert_not_called()

    def test_dispatch_local_whisper(
        self, ml_engine_module, monkeypatch
    ):
        fake_segments = [
            TranscriptSegment(
                start=0.0, end=1.0, text="local", words=[]
            )
        ]
        sber_mock = MagicMock(return_value=[])
        openai_mock = MagicMock(return_value=[])
        local_mock = MagicMock(return_value=fake_segments)
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_sber", sber_mock
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_openai_whisper",
            openai_mock,
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_local_whisper",
            local_mock,
        )
        result = ml_engine_module.MLEngine.transcribe(
            "/tmp/audio.wav", TranscribeProvider.whisper_local
        )
        assert result == fake_segments
        local_mock.assert_called_once_with("/tmp/audio.wav")
        sber_mock.assert_not_called()
        openai_mock.assert_not_called()


class TestBackwardCompat:
    def test_tasks_sees_same_ml_engine(self, ml_engine_module):
        """app.logic.tasks.MLEngine is the same identity as the facade."""
        from app.logic import tasks

        assert tasks.MLEngine is ml_engine_module.MLEngine
