from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.documents.schemas import DocumentCategory, UploadedDocumentResponse


router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.post("/upload", response_model=UploadedDocumentResponse, status_code=201)
async def upload_and_extract_document(
    file: UploadFile = File(...),
    reporting_period_id: UUID = Form(...),
    category: DocumentCategory = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass