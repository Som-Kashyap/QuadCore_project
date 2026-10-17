from typing import List, Optional, TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Float, DateTime, ForeignKey

from app.core.database import Base

if TYPE_CHECKING:
    from app.domains.reporting.models import ReportingPeriod
    from app.domains.auth.models import User

class Firm(Base):
    """Factory entity profile containing baseline operational parameters."""
    __tablename__ = "firms"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
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

    owner: Mapped["User"] = relationship(back_populates="firms")
    reporting_periods: Mapped[List["ReportingPeriod"]] = relationship(
        back_populates="firm", cascade="all, delete-orphan"
    )