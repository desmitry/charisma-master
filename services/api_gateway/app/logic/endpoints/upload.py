import logging
import os
import subprocess
import tempfile
import uuid
from typing import Optional

import psycopg2
from charisma_schemas import (
    AnalyzeProvider,
    PersonaRoles,
    TranscribeProvider,
    UploadResponse,
)
from charisma_storage import BUCKET_UPLOADS, upload_file
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from rutube import Rutube

from app.celery_app import celery_app
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm", "m4v"}


def _convert_to_faststart(input_path: str, output_path: str):
    """Convert video to faststart MP4 for browser streaming support."""
    # README: subprocess call is safe.
    # Arguments are internally generated via tempfile with UUID names,
    # never from user input, shell=False.
    # ffmpeg is installed in the Docker image, PATH is controlled.
    subprocess.run(  # noqa: S603
        [  # noqa: S607
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            output_path,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )


def _upload_to_seaweedfs(task_id: str, uploaded_file: UploadFile) -> str:
    """Save uploaded file, convert video to faststart MP4, upload to SeaweedFS.

    Returns:
        str: Object key in SeaweedFS (e.g. "{task_id}.mp4").
    """
    if uploaded_file.filename is None:
        raise HTTPException(
            status_code=400, detail="Некорректное название файла"
        )

    file_extension = uploaded_file.filename.split(".")[-1].lower()
    content = uploaded_file.file.read()

    if file_extension in VIDEO_EXTENSIONS:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=f".{file_extension}"
        ) as tmp_in:
            tmp_in.write(content)
            tmp_in.flush()

            tmp_out = tmp_in.name + ".faststart.mp4"
            try:
                _convert_to_faststart(tmp_in.name, tmp_out)
                object_key = f"{task_id}.mp4"
                upload_file(
                    settings.seaweedfs_endpoint,
                    BUCKET_UPLOADS,
                    object_key,
                    tmp_out,
                    settings.seaweedfs_access_key,
                    settings.seaweedfs_secret_key,
                )
            finally:
                os.unlink(tmp_in.name)
                if os.path.exists(tmp_out):
                    os.unlink(tmp_out)
    else:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=f".{file_extension}"
        ) as tmp:
            tmp.write(content)
            tmp.flush()
            object_key = f"{task_id}.{file_extension}"
            upload_file(
                settings.seaweedfs_endpoint,
                BUCKET_UPLOADS,
                object_key,
                tmp.name,
                settings.seaweedfs_access_key,
                settings.seaweedfs_secret_key,
            )
            os.unlink(tmp.name)

    return object_key


def _load_criteria_preset(criteria_id: str) -> list[dict]:
    """Load evaluation criteria preset from Postgres.

    Returns:
        list[dict]: List of criteria dictionaries.
    """
    logger.info(f"Loading criteria preset: id={criteria_id}")
    conn = psycopg2.connect(settings.database_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT criteria FROM presets WHERE id = %s",
                (criteria_id,),
            )
            row = cur.fetchone()
            if row is None:
                logger.error(f"Preset '{criteria_id}' not found in DB")
                raise HTTPException(
                    status_code=404,
                    detail=f"Пресет с критериями '{criteria_id}' не найден",
                )
            logger.info(f"Preset '{criteria_id}' loaded successfully")
            return row[0]
    finally:
        conn.close()


def _download_user_speech_from_rutube(task_id: str, video_url: str) -> str:
    """Download from RuTube, convert to faststart MP4, upload to SeaweedFS.

    Returns:
        str: Object key in SeaweedFS (e.g. "{task_id}.mp4").
    """
    if "rutube.ru" not in video_url:
        raise HTTPException(
            status_code=400, detail="Ссылка должна быть на rutube.ru"
        )

    try:
        rt = Rutube(video_url.lower())
        rutube_video = rt.get_best()
        if not rutube_video:
            raise HTTPException(
                status_code=500, detail="Ошибка загрузки: видео недоступно"
            )

        with tempfile.NamedTemporaryFile(
            delete=False, suffix=".tmp"
        ) as tmp_dl:
            rutube_video.download(stream=tmp_dl)
            tmp_dl.flush()

            if (
                not os.path.exists(tmp_dl.name)
                or os.path.getsize(tmp_dl.name) == 0
            ):
                os.unlink(tmp_dl.name)
                raise HTTPException(
                    status_code=500,
                    detail="Ошибка загрузки: скачанный файл пустой",
                )

            tmp_out = tmp_dl.name + ".faststart.mp4"
            try:
                _convert_to_faststart(tmp_dl.name, tmp_out)

                object_key = f"{task_id}.mp4"
                upload_file(
                    settings.seaweedfs_endpoint,
                    BUCKET_UPLOADS,
                    object_key,
                    tmp_out,
                    settings.seaweedfs_access_key,
                    settings.seaweedfs_secret_key,
                )
                return object_key
            finally:
                os.unlink(tmp_dl.name)
                if os.path.exists(tmp_out):
                    os.unlink(tmp_out)

    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.decode() if e.stderr else "Unknown error"
        logger.error("FFmpeg conversion failed: %s", err_msg)
        raise HTTPException(
            status_code=500, detail="Ошибка преобразования видео"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Video download error: {e}")
        raise HTTPException(status_code=500, detail="Неизвестная ошибка")


@router.post(
    "/process",
    response_model=UploadResponse,
    summary="Загрузить выступление на анализ",
    description=(
        "Принимает видео- или аудиофайл выступления (либо ссылку на RuTube), "
        "файл/пресет критериев оценки, а также необязательные текстовый файл "
        "выступления и файл презентации. Запускает асинхронный пайплайн "
        "обработки и возвращает идентификатор задачи для отслеживания."
    ),
    response_description="Идентификатор созданной задачи",
    responses={
        400: {
            "description": "Некорректные параметры запроса",
            "content": {
                "application/json": {
                    "example": {
                        "detail": (
                            "Не указан источник для базового анализа "
                            "(текст или видео)"
                        )
                    }
                }
            },
        },
        500: {
            "description": "Внутренняя ошибка сервера",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Ошибка преобразования видео"
                    }
                }
            },
        },
    },
)
async def process(
    user_speech_video_file: Optional[UploadFile] = File(None),
    user_speech_video_url: Optional[str] = Form(None),
    user_speech_text_file: Optional[UploadFile] = File(None),
    user_need_text_from_video: bool = Form(False),
    user_need_video_analysis: bool = Form(False),
    user_presentation_file: Optional[UploadFile] = File(None),
    evaluation_criteria_file: Optional[UploadFile] = File(None),
    evaluation_criteria_id: Optional[str] = File(None),
    persona: PersonaRoles = Form(PersonaRoles.speech_review_specialist),
    analyze_provider: AnalyzeProvider = Form(AnalyzeProvider.gigachat),
    transcribe_provider: TranscribeProvider = Form(
        TranscribeProvider.sber_gigachat
    ),
):
    """Process user speech video for analysis."""
    has_text_file = user_speech_text_file is not None
    has_video = (user_speech_video_file is not None) or (
        user_speech_video_url is not None
    )
    needs_transcription = user_need_text_from_video and has_video
    has_text_source = has_text_file or needs_transcription

    if not (has_text_source or user_need_video_analysis):
        raise HTTPException(
            status_code=400,
            detail="Не указан источник для базового анализа (текст или видео)",
        )

    task_id = str(uuid.uuid4())
    logger.info(f"Processing task {task_id}")

    text_key = None
    if user_speech_text_file:
        text_key = _upload_to_seaweedfs(
            task_id,
            user_speech_text_file,
        )
        logger.info(
            f"Upload text file to SeaweedFS: {text_key}",
        )

    video_key = None
    if user_speech_video_file:
        video_key = _upload_to_seaweedfs(
            task_id,
            user_speech_video_file,
        )
        logger.info(
            f"Uploaded video file to SeaweedFS: {video_key}",
        )
    if user_speech_video_url:
        video_key = _download_user_speech_from_rutube(
            task_id,
            user_speech_video_url,
        )
        logger.info(
            f"Uploaded video file (Rutube) to SeaweedFS: {video_key}",
        )

    presentation_key = None
    if user_presentation_file:
        presentation_key = _upload_to_seaweedfs(
            task_id,
            user_presentation_file,
        )
        logger.info(
            f"Uploaded presentation file to SeaweedFS: {presentation_key}",
        )

    evaluation_criteria_key = None
    evaluation_criteria_preset = None
    if evaluation_criteria_file:
        evaluation_criteria_key = _upload_to_seaweedfs(
            task_id, evaluation_criteria_file
        )
        logger.info(
            f"Uploaded criteria file to SeaweedFS: {evaluation_criteria_key}",
        )
    if evaluation_criteria_id:
        evaluation_criteria_preset = _load_criteria_preset(
            evaluation_criteria_id
        )
        logger.info(
            f"Using criteria preset: {evaluation_criteria_preset}",
        )

    celery_app.send_task(
        "app.logic.tasks.process_video_pipeline",
        kwargs={
            "task_id": task_id,
            "speech_video_key": video_key,
            "speech_text_key": text_key,
            "need_text_from_video": user_need_text_from_video,
            "need_video_analysis": user_need_video_analysis,
            "presentation_key": presentation_key,
            "evaluation_criteria_key": evaluation_criteria_key,
            "evaluation_criteria_preset": evaluation_criteria_preset,
            "persona": persona.value,
            "analyze_provider": analyze_provider.value,
            "transcribe_provider": transcribe_provider.value,
        },
        task_id=task_id,
    )

    return UploadResponse(task_id=task_id)
