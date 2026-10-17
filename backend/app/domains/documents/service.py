"""
Document business logic — upload orchestration, tenant ownership verification,
Groq extraction triggering, and atomic transactional storage.
"""

import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile

from app.domains.documents.extraction import extract_document_metrics
from app.domains.documents.models import UploadedDocument
from app.domains.documents.schemas import DocumentCategory
from app.domains.documents.storage import (
    delete_stored_file,
    save_uploaded_file,
    FileSizeExceededError,
    InvalidFileExtensionError,
)
from app.domains.firm.models import Firm
from app.domains.reporting.models import ReportingPeriod

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain Exceptions
# ---------------------------------------------------------------------------
class DocumentServiceError(Exception):
    """Base exception for document service domain errors."""
    pass


class DocumentNotFoundError(DocumentServiceError):
    """Raised when a document is not found or user is unauthorized to access it."""
    pass


class ReportingPeriodNotFoundError(DocumentServiceError):
    """Raised when the specified reporting period does not exist or belong to the user."""
    pass


class DuplicateDocumentError(DocumentServiceError):
    """Raised when the same document has already been uploaded for this period."""
    pass


# ---------------------------------------------------------------------------
# Ownership Verification (OWASP BOLA Protection)
# ---------------------------------------------------------------------------
async def verify_period_ownership(
    db: AsyncSession, reporting_period_id: int, user_id: int
) -> ReportingPeriod:
    """
    Ensure the reporting period exists and belongs to a Firm owned by the authenticated user.
    """
    query = (
        select(ReportingPeriod)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(
            ReportingPeriod.id == reporting_period_id,
            Firm.owner_id == user_id,
        )
    )
    result = await db.execute(query)
    period = result.scalar_one_or_none()

    if period is None:
        logger.warning(
            "Access denied or reporting period not found: period_id=%s user_id=%s",
            reporting_period_id,
            user_id,
        )
        raise ReportingPeriodNotFoundError(
            "Reporting period not found or you do not have permission to access it."
        )

    return period


# ---------------------------------------------------------------------------
# Service Functions
# ---------------------------------------------------------------------------
async def upload_document(
    db: AsyncSession,
    file: UploadFile,
    reporting_period_id: int,
    category: DocumentCategory,
    user_id: int,
) -> UploadedDocument:
    """
    Save file to local storage, run Groq LLM extraction (.pdf/.docx),
    and persist document metadata with atomic transaction rollbacks.
    """
    # 1. Enforce tenant ownership
    await verify_period_ownership(db, reporting_period_id, user_id)

    # 2. Stream to local storage and compute hash/size
    stored_meta = await save_uploaded_file(file, reporting_period_id)

    # 3. Check for duplicates in the same reporting period
    dup_query = select(UploadedDocument).where(
        UploadedDocument.reporting_period_id == reporting_period_id,
        UploadedDocument.sha256_hash == stored_meta.sha256_hash,
    )
    dup_check = await db.execute(dup_query)
    if dup_check.scalar_one_or_none() is not None:
        delete_stored_file(stored_meta.storage_path)
        logger.warning(
            "Duplicate upload rejected: hash=%s period_id=%s",
            stored_meta.sha256_hash,
            reporting_period_id,
        )
        raise DuplicateDocumentError(
            "An identical file with this content has already been uploaded for this reporting period."
        )

    # 4. Extract metrics via Groq LLM client (.pdf and .docx)
    extraction_data = await extract_document_metrics(
        file_path=stored_meta.absolute_path,
        file_format=stored_meta.file_format,
        category=category,
    )

    # 5. Build ORM entity
    document = UploadedDocument(
        id=stored_meta.doc_id,
        reporting_period_id=reporting_period_id,
        category=category,
        file_format=stored_meta.file_format,
        mime_type=stored_meta.mime_type,
        original_filename=stored_meta.original_filename,
        storage_path=stored_meta.storage_path,
        file_size_bytes=stored_meta.file_size_bytes,
        sha256_hash=stored_meta.sha256_hash,
        extraction_raw_json=extraction_data,
    )
    db.add(document)

    # 6. Atomic database transaction with compensating rollback
    try:
        await db.flush()
        await db.commit()
        await db.refresh(document)
    except IntegrityError as exc:
        await db.rollback()
        delete_stored_file(stored_meta.storage_path)
        logger.warning("Integrity error persisting document: %s", exc)
        raise DuplicateDocumentError("Document conflict: database constraint violation.") from exc
    except Exception as exc:
        await db.rollback()
        delete_stored_file(stored_meta.storage_path)
        logger.error("Failed to commit document record to database: %s", exc, exc_info=True)
        raise

    logger.info(
        "Document uploaded successfully: doc_id=%s period_id=%s user_id=%s",
        document.id,
        reporting_period_id,
        user_id,
    )
    return document


async def get_document_by_id(
    db: AsyncSession, document_id: UUID, user_id: int
) -> UploadedDocument:
    """
    Fetch a single document enforcing owner isolation.

    Raises:
        DocumentNotFoundError: If document does not exist or user is unauthorized.
    """
    query = (
        select(UploadedDocument)
        .join(ReportingPeriod, UploadedDocument.reporting_period_id == ReportingPeriod.id)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(
            UploadedDocument.id == document_id,
            Firm.owner_id == user_id,
        )
    )
    result = await db.execute(query)
    doc = result.scalar_one_or_none()

    if doc is None:
        logger.warning("Document not found or unauthorized: doc_id=%s user_id=%s", document_id, user_id)
        raise DocumentNotFoundError("Document not found")

    return doc


async def list_documents_for_period(
    db: AsyncSession, reporting_period_id: int, user_id: int
) -> list[UploadedDocument]:
    """
    List all uploaded documents belonging to a given reporting period.
    """
    await verify_period_ownership(db, reporting_period_id, user_id)

    query = (
        select(UploadedDocument)
        .where(UploadedDocument.reporting_period_id == reporting_period_id)
        .order_by(UploadedDocument.uploaded_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def delete_document(
    db: AsyncSession, document_id: UUID, user_id: int
) -> None:
    """
    Delete a document from database and clean up file from local filesystem.
    """
    doc = await get_document_by_id(db, document_id, user_id)
    storage_path = doc.storage_path

    try:
        await db.delete(doc)
        await db.commit()
        delete_stored_file(storage_path)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete document %s from database: %s", document_id, exc, exc_info=True)
        raise

    logger.info("Document deleted successfully: doc_id=%s user_id=%s", document_id, user_id)
