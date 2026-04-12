from app.logic.ml_engine.video import _compute_gaze, _compute_gesture, get_empty_video_metrics


def test_empty_video_metrics_keys():
    m = get_empty_video_metrics()
    assert "gaze_score" in m
    assert "gaze_label" in m
    assert "gesture_score" in m
    assert "gesture_label" in m
    assert "gesture_advice" in m


def test_empty_video_metrics_defaults():
    m = get_empty_video_metrics()
    assert m["gaze_score"] == 0
    assert m["gesture_score"] == 0


def test_compute_gaze_insufficient_frames():
    score, label = _compute_gaze(5, 3)
    assert score == 0
    assert label == ""


def test_compute_gaze_with_frames():
    score, label = _compute_gaze(100, 80)
    assert score == 80
    assert label == "Отлично"


def test_compute_gaze_perfect():
    score, label = _compute_gaze(100, 100)
    assert score == 100
    assert label == "Великолепно"


def test_compute_gesture_insufficient_frames():
    score, label, advice = _compute_gesture(5, 0.0)
    assert score == 0


def test_compute_gesture_with_movement():
    score, label, advice = _compute_gesture(100, 1.0)
    assert score > 0
    assert label != ""


def test_compute_gesture_low_movement():
    score, label, advice = _compute_gesture(100, 0.001)
    assert score < 15
    assert "неподвижны" in advice or "мало данных" in advice


def test_compute_gesture_high_movement():
    score, label, advice = _compute_gesture(100, 10.0)
    assert score > 0
