import shutil
import uuid

from app.config import settings
from app.logic.tasks import process_video_pipeline
from app.models.schemas import PersonaEnum, UploadResponse
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from rutube import Rutube

router = APIRouter()


@router.post("/process", response_model=UploadResponse)
async def process_video(
    file: UploadFile = File(None),
    video_url: str = Form(None),
    persona: PersonaEnum = Form(None),
):
    task_id = str(uuid.uuid4())

    if file:
        file_ext = file.filename.split(".")[-1]
        file_path = settings.media_root / f"{task_id}.{file_ext}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        final_path = str(file_path)
    elif video_url and "rutube" in video_url.lower():
        try:
            rt = Rutube(video_url.lower())
            # 720p or higher, raises `IndexError`
            res = [int(i) for i in rt.available_resolutions if int(i) >= 720][0]
            video = rt.get_by_resolution(res)
            if video is None:
                raise HTTPException(status_code=500, detail="Scraper broke")
            video.download(destination=settings.media_root)
            final_path = str(settings.media_root / f"{task_id}.mp4")
        except IndexError:
            raise HTTPException(status_code=400, detail="No supported resolution")
        except Exception as e:  # rutube-downloader raises `Exception`
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Файл или ссылка на видео")

    process_video_pipeline.apply_async(
        args=[task_id, final_path, persona],
        task_id=task_id,
    )

    return UploadResponse(task_id=task_id, status="queued")
