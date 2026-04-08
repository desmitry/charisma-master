import json

from fastapi import APIRouter, HTTPException

from app.config import settings
from charisma_schemas import AnalysisResult

router = APIRouter()


@router.get("/analysis/{task_id}", response_model=AnalysisResult)
async def get_analysis(task_id: str):
    """Processing the request for the final analysis results of the presentation."""
    file_path = settings.results_dir / f"{task_id}.json"

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or still processing",
        )

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return data
