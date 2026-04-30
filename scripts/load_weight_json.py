#!/usr/bin/env python3
# ruff: noqa: T201
"""
Скрипт для загрузки конфигурации алгоритмов (весов) в PostgreSQL.
Принимает путь до JSON файла и ID конфигурации.
"""

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import Json

DEFAULT_DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://charisma:charisma@localhost:5432/charisma"
)


def get_connection(db_url: str):
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    return conn


def upsert_algorithm_weight(conn, weight_id: str, config_data: dict):
    with conn.cursor() as cur:
        # Убеждаемся, что таблица существует
        cur.execute("""
            CREATE TABLE IF NOT EXISTS algorithm_weights (
                id TEXT PRIMARY KEY,
                config JSONB NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """)

        cur.execute(
            """
            INSERT INTO algorithm_weights (id, config)
            VALUES (%s, %s)
            ON CONFLICT (id) DO UPDATE
                SET config = EXCLUDED.config,
                    updated_at = now()
            """,
            (weight_id, Json(config_data)),
        )
        print(f"Successfully upserted algorithm weights with ID: {weight_id}")


def main():
    parser = argparse.ArgumentParser(
        description="Загрузка JSON конфигурации весов алгоритма в PostgreSQL"
    )
    parser.add_argument(
        "json_path",
        help="Путь к JSON файлу с конфигурацией алгоритма",
    )
    parser.add_argument(
        "weight_id",
        help="ID конфигурации для сохранения в базе данных",
    )
    parser.add_argument(
        "--db-url",
        default=DEFAULT_DATABASE_URL,
        help=f"PostgreSQL Connection URL (default: {DEFAULT_DATABASE_URL})",
    )

    args = parser.parse_args()

    json_path = Path(args.json_path)

    if not json_path.exists():
        print(f"Error: JSON file not found at {json_path}")
        sys.exit(1)

    try:
        config_data = json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON file. {e}")
        sys.exit(1)

    print("Uploading config to DB...")
    print(f"  DB URL: {args.db_url}")
    print(f"  Config File: {json_path}")
    print(f"  Weight ID: {args.weight_id}")

    try:
        conn = get_connection(args.db_url)
        upsert_algorithm_weight(conn, args.weight_id, config_data)
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)
    finally:
        if "conn" in locals() and conn:
            conn.close()

    print("Done.")


if __name__ == "__main__":
    main()
