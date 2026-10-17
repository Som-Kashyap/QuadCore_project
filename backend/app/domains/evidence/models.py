from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    DateTime,
    Float,
    Index,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


# ==============================================================================
# MODELS
# ==============================================================================

class EvidenceItem(Base):
    """External regulatory constants, tariffs, and emission factor benchmarks."""
    __tablename__ = "evidence_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    identifier: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # e.g., 'IN_NATIONAL_GRID_2023_24'
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., 'tCO2/MWh'
    source_title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    metadata_payload: Mapped[Optional[dict]] = mapped_column(JSON)


Index("ix_evidence_items_cat_ident", EvidenceItem.category, EvidenceItem.identifier)
