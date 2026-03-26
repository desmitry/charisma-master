import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class TelemetryRecord(Base):
    __tablename__ = "telemetry_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String, unique=True, nullable=False, index=True)
    media_filename = Column(String, nullable=False)
    confidence_total = Column(Float, nullable=True)
    analyze_provider = Column(String, nullable=True)
    transcribe_provider = Column(String, nullable=True)
    user_rating = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    rated_at = Column(DateTime, nullable=True)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        return session
