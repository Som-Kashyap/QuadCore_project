"""
Local filesystem storage service for document uploads.
Handles secure streaming, path traversal prevention, SHA-256 computation, and cleanup.
"""

from dataclasses import dataclass
import hashlib
import logging
import os
from pathlib import Path
import re
from typing import Tuple
from uuid import UUID, uuid4

from fastapi import UploadFile

from app.core.config import get_settings
from app.domains.documents.schemas import FileFormat

logger = logging.getLogger(__name__)

# Maximum file size allowed: 25 MB
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

# Mapping of file extensions to FileFormat enum
EXTENSION_TO_FORMAT = {
    ".pdf": FileFormat.PDF,
    ".png": FileFormat.PNG,
    ".jpg": FileFormat.JPEG,
    ".jpeg": FileFormat.JPEG,
    ".csv": FileFormat.CSV,
    ".xlsx": FileFormat.XLSX,
    ".docx": FileFormat.DOCX,
}


class StorageError(Exception):
    """Base exception for filesystem storage errors."""
    pass


class FileSizeExceededError(StorageError):
    """Raised when an uploaded file exceeds the maximum allowed size limit."""
    pass


class InvalidFileExtensionError(StorageError):
    """Raised when an uploaded file has an unsupported extension."""
    pass


@dataclass
class StoredFileMetadata:
    doc_id: UUID
    storage_path: str
    absolute_path: Path
    file_size_bytes: int
    sha256_hash: str
    file_format: FileFormat
    mime_type: str
    original_filename: str


def _get_storage_root() -> Path:
    """Return the resolved absolute path to the local documents storage root."""
    settings = get_settings()
    root = Path(settings.DOCUMENTS_STORAGE_PATH).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def sanitize_filename(filename: str) -> str:
    """Remove unsafe characters and directory traversal elements from filenames."""
    clean = re.sub(r"[^\w\s\.-]", "_", filename).strip()
    return clean[:100] or "unnamed_document"


def get_safe_path(storage_path: str) -> Path:
    """
    Resolve a storage path and guarantee it does not escape the storage root
    (OWASP Path Traversal defense).
    """
    root = _get_storage_root()
    target = (root / Path(storage_path).name).resolve() if not Path(storage_path).is_absolute() else Path(storage_path).resolve()

    # If the relative path includes subdirectories:
    candidate = (root.parent / storage_path).resolve()
    if candidate.is_relative_to(root) or str(candidate).startswith(str(root)):
        return candidate

    if not target.is_relative_to(root) and not str(target).startswith(str(root)):
        logger.critical("Directory traversal attack detected on storage_path: %s", storage_path)
        raise StorageError("Invalid storage path: access denied outside storage root.")

    return target


async def save_uploaded_file(
    file: UploadFile,
    reporting_period_id: int | str | UUID,
) -> StoredFileMetadata:
    """
    Stream and persist an uploaded file to local disk storage while computing SHA-256 hash.

    Raises:
        InvalidFileExtensionError: If extension is not supported.
        FileSizeExceededError: If file exceeds MAX_FILE_SIZE_BYTES.
    """
    original_name = file.filename or "upload.bin"
    ext = Path(original_name).suffix.lower()

    if ext not in EXTENSION_TO_FORMAT:
        allowed = ", ".join(EXTENSION_TO_FORMAT.keys())
        raise InvalidFileExtensionError(
            f"Unsupported file extension '{ext}'. Allowed extensions: {allowed}"
        )

    file_format = EXTENSION_TO_FORMAT[ext]
    mime_type = file.content_type or "application/octet-stream"

    # Prepare storage path: storage/documents/{reporting_period_id}/{uuid}_{clean_name}
    doc_id = uuid4()
    clean_name = sanitize_filename(original_name)
    period_dir = _get_storage_root() / str(reporting_period_id)
    period_dir.mkdir(parents=True, exist_ok=True)

    destination_filename = f"{doc_id}_{clean_name}"
    dest_path = period_dir / destination_filename
    relative_path = f"storage/documents/{reporting_period_id}/{destination_filename}"

    sha256 = hashlib.sha256()
    total_bytes = 0
    chunk_size = 64 * 1024  # 64 KB chunks

    try:
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(chunk_size):
                total_bytes += len(chunk)
                if total_bytes > MAX_FILE_SIZE_BYTES:
                    buffer.close()
                    dest_path.unlink(missing_ok=True)
                    raise FileSizeExceededError(
                        f"File size exceeds maximum limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
                    )
                sha256.update(chunk)
                buffer.write(chunk)
    except Exception as exc:
        dest_path.unlink(missing_ok=True)
        if isinstance(exc, (FileSizeExceededError, StorageError)):
            raise
        logger.error("Failed to write uploaded file to disk: %s", exc, exc_info=True)
        raise StorageError(f"Filesystem write error: {exc}") from exc

    return StoredFileMetadata(
        doc_id=doc_id,
        storage_path=relative_path,
        absolute_path=dest_path,
        file_size_bytes=total_bytes,
        sha256_hash=sha256.hexdigest(),
        file_format=file_format,
        mime_type=mime_type,
        original_filename=original_name,
    )


def delete_stored_file(storage_path: str) -> None:
    """Delete a stored file from disk safely."""
    try:
        path = get_safe_path(storage_path)
        if path.exists() and path.is_file():
            path.unlink()
            logger.info("Deleted stored document from disk: %s", path)
    except Exception as exc:
        logger.warning("Could not delete stored file at %s: %s", storage_path, exc)
