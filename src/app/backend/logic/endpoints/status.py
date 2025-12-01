from fastapi import APIRouter
from celery.result import AsyncResult
from src.core.models.schemas import TaskStatusResponse, ProcessingState
from src.app.backend.celery_app import celery_app

router = APIRouter()


@router.get("/tasks/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)

    response = TaskStatusResponse(
        task_id=task_id,
        state=ProcessingState.queued
    )

    if task_result.state == 'PENDING':
        response.state = ProcessingState.queued
    elif task_result.state == 'PROCESSING':
        response.state = ProcessingState.processing
        info = task_result.info
        if isinstance(info, dict):
            response.stage = info.get('stage')
            response.progress = info.get('progress', 0.0)
    elif task_result.state == 'SUCCESS':
        response.state = ProcessingState.finished
        response.progress = 1.0
    elif task_result.state == 'FAILURE':
        response.state = ProcessingState.failed
        response.error = str(task_result.info)

    return response

