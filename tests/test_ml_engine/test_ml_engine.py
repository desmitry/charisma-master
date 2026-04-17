"""Tests for the MLEngine facade (services/ml_worker/app/logic/ml_engine)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
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
    @pytest.mark.parametrize(
        "provider, expected_sber_convert",
        [
            pytest.param("sber_gigachat", True, id="sber"),
            pytest.param("whisper_openai", False, id="openai"),
            pytest.param("whisper_local", False, id="local"),
        ],
    )
    def test_transcribe_dispatch(
        self,
        ml_engine_module,
        monkeypatch,
        provider,
        expected_sber_convert,
    ):
        """transcribe dispatches to the correct provider backend."""
        provider_enum = TranscribeProvider(provider)
        fake_segments = [
            TranscriptSegment(start=0.0, end=1.0, text="test", words=[]),
        ]

        sber_mock = MagicMock(return_value=fake_segments)
        openai_mock = MagicMock(return_value=fake_segments)
        local_mock = MagicMock(return_value=fake_segments)
        convert_mock = MagicMock(return_value="/tmp/audio_sber_16k.wav")

        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_sber", sber_mock
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_openai_whisper", openai_mock
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._transcribe_local_whisper", local_mock
        )
        monkeypatch.setattr(
            "app.logic.ml_engine._convert_to_sber_format", convert_mock
        )
        # Prevent sber temp-file cleanup from touching the filesystem
        monkeypatch.setattr(
            "app.logic.ml_engine.os.path.exists", lambda _: False
        )

        result = ml_engine_module.MLEngine.transcribe(
            "/tmp/audio.wav", provider_enum
        )

        assert result == fake_segments
        if expected_sber_convert:
            convert_mock.assert_called_once()
            sber_mock.assert_called_once()
            openai_mock.assert_not_called()
            local_mock.assert_not_called()
        else:
            convert_mock.assert_not_called()
            if provider == "whisper_openai":
                openai_mock.assert_called_once()
                sber_mock.assert_not_called()
                local_mock.assert_not_called()
            elif provider == "whisper_local":
                local_mock.assert_called_once()
                sber_mock.assert_not_called()
                openai_mock.assert_not_called()

    def test_transcribe_unknown_provider_returns_empty_list(
        self, ml_engine_module
    ):
        """Unknown transcription provider yields empty result list."""
        result = ml_engine_module.MLEngine.transcribe(
            "/tmp/audio.wav",
            "unknown_provider",  # not a TranscribeProvider enum value
        )
        assert result == []


class TestAnalyzeAudio:
    def test_happy_path(self, ml_engine_module, monkeypatch):
        """analyze_audio delegates to audio.analyze_audio."""
        fake_metrics = {
            "volume_score": 75.0,
            "volume_level": "Нормально",
            "volume_label": "Хорошо",
            "tone_score": 60.0,
            "tone_label": "Нормально",
        }
        monkeypatch.setattr(
            "app.logic.ml_engine._analyze_audio",
            lambda _: fake_metrics,
        )

        result = ml_engine_module.MLEngine.analyze_audio("/tmp/audio.wav")
        assert result == fake_metrics

    def test_error_propagates(self, ml_engine_module, monkeypatch):
        """Errors from the underlying analyzer propagate through the facade.

        The facade does not wrap the delegate in try/except, so any
        exception from the mocked `_analyze_audio` bubbles up. (The real
        `audio.analyze_audio` swallows exceptions internally, but the
        facade itself performs no error handling.)
        """

        def raise_error(_):
            raise RuntimeError("librosa failed")

        monkeypatch.setattr(
            "app.logic.ml_engine._analyze_audio",
            raise_error,
        )

        with pytest.raises(RuntimeError, match="librosa failed"):
            ml_engine_module.MLEngine.analyze_audio("/tmp/audio.wav")


class TestAnalyzeVideo:
    def test_happy_path(self, ml_engine_module, monkeypatch):
        """analyze_video delegates to video.analyze_video."""
        fake_metrics = {
            "gaze_score": 85,
            "gaze_label": "Отлично",
            "gesture_score": 70,
            "gesture_label": "Хорошо",
            "gesture_advice": "Good gestures.",
        }
        monkeypatch.setattr(
            "app.logic.ml_engine._analyze_video",
            lambda _: fake_metrics,
        )

        result = ml_engine_module.MLEngine.analyze_video("/tmp/video.mp4")
        assert result == fake_metrics

    def test_error_propagates(self, ml_engine_module, monkeypatch):
        """Errors from the underlying analyzer propagate through the facade."""

        def raise_error(_):
            raise RuntimeError("cv2 failed")

        monkeypatch.setattr(
            "app.logic.ml_engine._analyze_video",
            raise_error,
        )

        with pytest.raises(RuntimeError, match="cv2 failed"):
            ml_engine_module.MLEngine.analyze_video("/tmp/video.mp4")


class TestExtractAudio:
    def test_calls_ffmpeg(self, ml_engine_module, monkeypatch):
        """extract_audio invokes subprocess.run with ffmpeg."""
        captured = {}

        def capture_run(cmd, **kwargs):
            captured["cmd"] = cmd

            class _Result:
                returncode = 0
                stdout = b""
                stderr = b""

            return _Result()

        monkeypatch.setattr(
            "app.logic.ml_engine.audio.subprocess.run", capture_run
        )

        ml_engine_module.MLEngine.extract_audio(
            "/tmp/video.mp4",
            "/tmp/audio.wav",
        )

        assert captured["cmd"][0] == "ffmpeg"
        assert "/tmp/video.mp4" in captured["cmd"]
        assert "/tmp/audio.wav" in captured["cmd"]

    def test_ffmpeg_error_propagates(
        self, ml_engine_module, monkeypatch
    ):
        """subprocess.CalledProcessError from ffmpeg propagates."""
        import subprocess

        def raise_error(*args, **kwargs):
            raise subprocess.CalledProcessError(
                1, "ffmpeg", stderr=b"error"
            )

        monkeypatch.setattr(
            "app.logic.ml_engine.audio.subprocess.run", raise_error
        )

        with pytest.raises(subprocess.CalledProcessError):
            ml_engine_module.MLEngine.extract_audio(
                "/tmp/bad.mp4", "/tmp/out.wav"
            )


class TestBackwardCompat:
    def test_tasks_sees_same_ml_engine(self, ml_engine_module):
        """app.logic.tasks.MLEngine is the same identity as the facade."""
        from app.logic import tasks

        assert tasks.MLEngine is ml_engine_module.MLEngine
