from app.logic.ml_engine.audio import get_empty_audio_metrics


def test_empty_audio_metrics_keys():
    m = get_empty_audio_metrics()
    assert "volume_score" in m
    assert "volume_level" in m
    assert "volume_label" in m
    assert "tone_score" in m
    assert "tone_label" in m


def test_empty_audio_metrics_defaults():
    m = get_empty_audio_metrics()
    assert m["volume_score"] == 0
    assert m["tone_score"] == 0
    assert m["volume_level"] == ""
    assert m["volume_label"] == ""
    assert m["tone_label"] == ""
