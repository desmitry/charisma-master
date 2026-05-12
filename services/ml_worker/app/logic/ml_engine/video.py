"""Video analysis: pose, movement, mediapipe, cv2 metrics."""

import logging
import os
from typing import Dict

import cv2
import mediapipe as mp
import numpy as np

from app.logic.ml_engine.config import get_db_weights
from app.logic.ml_engine.constants import (
    MOVEMENT_THRESHOLD_DEFAULT,
    TARGET_FRAME_WIDTH_DEFAULT,
    VISUAL_DEVIATION_DEFAULT,
)
from app.logic.ml_engine.scoring import get_score_label

logger = logging.getLogger(__name__)


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

    gaze_config = get_db_weights("advanced_pnp_iris")
    video_config = get_db_weights("ml_worker_video") or {}

    visual_deviation = video_config.get("visual_deviation", VISUAL_DEVIATION_DEFAULT)
    target_frame_width = video_config.get("target_frame_width", TARGET_FRAME_WIDTH_DEFAULT)
    movement_threshold = video_config.get("movement_threshold", MOVEMENT_THRESHOLD_DEFAULT)
    frames_face_threshold = video_config.get("frames_with_face_threshold", 10)
    frames_pose_threshold = video_config.get("frames_with_pose_threshold", 10)
    gesture_score_multiplier = video_config.get("gesture_score_multiplier", 3500)
    gesture_score_min_threshold = video_config.get("gesture_score_min", 15)
    gesture_score_max_threshold = video_config.get("gesture_score_max", 85)
    
    gesture_advice_min = video_config.get("gesture_advice_min", "Вы почти неподвижны (или мы не видим рук). Добавьте энергии!")
    gesture_advice_max = video_config.get("gesture_advice_max", "Очень много движений, попробуйте контролировать жесты.")
    gesture_advice_normal = video_config.get("gesture_advice_normal", "Отличная, естественная жестикуляция.")
    gesture_advice_fail = video_config.get("gesture_advice_fail", "Анализ не удался (мало данных)")

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
    raw_gaze_data = []

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
                    scale_mp = target_frame_width / width
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

                            gray_frame = cv2.cvtColor(
                                small_frame, cv2.COLOR_BGR2GRAY
                            )
                            brightness = float(np.mean(gray_frame))

                            pitch, raw_yaw = get_head_pose_v2(
                                results.face_landmarks,
                                small_frame.shape[1],
                                small_frame.shape[0],
                                params["landmarks"],
                            )
                            lms_cfg = params["landmarks"]
                            ratio_l = get_gaze_ratio(
                                results.face_landmarks,
                                lms_cfg["left_eye_indices"],
                                lms_cfg["left_iris_indices"],
                            )
                            ratio_r = get_gaze_ratio(
                                results.face_landmarks,
                                lms_cfg["right_eye_indices"],
                                lms_cfg["right_iris_indices"],
                            )
                            avg_gaze = (ratio_l + ratio_r) / 2

                            yaw_offset = params.get("yaw_center_offset", 180.0)
                            yaw = (
                                raw_yaw - yaw_offset
                                if raw_yaw > 0
                                else raw_yaw + yaw_offset
                            )

                            raw_gaze_data.append(
                                {
                                    "pitch": pitch,
                                    "yaw": yaw,
                                    "gaze": avg_gaze,
                                    "brightness": brightness,
                                }
                            )
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
                                if deviation < visual_deviation:
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

                            if delta > movement_threshold:
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

    # Dynamic median baseline two-pass calculation
    if gaze_config and "parameters" in gaze_config and raw_gaze_data:
        params = gaze_config["parameters"]
        median_gaze = float(np.median([d["gaze"] for d in raw_gaze_data]))

        yaw_lim = params["head_pose_thresholds"]["yaw_limit"]
        p_min, p_max = params["head_pose_thresholds"]["pitch_limit"]

        iris_track = params.get("iris_tracking", {})
        dark_threshold = iris_track.get("dark_threshold", 85.0)
        coef = iris_track.get("yaw_gaze_coefficient", 0.0)
        tol = iris_track.get("gaze_tolerance", 0.05)

        hits = 0
        for d in raw_gaze_data:
            if not (p_min < d["pitch"] < p_max) or abs(d["yaw"]) > yaw_lim:
                continue

            if d["brightness"] < dark_threshold:
                hits += 1
            else:
                expected_gaze = median_gaze - (d["yaw"] * coef)
                if abs(d["gaze"] - expected_gaze) < tol:
                    hits += 1

        looking_at_camera_frames += hits

    logger.info("Analyze video debug stats")
    logger.info(f"Total processed frames: {total_frames_processed}")
    logger.info(f"Frames with Face detected: {frames_with_face}")
    logger.info(f"Frames with Pose detected: {frames_with_pose}")
    logger.info(f"Accumulated Movement: {movement_accum}")
    logger.info(f"Frames looking at camera: {looking_at_camera_frames}")

    gaze_score = 0
    if frames_with_face > frames_face_threshold:
        gaze_score = (looking_at_camera_frames / frames_with_face) * 100

    gesture_score = 0
    gesture_advice = gesture_advice_fail

    if frames_with_pose > frames_pose_threshold:
        avg_move = movement_accum / frames_with_pose
        gesture_score = min(avg_move * gesture_score_multiplier, 100)

        if gesture_score < gesture_score_min_threshold:
            gesture_advice = gesture_advice_min
        elif gesture_score > gesture_score_max_threshold:
            gesture_advice = gesture_advice_max
        else:
            gesture_advice = gesture_advice_normal

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
