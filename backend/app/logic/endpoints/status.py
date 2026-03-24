from celery.result import AsyncResult
from fastapi import APIRouter

from app.celery_app import celery_app
from app.models.schemas import TaskState, TaskStatusResponse

router = APIRouter()


@router.get("/tasks/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)

    response = TaskStatusResponse(
        task_id=task_id,
        state=TaskState.queued,
        hint=TaskState.queued.hint,
    )

    if task_result.state == TaskState.queued:
        response.state = TaskState.queued
        response.hint = TaskState.queued.hint

    elif task_result.state == TaskState.processing:
        response.state = TaskState.processing
        response.hint = TaskState.processing.hint
        info = task_result.info
        if isinstance(info, dict):
            response.stage = info.get("stage")
            response.progress = info.get("progress", 0.0)
            response.hint = info.get("hint", response.hint)

    elif task_result.state == TaskState.finished:
        response.state = TaskState.finished
        response.hint = TaskState.finished.hint
        response.progress = 1.0

    elif task_result.state == TaskState.failed:
        response.state = TaskState.failed
        response.hint = TaskState.failed.hint
        response.error = str(task_result.info)

    return response
