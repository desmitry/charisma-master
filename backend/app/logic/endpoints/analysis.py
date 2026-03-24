import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import settings
from app.models.schemas import AnalysisResult

router = APIRouter()


@router.get("/analysis/{task_id}", response_model=AnalysisResult)
async def get_analysis(task_id: str):
    file_path = settings.results_dir / f"{task_id}.json"

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or still processing",
        )

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return data


@router.get("/analysis/{task_id}/pdf")
async def get_pdf(task_id: str):
    file_path = settings.results_dir / f"{task_id}.pdf"
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="PDF not found",
        )

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=f"report_{task_id}.pdf",
    )
