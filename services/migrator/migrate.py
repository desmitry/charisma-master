"""Database migrator: loads prompts and presets from docs/ into Postgres."""

import json
import logging
import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import Json

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://charisma:charisma@postgres:5432/charisma"
)

DOCS_DIR = Path(__file__).parent / "docs"
PROMPTS_DIR = DOCS_DIR / "prompts"
PERSONAS_DIR = PROMPTS_DIR / "personas"
PRESETS_DIR = DOCS_DIR / "presets"


def get_connection():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def create_tables(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS prompts (
                key TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                criteria JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """)
    logger.info("Tables created/verified")


def upsert_prompts(conn):
    prompts = {}

    for txt_file in PROMPTS_DIR.glob("*.txt"):
        key = txt_file.stem
        prompts[key] = txt_file.read_text(encoding="utf-8").strip()

    if PERSONAS_DIR.exists():
        for txt_file in PERSONAS_DIR.glob("*.txt"):
            key = f"persona:{txt_file.stem}"
            prompts[key] = txt_file.read_text(encoding="utf-8").strip()

    with conn.cursor() as cur:
        for key, content in prompts.items():
            cur.execute(
                """
                INSERT INTO prompts (key, content)
                VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE
                    SET content = EXCLUDED.content, updated_at = now()
                """,
                (key, content),
            )
            logger.info(f"  Upserted prompt: {key}")

    logger.info(f"Upserted {len(prompts)} prompts")


def upsert_presets(conn):
    presets = {}

    for json_file in PRESETS_DIR.glob("*.json"):
        data = json.loads(json_file.read_text(encoding="utf-8"))
        preset_id = data.get("id", json_file.stem)
        presets[preset_id] = data

    with conn.cursor() as cur:
        for preset_id, data in presets.items():
            cur.execute(
                """
                INSERT INTO presets (id, name, description, criteria)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                    SET name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        criteria = EXCLUDED.criteria,
                        updated_at = now()
                """,
                (
                    preset_id,
                    data.get("name", ""),
                    data.get("description", ""),
                    Json(data.get("criteria", [])),
                ),
            )
            logger.info(f"  Upserted preset: {preset_id}")

    logger.info(f"Upserted {len(presets)} presets")


def main():
    logger.info("Starting database migration...")
    conn = get_connection()
    try:
        create_tables(conn)
        upsert_prompts(conn)
        upsert_presets(conn)
        logger.info("Migration completed successfully")
    except Exception:
        logger.exception("Migration failed")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
