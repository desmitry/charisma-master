from app.logic.ml_engine.transcription import _build_word, _is_filler


def test_is_filler_basic():
    assert _is_filler("ну") is True
    assert _is_filler("типа") is True
    assert _is_filler("вот") is True
    assert _is_filler("значит") is True
    assert _is_filler("короче") is True


def test_is_filler_with_punctuation():
    assert _is_filler("Ну,") is True
    assert _is_filler("вот.") is True
    assert _is_filler("типа,") is True


def test_is_filler_case_insensitive():
    assert _is_filler("НУ") is True
    assert _is_filler("Типа") is True


def test_is_filler_false():
    assert _is_filler("привет") is False
    assert _is_filler("работа") is False
    assert _is_filler("выступление") is False


def test_is_filler_sound_fillers():
    assert _is_filler("э") is True
    assert _is_filler("ээ") is True
    assert _is_filler("мм") is True
    assert _is_filler("ммм") is True


def test_build_word_filler():
    w = _build_word(0.0, 0.5, "ну")
    assert w.is_filler is True
    assert w.start == 0.0
    assert w.end == 0.5
    assert w.text == "ну"


def test_build_word_normal():
    w = _build_word(1.0, 2.0, "выступление")
    assert w.is_filler is False
    assert w.start == 1.0
    assert w.end == 2.0
