#!/usr/bin/env python3
# ruff: noqa: T201
"""
Скрипт для загрузки демо-видео и результата анализа в SeaweedFS.
"""

import argparse
import sys
from pathlib import Path

from minio import Minio

BUCKET_UPLOADS = "uploads"
BUCKET_RESULTS = "results"

DEFAULT_TASK_ID = "62a26154-2d3e-408d-8737-2dbe5255eac6"
DEFAULT_SEAWEEDFS_ENDPOINT = "localhost:8333"
DEFAULT_ACCESS_KEY = ""
DEFAULT_SECRET_KEY = ""

PROJECT_ROOT = Path(__file__).parent.parent
DEFAULT_VIDEO_PATH = PROJECT_ROOT / f"{DEFAULT_TASK_ID}.mp4"
DEFAULT_RESULT_PATH = (
    PROJECT_ROOT
    / "services"
    / "frontend"
    / "public"
    / f"{DEFAULT_TASK_ID}.json"
)


def get_client(
    endpoint: str, access_key: str, secret_key: str, secure: bool = False
) -> Minio:
    return Minio(
        endpoint, access_key=access_key, secret_key=secret_key, secure=secure
    )


def ensure_bucket_exists(client: Minio, bucket_name: str):
    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)
        print(f"Created bucket: {bucket_name}")


def upload_file_to_seaweedfs(
    client: Minio,
    bucket: str,
    object_name: str,
    file_path: str,
    content_type: str = "application/octet-stream",
):
    client.fput_object(
        bucket, object_name, file_path, content_type=content_type
    )
    file_size = Path(file_path).stat().st_size
    print(f"Uploaded: {object_name} ({file_size / 1024 / 1024:.2f} MB)")


def main():
    parser = argparse.ArgumentParser(
        description="Загрузка демо-видео и результата анализа в SeaweedFS"
    )
    parser.add_argument(
        "--video",
        default=str(DEFAULT_VIDEO_PATH),
        help="Путь к видео файлу (MP4)",
    )
    parser.add_argument(
        "--result",
        default=str(DEFAULT_RESULT_PATH),
        help="Путь к JSON файлу с результатом анализа",
    )
    parser.add_argument(
        "--task-id", default=DEFAULT_TASK_ID, help="Task ID для демо"
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_SEAWEEDFS_ENDPOINT,
        help="SeaweedFS S3 endpoint",
    )
    parser.add_argument(
        "--access-key", default=DEFAULT_ACCESS_KEY, help="SeaweedFS Access Key"
    )
    parser.add_argument(
        "--secret-key", default=DEFAULT_SECRET_KEY, help="SeaweedFS Secret Key"
    )
    parser.add_argument(
        "--secure", action="store_true", help="Использовать HTTPS"
    )

    args = parser.parse_args()

    video_path = Path(args.video)
    result_path = Path(args.result)

    if not video_path.exists():
        print(f"Video file not found: {video_path}")
        sys.exit(1)

    if not result_path.exists():
        print(f"JSON file not found: {result_path}")
        sys.exit(1)

    print("Uploading demo data to SeaweedFS...")
    print(f"  Endpoint: {args.endpoint}")
    print(f"  Task ID: {args.task_id}")
    print(f"  Video: {video_path.name}")
    print(f"  Result: {result_path.name}")

    client = get_client(
        args.endpoint, args.access_key, args.secret_key, args.secure
    )

    ensure_bucket_exists(client, BUCKET_UPLOADS)
    ensure_bucket_exists(client, BUCKET_RESULTS)

    video_object_name = f"{args.task_id}.mp4"
    print(f"Uploading video: {video_object_name}")
    upload_file_to_seaweedfs(
        client,
        BUCKET_UPLOADS,
        video_object_name,
        str(video_path),
        content_type="video/mp4",
    )

    result_object_name = f"{args.task_id}.json"
    print(f"Uploading result: {result_object_name}")
    upload_file_to_seaweedfs(
        client,
        BUCKET_RESULTS,
        result_object_name,
        str(result_path),
        content_type="application/json",
    )

    print("Done.")


if __name__ == "__main__":
    main()
