from charisma_schemas import AnalysisResult
from charisma_storage import BUCKET_RESULTS, get_object_json
from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter()


@router.get(
    "/analysis/{task_id}",
    response_model=AnalysisResult,
    summary="Получить результаты анализа",
    description=(
        "Возвращает полный результат анализа выступления: "
        "транскрипцию, темп речи, паузы, оценки по критериям, "
        "confidence index и LLM-отчёт."
    ),
    response_description="Результат анализа выступления",
    responses={
        404: {
            "description": "Результат не найден или задача ещё обрабатывается",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Analysis not found or still processing"
                    }
                }
            },
        },
    },
)
async def get_analysis(task_id: str):
    """Get analysis results from SeaweedFS."""
    try:
        data = get_object_json(
            settings.seaweedfs_endpoint,
            BUCKET_RESULTS,
            f"{task_id}.json",
            settings.seaweedfs_access_key,
            settings.seaweedfs_secret_key,
        )
        return data
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or still processing",
        )
