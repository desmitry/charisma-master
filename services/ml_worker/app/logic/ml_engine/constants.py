"""Constants used across the ML engine modules."""

VISUAL_DEVIATION = 0.25
TARGET_FRAME_WIDTH = 480
MOVEMENT_THRESHOLD = 0.002

BASE_FILLER_WORDS = {
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

# Score label thresholds (score -> Russian label)
SCORE_LABELS = [
    (90, "Великолепно"),
    (80, "Отлично"),
    (70, "Хорошо"),
    (55, "Нормально"),
    (40, "Слабо"),
]
SCORE_LABEL_DEFAULT = "Требует внимания"

# Tempo zone thresholds (WPM boundaries)
TEMPO_ZONE_RED_LOW = 80
TEMPO_ZONE_RED_HIGH = 160
TEMPO_ZONE_YELLOW_LOW = 100
TEMPO_ZONE_YELLOW_HIGH = 140
