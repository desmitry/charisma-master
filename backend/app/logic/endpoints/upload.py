import shutil
import uuid
import os
from enum import Enum
from app.config import settings
from app.logic.tasks import process_video_pipeline
from app.models.schemas import PersonaEnum, UploadResponse
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from rutube import Rutube

router = APIRouter()

class ModelType(str, Enum):
    sber_gigachat = "sber_gigachat"
    whisper_local = "whisper_local"
    whisper_openai = "whisper_openai"


@router.post("/process", response_model=UploadResponse)
async def process_video(
        file: UploadFile = File(None),
        video_url: str = Form(None),
        persona: PersonaEnum = Form(None),
        model_type: ModelType = Form(ModelType.whisper_local),
):
    task_id = str(uuid.uuid4())
    final_path = None

    if file:
        file_ext = file.filename.split(".")[-1]
        file_path = settings.media_root / f"{task_id}.{file_ext}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        final_path = str(file_path)

    elif video_url and "rutube" in video_url.lower():
        try:
            rt = Rutube(video_url.lower())
            res = [int(i) for i in rt.available_resolutions]
            best_res = max(res)
            video = rt.get_by_resolution(best_res)

            video.download(destination=str(settings.media_root))

            list_of_files = list(settings.media_root.glob('*.mp4'))
            if not list_of_files:
                raise HTTPException(status_code=500, detail="Download failed")

            latest_file = max(list_of_files, key=os.path.getctime)

            new_path = settings.media_root / f"{task_id}.mp4"
            shutil.move(str(latest_file), str(new_path))
            final_path = str(new_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Файл или ссылка")

    process_video_pipeline.apply_async(
        args=[task_id, final_path, persona.value if persona else None, model_type.value],
        task_id=task_id,
    )

    return UploadResponse(task_id=task_id, status="queued")
