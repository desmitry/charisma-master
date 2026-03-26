import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.db import TelemetryRecord, get_session
from app.models.schemas import RatingRequest, RatingResponse, TelemetryStatsResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/telemetry/{task_id}/rate",
    response_model=RatingResponse,
    summary="Оценить качество анализа",
    response_description="Подтверждение сохранённой оценки",
    responses={
        404: {"description": "Задача не найдена в системе телеметрии"},
        400: {"description": "Задача уже была оценена"},
    },
)
async def rate_analysis(task_id: str, body: RatingRequest):
    """Сохраняет пользовательскую оценку качества анализа (1-5 звёзд)."""
    session = await get_session()
    try:
        result = await session.execute(
            select(TelemetryRecord).where(TelemetryRecord.task_id == task_id)
        )
        record = result.scalar_one_or_none()

        if record is None:
            raise HTTPException(
                status_code=404,
                detail="Задача не найдена в системе телеметрии",
            )

        if record.user_rating is not None:
            raise HTTPException(
                status_code=400,
                detail="Эта задача уже была оценена",
            )

        record.user_rating = body.rating
        record.rated_at = datetime.now(timezone.utc)
        await session.commit()

        return RatingResponse(
            task_id=task_id,
            rating=body.rating,
            message="Оценка сохранена",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving rating: {e}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Ошибка сохранения оценки")
    finally:
        await session.close()


@router.get(
    "/telemetry/stats",
    response_model=TelemetryStatsResponse,
    summary="Статистика использования сервиса",
    response_description="Сводка: общее количество, средний рейтинг, средний индекс уверенности",
)
async def get_telemetry_stats():
    """Возвращает агрегированную статистику по всем обработанным выступлениям."""
    session = await get_session()
    try:
        total_result = await session.execute(
            select(func.count(TelemetryRecord.id))
        )
        total_analyses = total_result.scalar() or 0

        rated_result = await session.execute(
            select(func.count(TelemetryRecord.id)).where(
                TelemetryRecord.user_rating.isnot(None)
            )
        )
        rated_count = rated_result.scalar() or 0

        avg_rating_result = await session.execute(
            select(func.avg(TelemetryRecord.user_rating)).where(
                TelemetryRecord.user_rating.isnot(None)
            )
        )
        avg_rating = avg_rating_result.scalar()

        avg_conf_result = await session.execute(
            select(func.avg(TelemetryRecord.confidence_total)).where(
                TelemetryRecord.confidence_total.isnot(None)
            )
        )
        avg_confidence = avg_conf_result.scalar()

        return TelemetryStatsResponse(
            total_analyses=total_analyses,
            rated_count=rated_count,
            average_rating=round(avg_rating, 2) if avg_rating is not None else None,
            average_confidence=round(avg_confidence, 1) if avg_confidence is not None else None,
        )
    except Exception as e:
        logger.error(f"Error fetching telemetry stats: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения статистики")
    finally:
        await session.close()
