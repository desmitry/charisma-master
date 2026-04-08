"""SeaweedFS (S3-compatible) client module."""

import io
import json
from typing import Optional

from minio import Minio

_client: Optional[Minio] = None

BUCKET_UPLOADS = "uploads"
BUCKET_RESULTS = "results"


def get_client(
    endpoint: str,
    access_key: str,
    secret_key: str,
    secure: bool = False,
) -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
    return _client


def ensure_buckets_exist(
    endpoint: str,
    access_key: str,
    secret_key: str,
    secure: bool = False,
):
    client = get_client(endpoint, access_key, secret_key, secure)
    for bucket in [BUCKET_UPLOADS, BUCKET_RESULTS]:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)


def upload_file(
    endpoint: str,
    bucket: str,
    object_name: str,
    file_path: str,
    access_key: str,
    secret_key: str,
    secure: bool = False,
):
    client = get_client(endpoint, access_key, secret_key, secure)
    client.fput_object(bucket, object_name, file_path)


def upload_bytes(
    endpoint: str,
    bucket: str,
    object_name: str,
    data: bytes,
    access_key: str,
    secret_key: str,
    content_type: str = "application/octet-stream",
    secure: bool = False,
):
    client = get_client(endpoint, access_key, secret_key, secure)
    client.put_object(
        bucket,
        object_name,
        data=io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )


def download_file(
    endpoint: str,
    bucket: str,
    object_name: str,
    dest_path: str,
    access_key: str,
    secret_key: str,
    secure: bool = False,
):
    client = get_client(endpoint, access_key, secret_key, secure)
    client.fget_object(bucket, object_name, dest_path)


def get_object_bytes(
    endpoint: str,
    bucket: str,
    object_name: str,
    access_key: str,
    secret_key: str,
    secure: bool = False,
) -> bytes:
    client = get_client(endpoint, access_key, secret_key, secure)
    response = client.get_object(bucket, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def get_object_json(
    endpoint: str,
    bucket: str,
    object_name: str,
    access_key: str,
    secret_key: str,
    secure: bool = False,
) -> dict:
    data = get_object_bytes(
        endpoint, bucket, object_name, access_key, secret_key, secure
    )
    return json.loads(data.decode("utf-8"))


def put_object_json(
    endpoint: str,
    bucket: str,
    object_name: str,
    data: dict,
    access_key: str,
    secret_key: str,
    secure: bool = False,
):
    content = json.dumps(data, ensure_ascii=False).encode("utf-8")
    upload_bytes(
        endpoint,
        bucket,
        object_name,
        content,
        "application/json",
        access_key,
        secret_key,
        secure,
    )


def get_object_stat(
    endpoint: str,
    bucket: str,
    object_name: str,
    access_key: str,
    secret_key: str,
    secure: bool = False,
):
    client = get_client(endpoint, access_key, secret_key, secure)
    return client.stat_object(bucket, object_name)
