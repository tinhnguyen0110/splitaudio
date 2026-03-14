import io
import logging
from datetime import timedelta
from typing import Optional

from minio import Minio
from minio.error import S3Error

from config import settings

logger = logging.getLogger(__name__)


def _get_client() -> Minio:
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


def _ensure_bucket(client: Minio, bucket: str) -> None:
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


class StorageService:

    @staticmethod
    def upload_file(bucket: str, key: str, file_data: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload bytes to MinIO. Returns the object key."""
        client = _get_client()
        _ensure_bucket(client, bucket)
        client.put_object(
            bucket_name=bucket,
            object_name=key,
            data=io.BytesIO(file_data),
            length=len(file_data),
            content_type=content_type,
        )
        logger.debug("Uploaded %s/%s (%d bytes)", bucket, key, len(file_data))
        return key

    @staticmethod
    def download_file(bucket: str, key: str) -> bytes:
        """Download object from MinIO and return raw bytes."""
        client = _get_client()
        response = client.get_object(bucket, key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    @staticmethod
    def delete_file(bucket: str, key: str) -> None:
        """Delete an object from MinIO."""
        client = _get_client()
        try:
            client.remove_object(bucket, key)
        except S3Error as exc:
            logger.warning("Could not delete %s/%s: %s", bucket, key, exc)

    @staticmethod
    def generate_presigned_url(bucket: str, key: str, expiry: int = 3600) -> str:
        """Return a presigned GET URL valid for *expiry* seconds."""
        client = _get_client()
        url = client.presigned_get_object(
            bucket_name=bucket,
            object_name=key,
            expires=timedelta(seconds=expiry),
        )
        return url
