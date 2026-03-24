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
    speech_final_path = None
    evaluation_criteria_final_path = None
    presentation_final_path = None

    # TODO: Add evaluation criteria loader.
    if evaluation_criteria_file:
        pass
    if evaluation_criteria_id:
        pass

    # TODO: Add presentation file loader.
    if user_presentation_file:
        pass

    # TODO: move to alone function.
    if user_speech_file:
        if user_speech_file.filename is None:
            raise HTTPException(status_code=400, detail="Некоретное название файла")

        video_extension = user_speech_file.filename.split(".")[-1]
        video_path = settings.media_root / f"{task_id}.{video_extension}"

        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(user_speech_file.file, buffer)

        speech_final_path = str(video_path)

    # TODO: move to alone function.
    if user_speech_url:
        # TODO: Make better regular expression.
        if "rutube.ru" not in user_speech_url:
            raise HTTPException(
                status_code=400,
                detail="Ссылка должна быть на rutube.ru",
            )

        try:
            rt = Rutube(user_speech_url.lower())
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

            # README:
            # The 'command' variable cannot contain an embedded injection.
            # The input data consists of a simple UUID and a string containing the UUID.
            # The `command` variable must not contain strings that are vulnerable to injection.
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

            subprocess.run(  # noqa: S603
                command,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )

            if temp_path.exists():
                os.remove(temp_path)

            speech_final_path = str(file_path)

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

    process_video_pipeline.apply_async(
        kwargs={
            "task_id": task_id,
            "user_speech_path": speech_final_path,
            "evaluation_criteria_path": evaluation_criteria_final_path,
            "user_presentation_path": presentation_final_path,
            "analyze_provider": analyze_provider,
            "transcribe_provider": transcribe_provider,
            "persona": persona,
        },
        task_id=task_id,
    )

    return UploadResponse(task_id=task_id)
