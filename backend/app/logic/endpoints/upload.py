import shutil
import uuid
from enum import Enum

from app.config import settings
from app.logic.tasks import process_video_pipeline
from app.models.schemas import LLMProviderEnum, PersonaEnum, UploadResponse
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from rutube import Rutube

router = APIRouter()


class ModelType(str, Enum):
    sber_gigachat = "sber_gigachat"
    whisper_local = "whisper_local"
    whisper_openai = "whisper_openai"


@router.post("/process", response_model=UploadResponse)
async def process_video(
    file: UploadFile | None = File(None),
    video_url: str = Form(None),
    persona: PersonaEnum = Form(None),
    analyze_llm_provider: LLMProviderEnum = Form(None),
    transcribe_model: ModelType = Form(ModelType.whisper_local),
    do_slides: bool = Form(False),
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

            file_path = settings.media_root / f"{task_id}.mp4"
            video = rt.get_best()
            if not video:
                raise HTTPException(status_code=500, detail="Download failed: video unavailable")
            with open(file_path, "wb") as f:
                video.download(stream=f)
            final_path = str(file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Файл или ссылка")

    process_video_pipeline.apply_async(
        args=[
            task_id,
            final_path,
            analyze_llm_provider.value,
            (
                settings.openai_model_name
                if analyze_llm_provider == LLMProviderEnum.openai
                else settings.gigachat_model_name
            ),
            transcribe_model.value,
            persona.value if persona else None,
            do_slides.value,
        ],
        task_id=task_id,
    )

    return UploadResponse(task_id=task_id, status="queued")
