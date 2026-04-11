import logging
import re

from charisma_storage import (
    BUCKET_UPLOADS,
    ensure_buckets_exist,
    get_client,
)
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware

from app.config import settings
from app.logic.endpoints import analysis, status, upload

logger = logging.getLogger(__name__)

if settings.mode == "prod" and settings.origin_url == "*":
    raise Exception("You need to specify a specific url for production!")

origins = [settings.origin_url]

app = FastAPI(
    title="Speech Analysis",
    version="1.0.0",
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and return a generic error message.

    Log full details server-side for debugging, but never expose stack traces
    or internal error details to the client.
    """
    logger.error(
        "Unhandled exception: %s %s",
        request.method,
        request.url.path,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500, content={"detail": "Internal server error"}
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


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/media/{task_id}.mp4")
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
