from charisma_schemas import AnalysisResult
from charisma_storage import BUCKET_RESULTS, get_object_json
from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter()


@router.get("/analysis/{task_id}", response_model=AnalysisResult)
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
