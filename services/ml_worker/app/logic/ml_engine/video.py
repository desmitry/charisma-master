"""Video analysis: pose, movement, mediapipe, cv2 metrics."""

import logging
import os
from typing import Dict

import cv2
import mediapipe as mp
import numpy as np
import psycopg2

from app.config import settings
from app.logic.ml_engine.constants import (
    MOVEMENT_THRESHOLD,
    TARGET_FRAME_WIDTH,
    VISUAL_DEVIATION,
)
from app.logic.ml_engine.scoring import get_score_label

logger = logging.getLogger(__name__)


def get_gaze_config_from_db(weight_id: str) -> dict:
    db_url = settings.database_url

    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT config FROM algorithm_weights WHERE id = %s",
                (weight_id,),
            )
            row = cur.fetchone()
            if row:
                return row[0]
            else:
                logger.warning(
                    f"Gaze config '{weight_id}' not found. Using fallback."
                )
                return None
    except Exception as e:
        logger.error(f"Error fetching gaze config from DB: {e}")
        return None
    finally:
        if "conn" in locals() and conn:
            conn.close()


def get_head_pose_v2(face_landmarks, img_w, img_h, lms_cfg):
    """Calculates Pitch and Yaw using solvePnP."""
    face_2d = []
    model_3d = np.array(
        [
            [0.0, 0.0, 0.0],  # Nose
            [0.0, -330.0, -65.0],  # Chin
            [-225.0, 170.0, -135.0],  # Left eye left corner
            [225.0, 170.0, -135.0],  # Right eye right corner
            [-150.0, -150.0, -125.0],  # Left mouth corner
            [150.0, -150.0, -125.0],  # Right mouth corner
        ],
        dtype=np.float64,
    )

    for idx in lms_cfg["pnp_indices"]:
        lm = face_landmarks.landmark[idx]
        face_2d.append([lm.x * img_w, lm.y * img_h])

    face_2d = np.array(face_2d, dtype=np.float64)
    focal_length = img_w
    cam_matrix = np.array(
        [[focal_length, 0, img_w / 2], [0, focal_length, img_h / 2], [0, 0, 1]]
    )

    success, rot_vec, trans_vec = cv2.solvePnP(
        model_3d, face_2d, cam_matrix, np.zeros((4, 1))
    )
    rmat, _ = cv2.Rodrigues(rot_vec)

    pitch = np.arcsin(-rmat[2, 0])
    yaw = np.arctan2(rmat[2, 1], rmat[2, 2])
    return np.degrees(pitch), np.degrees(yaw)


def get_gaze_ratio(face_landmarks, eye_indices, iris_indices):
    """Calculates relative horizontal position of iris in the eye bounds."""
    lm = face_landmarks.landmark
    x_left = lm[eye_indices[0]].x
    x_right = lm[eye_indices[8]].x
    x_iris = np.mean([lm[i].x for i in iris_indices])

    width = abs(x_right - x_left)
    if width == 0:
        return 0.5
    return (x_iris - min(x_left, x_right)) / width


def analyze_gaze_advanced(face_lms, pitch, raw_yaw, params):
    """Determines if looking at the camera based on head pose and iris."""
    lms_cfg = params["landmarks"]

    yaw_offset = params.get("yaw_center_offset", 180.0)
    yaw = raw_yaw - yaw_offset if raw_yaw > 0 else raw_yaw + yaw_offset

    ratio_l = get_gaze_ratio(
        face_lms, lms_cfg["left_eye_indices"], lms_cfg["left_iris_indices"]
    )
    ratio_r = get_gaze_ratio(
        face_lms, lms_cfg["right_eye_indices"], lms_cfg["right_iris_indices"]
    )
    avg_gaze = (ratio_l + ratio_r) / 2

    yaw_lim = params["head_pose_thresholds"]["yaw_limit"]
    p_min, p_max = params["head_pose_thresholds"]["pitch_limit"]

    is_head_centered = (abs(yaw) < yaw_lim) and (p_min < pitch < p_max)

    iris_track = params.get("iris_tracking", {})
    pitch_offset = params.get("pitch_center_offset", 10.0)
    norm_true_yaw = pitch - pitch_offset

    if "base_gaze" in iris_track:
        base = iris_track["base_gaze"]
        coef = iris_track["yaw_gaze_coefficient"]
        tol = iris_track["gaze_tolerance"]

        # 'pitch' variable contains True Yaw (horizontal turn).
        # Compensate horizontal iris based on True Yaw, not Pitch.
        # True Yaw > 0 (turn right) shifts iris left (ratio decreases).
        # So we must SUBTRACT the offset.
        expected_gaze = base - (yaw * coef)
        is_gaze_centered = (
            (expected_gaze - tol) <= avg_gaze <= (expected_gaze + tol)
        )

        # Для отладки логируем каждый ~25-й кадр
        import random

        if random.random() < 0.04:  # noqa: S311
            import logging

            logging.getLogger(__name__).info(
                f"Gaze Debug: Pitch={pitch:.1f}, NormYaw={yaw:.1f}, "
                f"AvgGaze={avg_gaze:.3f}, Expected={expected_gaze:.3f}, "
                f"Centered={is_gaze_centered}"
            )

        return is_head_centered and is_gaze_centered
    else:
        g_min, g_max = iris_track.get("center_range", [0.4, 0.6])
        is_gaze_centered = g_min < avg_gaze < g_max

        compensation = False
        trigger = iris_track.get("compensation_trigger_yaw", 15)
        # 'pitch' variable contains True Yaw
        if norm_true_yaw < -trigger and avg_gaze < iris_track.get(
            "compensation_ratio_right", 0.45
        ):
            compensation = True
        elif norm_true_yaw > trigger and avg_gaze > iris_track.get(
            "compensation_ratio_left", 0.55
        ):
            compensation = True

        return (is_head_centered and is_gaze_centered) or compensation


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

    gaze_config = get_gaze_config_from_db("advanced_pnp_iris")

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
            refine_face_landmarks=True,
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

                        if gaze_config and "parameters" in gaze_config:
                            params = gaze_config["parameters"]
                            pitch, raw_yaw = get_head_pose_v2(
                                results.face_landmarks,
                                small_frame.shape[1],
                                small_frame.shape[0],
                                params["landmarks"],
                            )
                            if analyze_gaze_advanced(
                                results.face_landmarks, pitch, raw_yaw, params
                            ):
                                looking_at_camera_frames += 1
                        else:
                            face = results.face_landmarks.landmark
                            nose_x = face[1].x
                            left_ear = face[234].x
                            right_ear = face[454].x

                            face_width = abs(right_ear - left_ear)
                            face_center = (left_ear + right_ear) / 2

                            if face_width > 0:
                                deviation = (
                                    abs(nose_x - face_center) / face_width
                                )
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

    logger.info("Analyze video debug stats")
    logger.info(f"Total processed frames: {total_frames_processed}")
    logger.info(f"Frames with Face detected: {frames_with_face}")
    logger.info(f"Frames with Pose detected: {frames_with_pose}")
    logger.info(f"Accumulated Movement: {movement_accum}")
    logger.info(f"Frames looking at camera: {looking_at_camera_frames}")

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
