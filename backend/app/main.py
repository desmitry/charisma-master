import os

from app.config import settings
from app.logic.endpoints import analysis, status, upload
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

environment = os.getenv("ENVIRONMENT", "development")

if environment == "production":
    origins = [os.getenv("ORIGIN_URL")]
else:
    origins = ["*"]

if not settings.llm_api_key or settings.llm_api_key.startswith("sk-proj-..."):
    print("Warning: LLM_API_KEY is missing or looks like a placeholder!")

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
