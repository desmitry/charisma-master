"""Centralised thresholds, magic numbers, and label maps for ML analysis."""

# ── Filler words (Russian) ──────────────────────────────────────────
BASE_FILLER_WORDS: frozenset[str] = frozenset(
    {
        "ну",
        "короче",
        "типа",
        "как",
        "бы",
        "э",
        "ээ",
        "эээ",
        "мм",
        "ммм",
        "вот",
        "значит",
        "собственно",
        "вообще",
        "походу",
        "реально",
        "знаете",
        "так",
        "скажем",
    }
)

# ── Video analysis ──────────────────────────────────────────────────
VISUAL_DEVIATION: float = 0.25
"""Max nose-to-centre deviation (as fraction of face width) to count as 'looking at camera'."""

TARGET_FRAME_WIDTH: int = 480
"""Frames are resized to this width before MediaPipe processing."""

MOVEMENT_THRESHOLD: float = 0.002
"""Minimum wrist delta per frame to count as 'movement'."""

GESTURE_MULTIPLIER: float = 3500.0
"""Multiplier to map average movement to a 0-100 score."""

MIN_FRAMES_FOR_DETECTION: int = 10
"""Minimum frames with face/pose to produce reliable metrics."""

FRAME_SKIP: int = 5
"""Process every N-th frame for performance."""

# ── Audio analysis ──────────────────────────────────────────────────
VOLUME_REFERENCE_RMS: float = 0.06
"""RMS value that maps to volume_score == 100."""

TONE_REFERENCE_STD: float = 35.0
"""Pitch-std value that maps to tone_score == 100."""

VOLUME_THRESHOLDS: dict[str, float] = {
    "very_quiet": 0.01,
    "quiet": 0.03,
    "loud": 0.15,
}

VOLUME_LABELS: dict[str, str] = {
    "very_quiet": "Очень тихо",
    "quiet": "Тиховато",
    "loud": "Громко",
    "normal": "Нормально",
}

# ── Tempo analysis ──────────────────────────────────────────────────
TEMPO_WINDOW_SEC: float = 5.0

TEMPO_ZONES: list[dict] = [
    {"zone": "red", "min_wpm": 0, "max_wpm": 80},
    {"zone": "yellow", "min_wpm": 80, "max_wpm": 100},
    {"zone": "green", "min_wpm": 100, "max_wpm": 140},
    {"zone": "yellow", "min_wpm": 140, "max_wpm": 160},
    {"zone": "red", "min_wpm": 160, "max_wpm": float("inf")},
]

# ── Pause detection ─────────────────────────────────────────────────
DEFAULT_PAUSE_THRESHOLD: float = 2.0

# ── Sber transcription ──────────────────────────────────────────────
SBER_SEGMENT_PAUSE_THRESHOLD: float = 0.8
"""Gap between words (seconds) to trigger a new segment."""

SBER_SEGMENT_MAX_WORDS: int = 15
"""Max words in a segment before splitting on punctuation."""

SBER_POLL_INTERVAL: int = 10
"""Seconds between Sber task-status polls."""

SBER_POLL_MAX_RETRIES: int = 90
"""Max status polls before giving up."""

# ── Score labels ────────────────────────────────────────────────────
SCORE_LABELS: list[tuple[float, str]] = [
    (90, "Великолепно"),
    (80, "Отлично"),
    (70, "Хорошо"),
    (55, "Нормально"),
    (40, "Слабо"),
    (0, "Требует внимания"),
]

# ── Gesture advice ──────────────────────────────────────────────────
GESTURE_ADVICE: dict[str, str] = {
    "low": "Вы почти неподвижны (или мы не видим рук). Добавьте энергии!",
    "high": "Очень много движений, попробуйте контролировать жесты.",
    "ok": "Отличная, естественная жестикуляция.",
    "no_data": "Анализ не удался (мало данных)",
}

GESTURE_LOW_THRESHOLD: float = 15.0
GESTURE_HIGH_THRESHOLD: float = 85.0
