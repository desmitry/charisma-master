from app.logic.ml_engine.scoring import get_score_label, get_tempo_zone


def test_score_label_excellent():
    assert get_score_label(95) == "Великолепно"


def test_score_label_great():
    assert get_score_label(85) == "Отлично"


def test_score_label_good():
    assert get_score_label(75) == "Хорошо"


def test_score_label_normal():
    assert get_score_label(55) == "Нормально"


def test_score_label_weak():
    assert get_score_label(40) == "Слабо"


def test_score_label_needs_attention():
    assert get_score_label(10) == "Требует внимания"


def test_score_label_boundary_90():
    assert get_score_label(90) == "Великолепно"


def test_score_label_boundary_80():
    assert get_score_label(80) == "Отлично"


def test_score_label_zero():
    assert get_score_label(0) == "Требует внимания"


def test_tempo_zone_slow():
    assert get_tempo_zone(50) == "red"


def test_tempo_zone_normal():
    assert get_tempo_zone(120) == "green"


def test_tempo_zone_fast():
    assert get_tempo_zone(170) == "red"


def test_tempo_zone_yellow_low():
    assert get_tempo_zone(90) == "yellow"


def test_tempo_zone_yellow_high():
    assert get_tempo_zone(150) == "yellow"


def test_tempo_zone_boundary_green_start():
    assert get_tempo_zone(100) == "green"


def test_tempo_zone_boundary_green_end():
    assert get_tempo_zone(139) == "green"
