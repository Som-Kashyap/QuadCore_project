import enum
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    String,
    Float,
    ForeignKey,
    Enum,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.domains.reporting.models import ReportingPeriod
    from app.domains.documents.models import UploadedDocument


# ==============================================================================
# ENUMS
# ==============================================================================

class VerificationStatus(enum.Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    FLAGGED = "flagged"


class FuelType(enum.Enum):
    DIESEL = "diesel"
    FURNACE_OIL = "furnace_oil"
    LPG = "lpg"


class MaterialType(enum.Enum):
    STEEL_SCRAP = "steel_scrap"
    SPONGE_IRON_DRI_COAL = "sponge_iron_dri_coal"
    SPONGE_IRON_DRI_GAS = "sponge_iron_dri_gas"
    FERRO_MANGANESE = "ferro_manganese"
    FERRO_SILICON = "ferro_silicon"
    CARBON_ADDITIVE = "carbon_additive"


# ==============================================================================
# MODELS
# ==============================================================================

class ElectricityRecord(Base):
    """Electricity consumption records derived from verified utility bills."""
    __tablename__ = "electricity_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporting_period_id: Mapped[int] = mapped_column(
        ForeignKey("reporting_periods.id", ondelete="CASCADE"), nullable=False
    )
    source_document_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid, ForeignKey("uploaded_documents.id", ondelete="SET NULL")
    )
    
    consumed_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    peak_demand_kva: Mapped[Optional[float]] = mapped_column(Float)
    power_factor: Mapped[Optional[float]] = mapped_column(Float)
    total_billed_inr: Mapped[Optional[float]] = mapped_column(Float)
    
    status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.PENDING_REVIEW, nullable=False
    )

    reporting_period: Mapped["ReportingPeriod"] = relationship(back_populates="electricity_records")
    source_document: Mapped[Optional["UploadedDocument"]] = relationship()


class FuelRecord(Base):
    """Direct thermal and mobile fuel records extracted from procurement invoices."""
    __tablename__ = "fuel_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporting_period_id: Mapped[int] = mapped_column(
        ForeignKey("reporting_periods.id", ondelete="CASCADE"), nullable=False
    )
    source_document_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid, ForeignKey("uploaded_documents.id", ondelete="SET NULL")
    )
    
    fuel_type: Mapped[FuelType] = mapped_column(Enum(FuelType), nullable=False)
    quantity_liters: Mapped[float] = mapped_column(Float, nullable=False)
    total_cost_inr: Mapped[Optional[float]] = mapped_column(Float)
    
    status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.PENDING_REVIEW, nullable=False
    )

    reporting_period: Mapped["ReportingPeriod"] = relationship(back_populates="fuel_records")
    source_document: Mapped[Optional["UploadedDocument"]] = relationship()


class MaterialRecord(Base):
    """Purchased scrap, DRI, and additives extracted from registers or delivery challans."""
    __tablename__ = "material_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporting_period_id: Mapped[int] = mapped_column(
        ForeignKey("reporting_periods.id", ondelete="CASCADE"), nullable=False
    )
    source_document_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid, ForeignKey("uploaded_documents.id", ondelete="SET NULL")
    )
    
    material_type: Mapped[MaterialType] = mapped_column(Enum(MaterialType), nullable=False)
    quantity_tonnes: Mapped[float] = mapped_column(Float, nullable=False)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(255))
    supplier_stated_emission_factor: Mapped[Optional[float]] = mapped_column(Float)
    
    status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.PENDING_REVIEW, nullable=False
    )

    reporting_period: Mapped["ReportingPeriod"] = relationship(back_populates="material_records")
    source_document: Mapped[Optional["UploadedDocument"]] = relationship()
