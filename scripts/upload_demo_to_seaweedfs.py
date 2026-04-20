#!/usr/bin/env python3
# ruff: noqa: T201
"""
Скрипт для загрузки демо-видео и результата анализа в SeaweedFS.
Загружает файлы под именами demo.mp4 и demo.json.
"""

import argparse
import sys
from pathlib import Path

from minio import Minio

BUCKET_UPLOADS = "uploads"
BUCKET_RESULTS = "results"

DEMO_VIDEO_OBJECT = "demo.mp4"
DEMO_RESULT_OBJECT = "demo.json"

DEFAULT_SEAWEEDFS_ENDPOINT = "localhost:8333"
DEFAULT_ACCESS_KEY = ""
DEFAULT_SECRET_KEY = ""


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
        description="Загрузка демо-видео и результата анализа в SeaweedFS под именами demo.mp4 и demo.json"
    )
    parser.add_argument(
        "video",
        help="Путь к демо видео файлу (MP4)",
    )
    parser.add_argument(
        "result",
        help="Путь к демо JSON файлу с результатом анализа",
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_SEAWEEDFS_ENDPOINT,
        help="SeaweedFS S3 endpoint (default: localhost:8333)",
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
        print(f"Result file not found: {result_path}")
        sys.exit(1)

    if video_path.suffix.lower() != ".mp4":
        print(f"Warning: Expected .mp4 file, got {video_path.suffix}")

    print("Uploading demo data to SeaweedFS...")
    print(f"  Endpoint: {args.endpoint}")
    print(f"  Video: {video_path} -> {DEMO_VIDEO_OBJECT}")
    print(f"  Result: {result_path} -> {DEMO_RESULT_OBJECT}")

    client = get_client(
        args.endpoint, args.access_key, args.secret_key, args.secure
    )

    ensure_bucket_exists(client, BUCKET_UPLOADS)
    ensure_bucket_exists(client, BUCKET_RESULTS)

    print(f"Uploading video: {DEMO_VIDEO_OBJECT}")
    upload_file_to_seaweedfs(
        client,
        BUCKET_UPLOADS,
        DEMO_VIDEO_OBJECT,
        str(video_path),
        content_type="video/mp4",
    )

    print(f"Uploading result: {DEMO_RESULT_OBJECT}")
    upload_file_to_seaweedfs(
        client,
        BUCKET_RESULTS,
        DEMO_RESULT_OBJECT,
        str(result_path),
        content_type="application/json",
    )

    print("Done. Demo files uploaded as demo.mp4 and demo.json")


if __name__ == "__main__":
    main()
