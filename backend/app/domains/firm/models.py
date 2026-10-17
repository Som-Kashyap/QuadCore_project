from typing import List, Optional, TYPE_CHECKING
from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Float, DateTime, ForeignKey, Uuid

from app.core.database import Base

if TYPE_CHECKING:
    from app.domains.reporting.models import ReportingPeriod
    from app.domains.auth.models import User


class Firm(Base):
    """Factory entity profile containing baseline operational parameters."""
    __tablename__ = "firms"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    registration_identifier: Mapped[Optional[str]] = mapped_column(String(100))  # GSTIN or CIN
    segment: Mapped[str] = mapped_column(String(100), default="induction_furnace", nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Factory baseline specifications for pathway engine
    roof_area_sqm: Mapped[Optional[float]] = mapped_column(Float)
    contracted_demand_mva: Mapped[Optional[float]] = mapped_column(Float)
    tariff_category: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    owner: Mapped["User"] = relationship(back_populates="firms", lazy="selectin")
    reporting_periods: Mapped[List["ReportingPeriod"]] = relationship(
        back_populates="firm", cascade="all, delete-orphan", lazy="selectin"
    )