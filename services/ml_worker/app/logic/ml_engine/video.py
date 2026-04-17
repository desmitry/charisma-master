"""Video analysis: pose, movement, mediapipe, cv2 metrics."""

import logging
import os
from typing import Dict

import cv2
import mediapipe as mp

from app.logic.ml_engine.constants import (
    MOVEMENT_THRESHOLD,
    TARGET_FRAME_WIDTH,
    VISUAL_DEVIATION,
)
from app.logic.ml_engine.scoring import get_score_label

logger = logging.getLogger(__name__)


# TODO: Refactor this function.
def analyze_video(  # noqa: C901
    video_path: str,
) -> Dict:
    """Analyze video file for gaze and gesture metrics.

    Args:
        video_path (str): Path to the video file to analyze.

    Returns:
        Dict: Dictionary containing gaze and gesture scores,
            labels, and advice.
    """
    logger.debug(f"Video Analysis: {video_path}")

    if not os.path.exists(video_path):
        logger.critical(f"File does not exist at path: {video_path}")
        return get_empty_video_metrics()

    file_size = os.path.getsize(video_path)
    logger.debug(f"File size: {file_size / (1024 * 1024):.2f} MB")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.critical("OpenCV could not open the video")
        return get_empty_video_metrics()

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    logger.debug(f"Video Metadata: {width}x{height}, {fps=}, {frame_count=}")

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
            static_image_mode=False,  # For stable and faster tracking
        ) as holistic:
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.debug("End of video stream")
                    break

                total_frames_processed += 1

                # Processed every 5th frame for optimisation
                if total_frames_processed % 5 != 0:
                    continue

                try:
                    scale_mp = TARGET_FRAME_WIDTH / width
                    small_frame = cv2.resize(
                        frame, (0, 0), fx=scale_mp, fy=scale_mp
                    )

                    img_rgb = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
                    img_rgb.flags.writeable = False
                    results = holistic.process(img_rgb)
                    img_rgb.flags.writeable = True

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

                    if results.pose_landmarks:
                        frames_with_pose += 1
                        pl = results.pose_landmarks.landmark

                        # 15: Left Wrist
                        # 16: Right Wrist
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
        logger.critical(f"Global CV Loop crash: {e_global}")
    finally:
        cap.release()

    logger.debug("Analyze video debug stats")
    logger.debug(f"Total processed frames: {total_frames_processed}")
    logger.debug(f"Frames with Face detected: {frames_with_face}")
    logger.debug(f"Frames with Pose detected: {frames_with_pose}")
    logger.debug(f"Accumulated Movement: {movement_accum}")

    # TODO: Remove hardcode values from methods code.
    gaze_score = 0
    if frames_with_face > 10:
        gaze_score = (looking_at_camera_frames / frames_with_face) * 100

    gesture_score = 0
    gesture_advice = "Анализ не удался (мало данных)"

    if frames_with_pose > 10:
        avg_move = movement_accum / frames_with_pose
        gesture_score = min(avg_move * 3500, 100)

        if gesture_score < 15:
            gesture_advice = (
                "Вы почти неподвижны (или мы не видим рук). Добавьте энергии!"
            )
        elif gesture_score > 85:
            gesture_advice = (
                "Очень много движений, попробуйте контролировать жесты."
            )
        else:
            gesture_advice = "Отличная, естественная жестикуляция."

    video_metrics = get_empty_video_metrics()

    video_metrics["gaze_score"] = int(gaze_score)
    video_metrics["gaze_label"] = get_score_label(int(gaze_score))
    video_metrics["gesture_score"] = int(gesture_score)
    video_metrics["gesture_label"] = get_score_label(int(gesture_score))
    video_metrics["gesture_advice"] = gesture_advice

    return video_metrics


def get_empty_video_metrics() -> dict:
    """Return an empty video metrics dictionary with default values.

    Returns:
        dict: Dictionary with default values for gaze and gesture metrics.
    """
    return {
        "gaze_score": 0,
        "gaze_label": "",
        "gesture_score": 0,
        "gesture_label": "",
        "gesture_advice": "",
    }
