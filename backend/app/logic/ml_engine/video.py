"""Video analysis: gaze direction and gesture intensity via MediaPipe."""

import logging
import os
from typing import Dict

import cv2
import mediapipe as mp

from app.logic.ml_engine.constants import (
    FRAME_SKIP,
    GESTURE_ADVICE,
    GESTURE_HIGH_THRESHOLD,
    GESTURE_LOW_THRESHOLD,
    GESTURE_MULTIPLIER,
    MIN_FRAMES_FOR_DETECTION,
    MOVEMENT_THRESHOLD,
    TARGET_FRAME_WIDTH,
    VISUAL_DEVIATION,
)
from app.logic.ml_engine.scoring import get_score_label

logger = logging.getLogger(__name__)


def get_empty_video_metrics() -> Dict:
    """Return a default video metrics dict."""
    return {
        "gaze_score": 0,
        "gaze_label": "",
        "gesture_score": 0,
        "gesture_label": "",
        "gesture_advice": "",
    }


# ── Internal helpers ────────────────────────────────────────────────


def _compute_gaze(
    frames_with_face: int,
    looking_at_camera: int,
) -> tuple[int, str]:
    """Compute gaze score and label."""
    if frames_with_face <= MIN_FRAMES_FOR_DETECTION:
        return 0, ""
    score = int((looking_at_camera / frames_with_face) * 100)
    return score, get_score_label(score)


def _compute_gesture(
    frames_with_pose: int,
    movement_accum: float,
) -> tuple[int, str, str]:
    """Compute gesture score, label, and advice."""
    if frames_with_pose <= MIN_FRAMES_FOR_DETECTION:
        return 0, "", GESTURE_ADVICE["no_data"]

    avg_move = movement_accum / frames_with_pose
    score = int(min(avg_move * GESTURE_MULTIPLIER, 100))

    if score < GESTURE_LOW_THRESHOLD:
        advice = GESTURE_ADVICE["low"]
    elif score > GESTURE_HIGH_THRESHOLD:
        advice = GESTURE_ADVICE["high"]
    else:
        advice = GESTURE_ADVICE["ok"]

    return score, get_score_label(score), advice


# ── Public API ──────────────────────────────────────────────────────


def analyze_video(video_path: str) -> Dict:
    """Analyse a video for gaze direction and gesture intensity.

    Uses MediaPipe Holistic to detect face landmarks (gaze) and
    pose landmarks (wrist movement) on every N-th frame.

    Args:
        video_path: Path to the video file.

    Returns:
        Dict with ``gaze_score``, ``gaze_label``, ``gesture_score``,
        ``gesture_label``, ``gesture_advice``.
    """
    logger.debug("Video Analysis: %s", video_path)

    if not os.path.exists(video_path):
        logger.critical("File does not exist at path: %s", video_path)
        return get_empty_video_metrics()

    file_size = os.path.getsize(video_path)
    logger.debug("File size: %.2f MB", file_size / (1024 * 1024))

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.critical("OpenCV could not open the video")
        return get_empty_video_metrics()

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    logger.debug("Video Metadata: %dx%d, fps=%s, frame_count=%d", width, height, fps, frame_count)

    mp_holistic = mp.solutions.holistic

    total_frames_processed = 0
    frames_with_face = 0
    frames_with_pose = 0
    looking_at_camera_frames = 0

    movement_accum = 0.0
    prev_wrist = {"left": None, "right": None}

    try:
        with mp_holistic.Holistic(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            model_complexity=1,
            static_image_mode=False,
        ) as holistic:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                total_frames_processed += 1
                if total_frames_processed % FRAME_SKIP != 0:
                    continue

                try:
                    scale = TARGET_FRAME_WIDTH / width
                    small_frame = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
                    img_rgb = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
                    img_rgb.flags.writeable = False
                    results = holistic.process(img_rgb)
                    img_rgb.flags.writeable = True

                    # ── Gaze ────────────────────────────────────
                    if results.face_landmarks:
                        frames_with_face += 1
                        face = results.face_landmarks.landmark
                        nose_x = face[1].x
                        left_ear = face[234].x
                        right_ear = face[454].x
                        face_width = abs(right_ear - left_ear)
                        face_center = (left_ear + right_ear) / 2

                        if face_width > 0:
                            deviation = abs(nose_x - face_center) / face_width
                            if deviation < VISUAL_DEVIATION:
                                looking_at_camera_frames += 1

                    # ── Gesture ─────────────────────────────────
                    if results.pose_landmarks:
                        frames_with_pose += 1
                        pl = results.pose_landmarks.landmark
                        lw = (pl[15].x, pl[15].y)
                        rw = (pl[16].x, pl[16].y)

                        if prev_wrist["left"] is not None:
                            d_left = (
                                (lw[0] - prev_wrist["left"][0]) ** 2
                                + (lw[1] - prev_wrist["left"][1]) ** 2
                            ) ** 0.5
                            d_right = (
                                (rw[0] - prev_wrist["right"][0]) ** 2
                                + (rw[1] - prev_wrist["right"][1]) ** 2
                            ) ** 0.5
                            delta = d_left + d_right
                            if delta > MOVEMENT_THRESHOLD:
                                movement_accum += delta

                        prev_wrist = {"left": lw, "right": rw}
                    else:
                        prev_wrist = {"left": None, "right": None}

                except Exception as e_mp:
                    logger.error(
                        "MediaPipe processing error at frame %d: %s",
                        total_frames_processed,
                        e_mp,
                    )

    except Exception as e_global:
        logger.critical("Global CV Loop crash: %s", e_global)
    finally:
        cap.release()

    logger.debug("Total processed frames: %d", total_frames_processed)
    logger.debug("Frames with Face: %d", frames_with_face)
    logger.debug("Frames with Pose: %d", frames_with_pose)
    logger.debug("Accumulated Movement: %s", movement_accum)

    gaze_score, gaze_label = _compute_gaze(frames_with_face, looking_at_camera_frames)
    gesture_score, gesture_label, gesture_advice = _compute_gesture(
        frames_with_pose, movement_accum
    )

    return {
        "gaze_score": gaze_score,
        "gaze_label": gaze_label,
        "gesture_score": gesture_score,
        "gesture_label": gesture_label,
        "gesture_advice": gesture_advice,
    }
