import logging
import os
import shutil
import subprocess
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from rutube import Rutube

from app.config import settings
from app.logic.tasks import process_video_pipeline
from app.models.schemas import AnalyzeProvider, PersonaRoles, TranscribeProvider, UploadResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _download_uploaded_file(task_id: str, uploaded_file: UploadFile) -> str:
    """Downloading the user uploaded file.

    Args:
        task_id (str): Task UUID.
        uploaded_file (UploadFile): User uploaded file.

    Raises:
        HTTPException: If the uploaded file has no filename.

    Returns:
        str: Absolute path to the saved file.
    """
    if uploaded_file.filename is None:
        raise HTTPException(status_code=400, detail="Некоретное название файла")

    file_extension = uploaded_file.filename.split(".")[-1]
    file_path = settings.media_root / f"{task_id}.{file_extension}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(uploaded_file.file, buffer)

    return str(file_path)


def _download_user_speech_from_rutube(task_id: str, video_url: str) -> str:
    """Downloading user speech video from Rutube.

    Args:
        task_id (str): Task UUID.
        video_url (str): User rutube video url.

    Raises:
        HTTPException: If the URL does not contain 'rutube.ru'.
        HTTPException: If the video is unavailable or cannot be retrieved.
        HTTPException: If the downloaded file is empty.
        HTTPException: If FFmpeg video conversion fails.
        HTTPException: If an unknown error occurs during download.

    Returns:
        str: Absolute path to the saved file.
    """

    # TODO: Create a more relevant regular expression.
    if "rutube.ru" not in video_url:
        raise HTTPException(
            status_code=400,
            detail="Ссылка должна быть на rutube.ru",
        )

    try:
        rt = Rutube(video_url.lower())
        rutube_video = rt.get_best()

        if not rutube_video:
            raise HTTPException(
                status_code=500,
                detail="Ошибка загрузки: видео недоступно",
            )

        temp_path = settings.media_root / f"temp_{task_id}"

        with open(temp_path, "wb") as buffer:
            rutube_video.download(stream=buffer)

        if not temp_path.exists() or temp_path.stat().st_size == 0:
            raise HTTPException(
                status_code=500,
                detail="Ошибка загрузки: cкачанный файл пустой",
            )

        file_path = settings.media_root / f"{task_id}.mp4"

        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(temp_path),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(file_path),
        ]
        logger.info(f"Remuxing Rutube video using: {' '.join(command)}")

        # README:
        # The 'command' variable cannot contain an embedded injection.
        # The input data consists of a simple UUID and a string containing the UUID.
        # The `command` variable must not contain strings that are vulnerable to injection.
        subprocess.run(  # noqa: S603
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )

        if temp_path.exists():
            os.remove(temp_path)

        return str(file_path)

    except subprocess.CalledProcessError as e:
        if e.stderr:
            err_msg = e.stderr.decode()
        else:
            err_msg = "Unknown error"

        logger.error(f"FFmpeg conversion failed: {err_msg}")

        if "temp_path" in locals() and temp_path.exists():
            os.remove(temp_path)

        raise HTTPException(status_code=500, detail=f"Ошибка преобразования видео: {err_msg}")

    except Exception as e:
        logger.error(f"Video download error: {e}")

        if "temp_path" in locals() and temp_path.exists():
            os.remove(temp_path)

        raise HTTPException(status_code=500, detail="Неизвестная ошибка")


@router.post("/process", response_model=UploadResponse)
async def process(
    user_speech_file: Optional[UploadFile] = File(None),
    user_speech_url: Optional[str] = Form(None),
    evaluation_criteria_file: Optional[UploadFile] = File(None),
    evaluation_criteria_id: Optional[str] = File(None),
    user_presentation_file: Optional[UploadFile] = File(None),
    persona: PersonaRoles = Form(PersonaRoles.speech_review_specialist),
    analyze_provider: AnalyzeProvider = Form(AnalyzeProvider.gigachat),
    transcribe_provider: TranscribeProvider = Form(TranscribeProvider.sber_gigachat),
):
    """Process user speech video for analysis.

    Args:
        user_speech_file (Optional[UploadFile], optional):
            User uploaded speech video file.
            Defaults to File(None).
        user_speech_url (Optional[str], optional):
            URL to the speech video on Rutube.
            Defaults to Form(None).
        evaluation_criteria_file (Optional[UploadFile], optional):
            User uploaded evaluation criteria file.
            Defaults to File(None).
        evaluation_criteria_id (Optional[str], optional):
            ID of a predefined evaluation criteria preset.
            Defaults to File(None).
        user_presentation_file (Optional[UploadFile], optional):
            User uploaded presentation file.
            Defaults to File(None).
        persona (PersonaRoles, optional):
            AI persona role for analysis.
            Defaults to Form(PersonaRoles.speech_review_specialist).
        analyze_provider (AnalyzeProvider, optional):
            Provider for AI analysis.
            Defaults to Form(AnalyzeProvider.gigachat).
        transcribe_provider (TranscribeProvider, optional):
            Provider for speech transcription.
            Defaults to Form(TranscribeProvider.sber_gigachat).

    Raises:
        HTTPException: If neither or both speech sources (file/url) are provided.
        HTTPException: If neither or both criteria sources (file/id) are provided.

    Returns:
        UploadResponse: JSON containing a task upload report.
    """

    if (user_speech_file is None) == (user_speech_url is None):
        raise HTTPException(
            status_code=400,
            detail="Необходимо загрузить либо видео выступления, либо ссылку на него",
        )

    if (evaluation_criteria_file is None) == (evaluation_criteria_id is None):
        raise HTTPException(
            status_code=400,
            detail="Необходимо загрузить файл критерии оценивания, либо выбрать один из пресетов",
        )

    task_id = str(uuid.uuid4())

    # TODO: Add evaluation criteria loader.
    # You might be able to use the same method as for `user_speech_file`
    evaluation_criteria_final_path = None
    if evaluation_criteria_file:
        pass
    if evaluation_criteria_id:
        pass

    # TODO: Add presentation file loader.
    # You might be able to use the same method as for `user_speech_file`
    presentation_final_path = None
    if user_presentation_file:
        pass

    speech_final_path = None
    if user_speech_file:
        speech_final_path = _download_uploaded_file(task_id, user_speech_file)

    if user_speech_url:
        speech_final_path = _download_user_speech_from_rutube(task_id, user_speech_url)

    process_video_pipeline.apply_async(
        kwargs={
            "task_id": task_id,
            "speech_video_path": speech_final_path,
            "evaluation_criteria_path": evaluation_criteria_final_path,
            "presentation_path": presentation_final_path,
            "analyze_provider": analyze_provider,
            "transcribe_provider": transcribe_provider,
            "persona": persona,
        },
        task_id=task_id,
    )

    return UploadResponse(task_id=task_id)
