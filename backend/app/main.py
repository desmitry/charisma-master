import os

from app.config import settings
from app.logic.endpoints import analysis, status, upload
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

# Configure CORS origins based on environment
environment = os.getenv("ENVIRONMENT", "development")

if environment == "production":
    origins = [os.getenv("ORIGIN_URL")]
else:
    origins = ["*"]

if os.getenv("LLM_API_KEY") is None:
    raise Exception("You need to specify LLM_API_KEY")

app = FastAPI(
    title="Speech Analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
