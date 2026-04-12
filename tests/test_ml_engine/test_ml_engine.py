"""Unit tests for pure functions in MLEngine.

These tests do not require ML models, media files, or external services.
"""

import pytest
from charisma_schemas import (
    PauseInterval,
    TempoPoint,
    TranscriptSegment,
    TranscriptWord,
)

from services.ml_worker.app.logic.ml_engine import MLEngine


# ---- get_score_label ---------------------------------------------------------


class TestGetScoreLabel:
    """Tests for MLEngine.get_score_label boundary mapping."""

    def test_score_90_and_above(self):
        assert MLEngine.get_score_label(90) == "Великолепно"
        assert MLEngine.get_score_label(100) == "Великолепно"

    def test_score_80_to_89(self):
        assert MLEngine.get_score_label(80) == "Отлично"
        assert MLEngine.get_score_label(89.9) == "Отлично"

    def test_score_70_to_79(self):
        assert MLEngine.get_score_label(70) == "Хорошо"
        assert MLEngine.get_score_label(79) == "Хорошо"

    def test_score_55_to_69(self):
        assert MLEngine.get_score_label(55) == "Нормально"
        assert MLEngine.get_score_label(69) == "Нормально"

    def test_score_40_to_54(self):
        assert MLEngine.get_score_label(40) == "Слабо"
        assert MLEngine.get_score_label(54) == "Слабо"

    def test_score_below_40(self):
        assert MLEngine.get_score_label(39) == "Требует внимания"
        assert MLEngine.get_score_label(0) == "Требует внимания"


# ---- calculate_tempo ---------------------------------------------------------


class TestCalculateTempo:
    """Tests for MLEngine.calculate_tempo zone assignment."""

    def test_empty_transcript_returns_empty(self):
        assert MLEngine.calculate_tempo([]) == []

    def test_single_segment_returns_tempo_points(
        self, sample_transcript_segments
    ):
        points = MLEngine.calculate_tempo(sample_transcript_segments)
        assert len(points) > 0
        assert all(isinstance(p, TempoPoint) for p in points)

    def test_tempo_zone_green(self):
        """WPM between 100 and 140 (inclusive) should be green."""
        # 10 words in a 5-second window => (10/5)*60 = 120 wpm
        words = [
            TranscriptWord(
                start=i * 0.5, end=i * 0.5 + 0.3, text=f"word{i}"
            )
            for i in range(10)
        ]
        segment = TranscriptSegment(
            start=0.0,
            end=5.0,
            text=" ".join(w.text for w in words),
            words=words,
        )
        points = MLEngine.calculate_tempo([segment])
        first_point = points[0]
        assert first_point.zone == "green"

    def test_tempo_zone_red_fast(self):
        """WPM above 160 should be red."""
        # 15 words in 5 seconds => (15/5)*60 = 180 wpm
        words = [
            TranscriptWord(
                start=i * 0.3, end=i * 0.3 + 0.2, text=f"word{i}"
            )
            for i in range(15)
        ]
        segment = TranscriptSegment(
            start=0.0,
            end=4.5,
            text=" ".join(w.text for w in words),
            words=words,
        )
        points = MLEngine.calculate_tempo([segment])
        first_point = points[0]
        assert first_point.zone == "red"

    def test_tempo_zone_red_slow(self):
        """WPM below 80 should be red."""
        # 5 words in 5 seconds => (5/5)*60 = 60 wpm
        words = [
            TranscriptWord(
                start=i * 1.0, end=i * 1.0 + 0.5, text=f"word{i}"
            )
            for i in range(5)
        ]
        segment = TranscriptSegment(
            start=0.0,
            end=5.0,
            text=" ".join(w.text for w in words),
            words=words,
        )
        points = MLEngine.calculate_tempo([segment])
        first_point = points[0]
        assert first_point.zone == "red"

    def test_tempo_zone_yellow(self):
        """WPM between 80-99 or 141-160 should be yellow."""
        # 7 words in 5 seconds => (7/5)*60 = 84 wpm  -> yellow
        words = [
            TranscriptWord(
                start=i * 0.7, end=i * 0.7 + 0.4, text=f"word{i}"
            )
            for i in range(7)
        ]
        segment = TranscriptSegment(
            start=0.0,
            end=5.0,
            text=" ".join(w.text for w in words),
            words=words,
        )
        points = MLEngine.calculate_tempo([segment])
        first_point = points[0]
        assert first_point.zone == "yellow"

    def test_segment_without_words_uses_text_split(self):
        """When words list is empty, tempo falls back to splitting text."""
        segment = TranscriptSegment(
            start=0.0,
            end=5.0,
            text="one two three four five six seven eight nine ten",
            words=[],
        )
        points = MLEngine.calculate_tempo([segment])
        assert len(points) > 0


# ---- get_long_pauses ---------------------------------------------------------


class TestGetLongPauses:
    """Tests for MLEngine.get_long_pauses."""

    def test_empty_transcript(self):
        assert MLEngine.get_long_pauses([]) == []

    def test_single_segment_no_pauses(self):
        seg = TranscriptSegment(
            start=0.0, end=3.0, text="hello", words=[]
        )
        assert MLEngine.get_long_pauses([seg]) == []

    def test_detects_long_pause(self):
        segments = [
            TranscriptSegment(
                start=0.0, end=2.0, text="hello", words=[]
            ),
            TranscriptSegment(
                start=5.0, end=7.0, text="world", words=[]
            ),
        ]
        pauses = MLEngine.get_long_pauses(segments, threshold=2.0)
        assert len(pauses) == 1
        assert isinstance(pauses[0], PauseInterval)
        assert pauses[0].duration == 3.0

    def test_ignores_short_pause(self):
        segments = [
            TranscriptSegment(
                start=0.0, end=2.0, text="hello", words=[]
            ),
            TranscriptSegment(
                start=3.0, end=5.0, text="world", words=[]
            ),
        ]
        pauses = MLEngine.get_long_pauses(segments, threshold=2.0)
        assert len(pauses) == 0

    def test_custom_threshold(self):
        segments = [
            TranscriptSegment(
                start=0.0, end=1.0, text="a", words=[]
            ),
            TranscriptSegment(
                start=2.5, end=3.0, text="b", words=[]
            ),
        ]
        # With threshold 1.0 the 1.5s gap is detected.
        pauses = MLEngine.get_long_pauses(segments, threshold=1.0)
        assert len(pauses) == 1
        # With default 2.0 it is not.
        pauses_default = MLEngine.get_long_pauses(segments)
        assert len(pauses_default) == 0

    def test_multiple_pauses(self, sample_transcript_segments):
        """sample_transcript_segments has a 2.0s gap (3.5->4.0 = 0.5s)
        and a 2.0s gap (8.0->10.0 = 2.0s).  Only the second qualifies."""
        pauses = MLEngine.get_long_pauses(
            sample_transcript_segments, threshold=2.0
        )
        assert len(pauses) == 1
        assert pauses[0].start == 8.0
        assert pauses[0].end == 10.0


# ---- Filler detection --------------------------------------------------------


class TestFillerDetection:
    """Tests for the BASE_FILLER_WORDS set on MLEngine."""

    def test_known_fillers_present(self):
        expected = {"ну", "короче", "типа", "э", "ээ", "вот", "значит"}
        assert expected.issubset(MLEngine.BASE_FILLER_WORDS)

    def test_normal_words_not_fillers(self):
        non_fillers = {"привет", "здравствуйте", "результат", "анализ"}
        assert non_fillers.isdisjoint(MLEngine.BASE_FILLER_WORDS)


# ---- Empty metrics factories -------------------------------------------------


class TestEmptyMetrics:
    """Tests for get_empty_video_metrics and get_empty_audio_metrics."""

    def test_empty_video_metrics_keys(self):
        metrics = MLEngine.get_empty_video_metrics()
        expected_keys = {
            "gaze_score",
            "gaze_label",
            "gesture_score",
            "gesture_label",
            "gesture_advice",
        }
        assert set(metrics.keys()) == expected_keys

    def test_empty_video_metrics_defaults(self):
        metrics = MLEngine.get_empty_video_metrics()
        assert metrics["gaze_score"] == 0
        assert metrics["gesture_score"] == 0
        assert metrics["gaze_label"] == ""

    def test_empty_audio_metrics_keys(self):
        metrics = MLEngine.get_empty_audio_metrics()
        expected_keys = {
            "volume_score",
            "volume_level",
            "volume_label",
            "tone_score",
            "tone_label",
        }
        assert set(metrics.keys()) == expected_keys

    def test_empty_audio_metrics_defaults(self):
        metrics = MLEngine.get_empty_audio_metrics()
        assert metrics["volume_score"] == 0
        assert metrics["tone_score"] == 0
        assert metrics["volume_level"] == ""

    def test_empty_metrics_return_new_dicts(self):
        """Each call should return a fresh dict, not a shared mutable."""
        v1 = MLEngine.get_empty_video_metrics()
        v2 = MLEngine.get_empty_video_metrics()
        assert v1 is not v2

        a1 = MLEngine.get_empty_audio_metrics()
        a2 = MLEngine.get_empty_audio_metrics()
        assert a1 is not a2
