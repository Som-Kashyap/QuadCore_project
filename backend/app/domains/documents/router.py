"""
Document endpoints — upload, retrieve, download, list, delete.
Thin presentation controller delegating all business logic to the service layer.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.auth.models import User
from app.domains.documents.schemas import DocumentCategory, UploadedDocumentResponse
from app.domains.documents.service import (
    DocumentNotFoundError,
    DuplicateDocumentError,
    ReportingPeriodNotFoundError,
    delete_document,
    get_document_by_id,
    list_documents_for_period,
    upload_document,
)
from app.domains.documents.storage import (
    FileSizeExceededError,
    InvalidFileExtensionError,
    StorageError,
    get_safe_path,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])


# --------------------------------------------------------------------------- #
# POST /api/documents/upload
# --------------------------------------------------------------------------- #
@router.post(
    "/upload",
    response_model=UploadedDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and process document with Groq LLM extraction",
)
async def upload_and_extract_document(
    file: UploadFile = File(...),
    reporting_period_id: int = Form(...),
    category: DocumentCategory = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload source evidence document (.pdf/.docx/images/etc.), save to local storage,
    and trigger automated Groq Vision/LLM metric extraction for .pdf and .docx.
    """
    try:
        return await upload_document(
            db=db,
            file=file,
            reporting_period_id=reporting_period_id,
            category=category,
            user_id=current_user.id,
        )
    except ReportingPeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except DuplicateDocumentError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except InvalidFileExtensionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileSizeExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        )
    except StorageError as exc:
        logger.error("Storage error on upload: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage processing failure during document upload",
        )
    except Exception as exc:
        logger.error("Unhandled exception during document upload: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during document processing",
        )


# --------------------------------------------------------------------------- #
# GET /api/documents/{document_id}
# --------------------------------------------------------------------------- #
@router.get(
    "/{document_id}",
    response_model=UploadedDocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get document metadata and extraction payload",
)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch details and LLM extraction results of a specific uploaded document."""
    try:
        return await get_document_by_id(db, document_id, current_user.id)
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Unhandled exception fetching document %s: %s", document_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving the document",
        )


# --------------------------------------------------------------------------- #
# GET /api/documents/{document_id}/download
# --------------------------------------------------------------------------- #
@router.get(
    "/{document_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download uploaded document file",
)
async def download_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Securely stream/download the raw uploaded document from local storage."""
    try:
        doc = await get_document_by_id(db, document_id, current_user.id)
        safe_path = get_safe_path(doc.storage_path)

        if not safe_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File content not found on server storage.",
            )

        return FileResponse(
            path=str(safe_path),
            media_type=doc.mime_type,
            filename=doc.original_filename,
        )
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unhandled exception downloading document %s: %s", document_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while downloading the document",
        )


# --------------------------------------------------------------------------- #
# GET /api/documents/period/{reporting_period_id}
# --------------------------------------------------------------------------- #
@router.get(
    "/period/{reporting_period_id}",
    response_model=list[UploadedDocumentResponse],
    status_code=status.HTTP_200_OK,
    summary="List all documents in reporting period",
)
async def list_documents(
    reporting_period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all uploaded documents associated with a specific reporting period."""
    try:
        return await list_documents_for_period(db, reporting_period_id, current_user.id)
    except ReportingPeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Unhandled exception listing documents for period %s: %s", reporting_period_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while listing documents",
        )


# --------------------------------------------------------------------------- #
# DELETE /api/documents/{document_id}
# --------------------------------------------------------------------------- #
@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document",
)
async def remove_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete document metadata from database and remove the file from local disk."""
    try:
        await delete_document(db, document_id, current_user.id)
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Unhandled exception deleting document %s: %s", document_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting the document",
        )