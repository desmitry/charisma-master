import re

from charisma_storage import (
    BUCKET_UPLOADS,
    ensure_buckets_exist,
    get_client,
)
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware

from app.config import settings
from app.logic.endpoints import analysis, status, upload

if settings.mode == "prod" and settings.origin_url == "*":
    raise Exception("You need to specify a specific url for production!")

origins = [settings.origin_url]

OPENAPI_TAGS = [
    {
        "name": "Processing",
        "description": "Загрузка и запуск обработки выступлений.",
    },
    {
        "name": "Status",
        "description": "Отслеживание прогресса задач анализа.",
    },
    {
        "name": "Analysis",
        "description": "Получение результатов анализа выступлений.",
    },
    {
        "name": "Health",
        "description": "Проверка работоспособности сервиса.",
    },
    {
        "name": "Media",
        "description": "Потоковая передача медиафайлов.",
    },
]

app = FastAPI(
    title="Charisma — Speech Analysis API",
    summary="REST API для анализа публичных выступлений",
    description=(
        "Сервис принимает видео- или аудиозаписи выступлений, выполняет "
        "транскрибацию и многокритериальный анализ с помощью LLM. "
        "Результаты включают оценки по критериям, рекомендации и "
        "детализированную обратную связь."
    ),
    version="1.0.0",
    contact={
        "name": "Charisma Team",
        "url": "https://github.com/desmitry/charisma",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    openapi_tags=OPENAPI_TAGS,
    servers=[
        {
            "url": "http://localhost:8000",
            "description": "Локальная разработка",
        },
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ensure_buckets_exist(
    settings.seaweedfs_endpoint,
    settings.seaweedfs_access_key,
    settings.seaweedfs_secret_key,
)


@app.get(
    "/health",
    tags=["Health"],
    summary="Проверка здоровья сервиса",
    response_description="Статус работоспособности",
)
async def health_check():
    """Возвращает статус работоспособности API-шлюза."""
    return {"status": "ok"}


@app.get(
    "/media/{task_id}.mp4",
    tags=["Media"],
    summary="Потоковое воспроизведение видео",
    response_description="Видео-файл в формате MP4 с поддержкой HTTP Range",
    responses={
        404: {
            "description": "Видео не найдено",
            "content": {
                "application/json": {
                    "example": {"detail": "Video not found"}
                }
            },
        },
        416: {
            "description": "Невалидный заголовок Range",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid Range header"}
                }
            },
        },
    },
)
async def stream_video(task_id: str, request: Request):
    """Stream a video file from SeaweedFS with HTTP Range request support.

    Enables browser video playback with seeking. The endpoint proxies requests
    to SeaweedFS object storage and translates the response into a format
    suitable for HTML5 video players.

    When no Range header is present, the entire file is streamed with a 200 OK
    response. When a Range header is present, only the requested byte range is
    returned with a 206 Partial Content response, allowing the browser to seek
    to arbitrary positions without downloading the full file first.

    Args:
        task_id: UUID of the analysis task, used as the video object name.
        request: The incoming HTTP request, inspected for the Range header.

    Returns:
        StreamingResponse with video content and appropriate HTTP headers
        (Content-Length, Content-Range, Accept-Ranges).

    Raises:
        HTTPException 404: If the video object does not exist in SeaweedFS.
        HTTPException 416: If the Range header is malformed.
    """
    client = get_client(
        settings.seaweedfs_endpoint,
        settings.seaweedfs_access_key,
        settings.seaweedfs_secret_key,
    )
    object_key = f"{task_id}.mp4"

    try:
        stat = client.stat_object(BUCKET_UPLOADS, object_key)
    except Exception:
        raise HTTPException(status_code=404, detail="Video not found")

    file_size = stat.size
    range_header = request.headers.get("range")

    if not range_header:
        response = client.get_object(BUCKET_UPLOADS, object_key)
        return StreamingResponse(
            response,
            media_type="video/mp4",
            headers={"Content-Length": str(file_size)},
        )

    range_match = re.search(r"bytes=(\d+)-(\d*)", range_header)
    if not range_match:
        raise HTTPException(status_code=416, detail="Invalid Range header")

    start = int(range_match.group(1))
    end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
    end = min(end, file_size - 1)

    response = client.get_object(BUCKET_UPLOADS, object_key)

    if start > 0:
        response.read(start)

    content_length = end - start + 1

    return StreamingResponse(
        _iter_range(response, start, content_length),
        status_code=206,
        media_type="video/mp4",
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(content_length),
            "Accept-Ranges": "bytes",
        },
    )


def _iter_range(response, start: int, length: int):
    """Yield byte chunks from a SeaweedFS response for partial content.

    The MinIO client returns a readable stream object.
    This generator reads from that stream in 64 KB chunks,
    starting at the given offset, and yields exactly ``length`` bytes total.

    It is used by ``stream_video`` to feed a ``StreamingResponse`` when serving
    HTTP 206 Partial Content responses.

    After all bytes are yielded (or the stream ends prematurely), the
    underlying connection is closed and released back to the pool.

    Args:
        response: Readable response from ``minio.Minio.get_object``.
        start: Byte offset to start reading from
            (already skipped by the caller).
        length: Total number of bytes to yield.
    """
    remaining = length
    while remaining > 0:
        chunk_size = min(remaining, 64 * 1024)
        chunk = response.read(chunk_size)
        if not chunk:
            break
        remaining -= len(chunk)
        yield chunk
    response.close()
    response.release_conn()


app.include_router(upload.router, prefix="/api/v1", tags=["Processing"])
app.include_router(status.router, prefix="/api/v1", tags=["Status"])
app.include_router(analysis.router, prefix="/api/v1", tags=["Analysis"])
