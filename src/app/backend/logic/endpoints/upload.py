import shutil
import uuid
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from src.app.backend.config import settings
from src.app.backend.logic.tasks import process_video_pipeline
from src.core.models.schemas import UploadResponse, PersonaEnum

router = APIRouter()


@router.post("/process", response_model=UploadResponse)
async def process_video(
        file: UploadFile = File(None),
        video_url: str = Form(None),
        persona: PersonaEnum = Form(None)
):
    task_id = str(uuid.uuid4())

    if file:
        file_ext = file.filename.split(".")[-1]
        file_path = settings.media_root / f"{task_id}.{file_ext}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        final_path = str(file_path)
    elif video_url:
        # TODO: Реализовать загрузку видео по URL
        # 1. Проверить валидность ссылки
        # 2. Сохранить в settings.media_root с task_id
        # 3. Присвоить final_path путь к скачанному файлу
        raise HTTPException(status_code=501, detail="Не реализовано")
    else:
        raise HTTPException(status_code=400, detail="Файл или ссылка на видео")

    process_video_pipeline.apply_async(
        args=[task_id, final_path, persona.value if persona else None],
        task_id=task_id
    )

    return UploadResponse(task_id=task_id, status="queued")

