from celery.result import AsyncResult
from charisma_schemas import TaskState, TaskStatusResponse
from fastapi import APIRouter

from app.celery_app import celery_app

router = APIRouter()


def _build_task_status_response(task_id: str) -> TaskStatusResponse:
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
        # Never expose internal error details (stack traces, exception
        # messages) to users
        response.error = "Processing failed. Please try again."

    return response


@router.get(
    "/tasks/{task_id}/status",
    response_model=TaskStatusResponse,
    tags=["Status"],
    summary="Получить статус задачи",
    description=(
        "Возвращает текущее состояние задачи обработки выступления. "
        "Возможные состояния:\n\n"
        "- **PENDING** — задача в очереди\n"
        "- **PROCESSING** — выполняется (содержит этап `stage` и "
        "прогресс `progress`)\n"
        "- **SUCCESS** — завершена успешно (`progress=1.0`)\n"
        "- **FAILURE** — завершена с ошибкой (содержит `error`)"
    ),
    response_description="Текущий статус задачи",
)
async def get_task_status(task_id: str):
    """Providing status on the progress of the speech processing task."""
    return _build_task_status_response(task_id)


@router.get(
    "/tasks/{task_id}/wait",
    response_model=TaskStatusResponse,
    tags=["Status"],
    summary="Ожидать статус задачи (polling)",
    description=(
        "Dedicated endpoint для long-polling клиентов, ожидающих "
        "смены состояния задачи. Возвращает ту же структуру "
        "`TaskStatusResponse`, что и `/status`."
    ),
    response_description="Текущий статус задачи",
)
async def wait_task_status(task_id: str):
    """Dedicated polling endpoint for waiting on task processing."""
    return _build_task_status_response(task_id)
