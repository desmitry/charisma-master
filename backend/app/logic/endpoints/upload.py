import shutil
import uuid
from enum import Enum
import subprocess
import os
import logging
from app.config import settings
from app.logic.tasks import process_video_pipeline
from app.models.schemas import LLMProviderEnum, PersonaEnum, UploadResponse
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from rutube import Rutube

router = APIRouter()
logger = logging.getLogger(__name__)

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
    do_slides: bool = Form(True),
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

            temp_path = settings.media_root / f"temp_{task_id}"

            video = rt.get_best()
            if not video:
                raise HTTPException(status_code=500, detail="Download failed: video unavailable")

            with open(temp_path, "wb") as f:
                video.download(stream=f)

            if not temp_path.exists() or temp_path.stat().st_size == 0:
                raise HTTPException(status_code=500, detail="Downloaded file is empty")

            file_path = settings.media_root / f"{task_id}.mp4"

            command = [
                "ffmpeg", "-y",
                "-i", str(temp_path),
                "-c", "copy",
                "-movflags", "+faststart",
                str(file_path)
            ]

            logger.info(f"Remuxing Rutube video: {' '.join(command)}")
            subprocess.run(
                command,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE
            )

            if temp_path.exists():
                os.remove(temp_path)

            final_path = str(file_path)


        except subprocess.CalledProcessError as e:
            err_msg = e.stderr.decode() if e.stderr else "Unknown FFmpeg error"

            logger.error(f"FFmpeg conversion failed: {err_msg}")
            if 'temp_path' in locals() and temp_path.exists():
                os.remove(temp_path)

            raise HTTPException(status_code=500, detail=f"Video conversion failed: {err_msg}")

        except Exception as e:
            logger.error(f"Rutube download error: {e}")
            if 'temp_path' in locals() and temp_path.exists():
                os.remove(temp_path)
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
            do_slides,
        ],
        task_id=task_id,
    )

    return UploadResponse(task_id=task_id, status="queued")
