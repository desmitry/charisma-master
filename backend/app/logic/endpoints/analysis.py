import json

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.models.schemas import AnalysisResult

router = APIRouter()


@router.get(
    "/analysis/{task_id}",
    response_model=AnalysisResult,
    summary="Получить результаты анализа выступления",
    response_description="Полный отчёт: транскрипция, темп, уверенность, LLM-оценка",
    responses={
        404: {"description": "Анализ не найден или ещё обрабатывается"},
    },
)
async def get_analysis(task_id: str):
    """Processing the request for the final analysis results of the presentation.

    Args:
        task_id (str): Task UUID.

    Raises:
        HTTPException: The report could not be found.

    Returns:
        AnalysisResult: JSON containing a task analysis report.
    """
    file_path = settings.results_dir / f"{task_id}.json"

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or still processing",
        )

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return data
