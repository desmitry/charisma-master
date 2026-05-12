"""Database configuration fetcher for ML Engine."""

import logging
import psycopg2

from app.config import settings

logger = logging.getLogger(__name__)

def get_db_weights(weight_id: str) -> dict:
    """Fetch algorithm weights from the database by ID.

    Args:
        weight_id (str): ID of the weights JSON in the database.

    Returns:
        dict: The configuration dictionary, or None if not found or error.
    """
    db_url = settings.database_url
    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT config FROM algorithm_weights WHERE id = %s",
                (weight_id,),
            )
            row = cur.fetchone()
            if row:
                return row[0]
            else:
                logger.warning(
                    f"Algorithm weights '{weight_id}' not found. Using fallback."
                )
                return None
    except Exception as e:
        logger.error(f"Error fetching algorithm weights '{weight_id}' from DB: {e}")
        return None
    finally:
        if "conn" in locals() and conn:
            conn.close()
