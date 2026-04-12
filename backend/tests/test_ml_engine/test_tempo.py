from app.logic.ml_engine.tempo import calculate_tempo, get_long_pauses
from app.models.schemas import TranscriptSegment, TranscriptWord


def test_get_long_pauses_detected(sample_transcript_segments):
    pauses = get_long_pauses(sample_transcript_segments, threshold=0.4)
    assert len(pauses) == 1
    assert pauses[0].duration == 0.5


def test_get_long_pauses_none():
    segments = [
        TranscriptSegment(start=0.0, end=1.0, text="a", words=[]),
        TranscriptSegment(start=1.1, end=2.0, text="b", words=[]),
    ]
    pauses = get_long_pauses(segments, threshold=2.0)
    assert len(pauses) == 0


def test_get_long_pauses_empty():
    assert get_long_pauses([]) == []


def test_get_long_pauses_single_segment():
    segments = [TranscriptSegment(start=0.0, end=5.0, text="test", words=[])]
    assert get_long_pauses(segments) == []


def test_calculate_tempo_basic(sample_transcript_segments):
    points = calculate_tempo(sample_transcript_segments, window_sec=5.0)
    assert len(points) > 0
    assert all(p.wpm >= 0 for p in points)
    assert all(p.zone in ("red", "yellow", "green") for p in points)


def test_calculate_tempo_empty():
    assert calculate_tempo([]) == []


def test_calculate_tempo_no_words():
    segments = [TranscriptSegment(start=0.0, end=1.0, text="", words=[])]
    assert calculate_tempo(segments) == []
