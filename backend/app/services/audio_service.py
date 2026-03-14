import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/flac",
    "audio/x-flac",
    "audio/ogg",
    "audio/vorbis",
}

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg"}


def validate_audio_file(file: UploadFile) -> bool:
    """Return True if the file's content type and extension are acceptable."""
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        return False
    suffix = Path(file.filename or "").suffix.lower()
    return suffix in ALLOWED_EXTENSIONS


def get_file_size(file: UploadFile) -> Optional[int]:
    """Return file size in bytes if determinable, else None."""
    try:
        return file.size
    except AttributeError:
        return None


def get_duration(file_data: bytes, filename: str = "audio") -> float:
    """
    Return audio duration in seconds using mutagen.
    Falls back to 0.0 if the format is unrecognized.
    """
    try:
        import mutagen

        suffix = Path(filename).suffix.lower() or ".mp3"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_data)
            tmp_path = tmp.name

        try:
            audio = mutagen.File(tmp_path)
            if audio is not None and audio.info is not None:
                return float(audio.info.length)
        finally:
            os.unlink(tmp_path)

    except Exception as exc:
        logger.warning("Could not determine audio duration: %s", exc)

    return 0.0
