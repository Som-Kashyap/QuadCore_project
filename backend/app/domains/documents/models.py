import enum
from typing import Optional, TYPE_CHECKING
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    String,
    ForeignKey,
    DateTime,
    Enum,
    JSON,
    Text,
    BigInteger,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.domains.reporting.models import ReportingPeriod


# ==============================================================================
# ENUMS
# ==============================================================================

class DocumentCategory(str, enum.Enum):
    ELECTRICITY_BILL = "electricity_bill"
    FUEL_INVOICE = "fuel_invoice"
    PURCHASE_REGISTER = "purchase_register"
    PRODUCTION_LOG = "production_log"
    OTHER_EVIDENCE = "other_evidence"


class FileFormat(str, enum.Enum):
    PDF = "pdf"
    PNG = "png"
    JPEG = "jpeg"
    CSV = "csv"
    XLSX = "xlsx"
    DOCX = "docx"


# ==============================================================================
# MODELS
# ==============================================================================

class UploadedDocument(Base):
    """Raw uploaded source files providing the evidentiary basis for extracted data."""
    __tablename__ = "uploaded_documents"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    reporting_period_id: Mapped[int] = mapped_column(
        ForeignKey("reporting_periods.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    category: Mapped[DocumentCategory] = mapped_column(Enum(DocumentCategory), nullable=False)
    file_format: Mapped[FileFormat] = mapped_column(Enum(FileFormat), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Relative local path
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    
    # LLM processing extraction summary
    extraction_raw_json: Mapped[Optional[dict]] = mapped_column(JSON)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    reporting_period: Mapped["ReportingPeriod"] = relationship(
        back_populates="uploaded_documents", lazy="selectin"
    )
