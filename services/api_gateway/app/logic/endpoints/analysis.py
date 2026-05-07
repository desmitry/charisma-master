from charisma_schemas import AnalysisResult
from charisma_storage import BUCKET_RESULTS, get_object_json
from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import require_view_own_analysis
from app.config import settings

router = APIRouter()


@router.get(
    "/analysis/{task_id}",
    response_model=AnalysisResult,
    summary="Получить результаты анализа",
    description="Возвращает полный результат анализа выступления.",
)
async def get_analysis(
    task_id: str,
    user_info: dict = Depends(require_view_own_analysis),
):
    """Get analysis results from SeaweedFS.

    Checks that the analysis result contains user_id
    matching the authenticated user.
    """
    try:
        data = get_object_json(
            settings.seaweedfs_endpoint,
            BUCKET_RESULTS,
            f"{task_id}.json",
            settings.seaweedfs_access_key,
            settings.seaweedfs_secret_key,
        )
        # Verify user can only view their own analysis
        if data.get("user_id") != user_info["sub"]:
            raise HTTPException(
                status_code=403, detail="Not enough permissions"
            )
        return data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=404, detail="Analysis not found or still processing"
        )
