from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.config import settings
from src.logic.endpoints import upload, status, analysis

app = FastAPI(
    title="Speech ANALysis",
    version="1.0.0",
)

app.mount(
    "/media",
    StaticFiles(directory=str(settings.media_root)),
    name="media",
)

app.include_router(upload.router, prefix="/api/v1", tags=["Processing"])
app.include_router(status.router, prefix="/api/v1", tags=["Status"])
app.include_router(analysis.router, prefix="/api/v1", tags=["Analysis"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
