import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.logic.endpoints import analysis, status, telemetry, upload

logger = logging.getLogger(__name__)

if settings.mode == "prod" and settings.origin_url == "*":
    raise Exception("You need to specify a specific url for production!")

origins = [settings.origin_url]

OPENAPI_TAGS = [
    {
        "name": "Processing",
        "description": "Загрузка и запуск обработки видео выступлений. "
        "Поддерживает загрузку файлов и ссылки на Rutube.",
    },
    {
        "name": "Status",
        "description": "Отслеживание прогресса обработки задач в реальном времени.",
    },
    {
        "name": "Analysis",
        "description": "Получение результатов анализа выступления: "
        "транскрипция, темп речи, уверенность, оценка от LLM.",
    },
    {
        "name": "Telemetry",
        "description": "Телеметрия использования сервиса: "
        "статистика обработок и пользовательские оценки качества.",
    },
    {
        "name": "Health",
        "description": "Проверка работоспособности сервиса.",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database tables...")
    await init_db()
    logger.info("Database initialized.")
    yield


app = FastAPI(
    title="Charisma — Speech Analysis API",
    version="1.0.0",
    lifespan=lifespan,
    description=(
        "API для анализа публичных выступлений и презентаций.\n\n"
        "**Возможности:**\n"
        "- Транскрибация речи (Whisper / Sber Speech)\n"
        "- Анализ видео: жесты, взгляд, поза (MediaPipe)\n"
        "- Анализ аудио: темп, громкость, тон, слова-паразиты\n"
        "- LLM-оценка содержания (GigaChat / OpenAI)\n"
        "- Оценка по критериям преподавателя\n"
        "- Индекс уверенности оратора\n"
    ),
    contact={
        "name": "Charisma Team",
        "url": "https://github.com/desmitry/charisma-master",
    },
    license_info={
        "name": "MIT",
    },
    servers=[
        {"url": "https://charisma.geekiot.tech", "description": "Production"},
        {"url": "http://localhost:8000", "description": "Local development"},
    ],
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
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
app.include_router(telemetry.router, prefix="/api/v1", tags=["Telemetry"])


@app.get("/health", tags=["Health"], summary="Проверка работоспособности")
async def health_check():
    """Возвращает статус `ok`, если сервис запущен и отвечает."""
    return {"status": "ok"}
