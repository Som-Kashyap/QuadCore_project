from datetime import datetime
from enum import Enum
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from app.core.schemas import TimestampResponse


# ==============================================================================
# ENUMS (Pydantic / API models)
# ==============================================================================

class DocumentCategory(str, Enum):
    ELECTRICITY_BILL = "electricity_bill"
    FUEL_INVOICE = "fuel_invoice"
    PURCHASE_REGISTER = "purchase_register"
    PRODUCTION_LOG = "production_log"
    OTHER_EVIDENCE = "other_evidence"


class FileFormat(str, Enum):
    PDF = "pdf"
    PNG = "png"
    JPEG = "jpeg"
    CSV = "csv"
    XLSX = "xlsx"


# ==============================================================================
# UPLOADED DOCUMENT
# ==============================================================================

class UploadedDocumentBase(BaseModel):
    reporting_period_id: UUID = Field(..., description="FK to parent ReportingPeriod")
    category: DocumentCategory
    file_format: FileFormat
    mime_type: str = Field(..., max_length=100)
    original_filename: str = Field(..., max_length=255)
    storage_path: str = Field(..., description="S3 URI or local storage path")
    file_size_bytes: int = Field(..., gt=0)
    sha256_hash: str = Field(..., min_length=64, max_length=64, description="SHA-256 hex digest of the file")


class UploadedDocumentCreate(UploadedDocumentBase):
    extraction_raw_json: Optional[dict[str, Any]] = Field(
        None, description="Raw JSON payload from the Vision LLM extraction pass"
    )


class UploadedDocumentResponse(UploadedDocumentBase, TimestampResponse):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    extraction_raw_json: Optional[dict[str, Any]] = None
    uploaded_at: datetime
