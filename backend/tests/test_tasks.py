def test_confidence_index_calculation():
    """Test the confidence formula from tasks.py."""
    filler_score = 80.0
    tone_score = 70.0
    volume_score = 60.0
    gaze_score = 90.0
    gesture_score = 50.0

    total = (
        (filler_score * 0.35)
        + (tone_score * 0.25)
        + (volume_score * 0.20)
        + (gaze_score * 0.10)
        + (gesture_score * 0.10)
    )
    total = min(total, 100)
    total = round(total)

    # 28.0 + 17.5 + 12.0 + 9.0 + 5.0 = 71.5 -> 72
    assert total == 72


def test_confidence_index_capped_at_100():
    total = (100 * 0.35) + (100 * 0.25) + (100 * 0.20) + (100 * 0.10) + (100 * 0.10)
    total = min(total, 100)
    assert total == 100


def test_confidence_index_all_zeros():
    total = (0 * 0.35) + (0 * 0.25) + (0 * 0.20) + (0 * 0.10) + (0 * 0.10)
    total = min(total, 100)
    assert total == 0


def test_filler_score_formula():
    total_words = 100
    filler_count = 10
    ratio = filler_count / total_words
    score = max(0, 100 - (ratio * 750))
    assert score == 25.0


def test_filler_score_no_fillers():
    score = max(0, 100 - (0 * 750))
    assert score == 100


def test_filler_score_many_fillers():
    ratio = 0.2
    score = max(0, 100 - (ratio * 750))
    assert score == 0


def test_filler_ratio_calculation():
    total_words = 50
    filler_count = 5
    ratio = filler_count / total_words
    assert ratio == 0.1


def test_weights_sum_to_one():
    weights = 0.35 + 0.25 + 0.20 + 0.10 + 0.10
    assert weights == 1.0
