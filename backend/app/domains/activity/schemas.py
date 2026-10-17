from enum import Enum
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from app.core.schemas import TimestampResponse


# ==============================================================================
# ENUMS (Pydantic / API models)
# ==============================================================================

class VerificationStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    FLAGGED = "flagged"


class FuelType(str, Enum):
    DIESEL = "diesel"
    FURNACE_OIL = "furnace_oil"
    LPG = "lpg"


class MaterialType(str, Enum):
    STEEL_SCRAP = "steel_scrap"
    SPONGE_IRON_DRI_COAL = "sponge_iron_dri_coal"
    SPONGE_IRON_DRI_GAS = "sponge_iron_dri_gas"
    FERRO_MANGANESE = "ferro_manganese"
    FERRO_SILICON = "ferro_silicon"
    CARBON_ADDITIVE = "carbon_additive"


# ==============================================================================
# ELECTRICITY RECORD
# ==============================================================================

class ElectricityRecordBase(BaseModel):
    reporting_period_id: UUID = Field(..., description="FK to parent ReportingPeriod")
    source_document_id: Optional[UUID] = Field(
        None, description="FK to the UploadedDocument this was extracted from"
    )
    consumed_kwh: float = Field(..., gt=0, description="Total electricity consumed in kWh")
    peak_demand_kva: Optional[float] = Field(None, gt=0, description="Recorded peak demand in kVA")
    power_factor: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Power factor (0.0 – 1.0)"
    )
    total_billed_inr: Optional[float] = Field(None, ge=0, description="Total billed amount in INR")


class ElectricityRecordCreate(ElectricityRecordBase):
    pass


class ElectricityRecordUpdate(BaseModel):
    consumed_kwh: Optional[float] = Field(None, gt=0)
    peak_demand_kva: Optional[float] = Field(None, gt=0)
    power_factor: Optional[float] = Field(None, ge=0.0, le=1.0)
    total_billed_inr: Optional[float] = Field(None, ge=0)
    status: Optional[VerificationStatus] = None


class ElectricityRecordResponse(ElectricityRecordBase, TimestampResponse):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: VerificationStatus


# ==============================================================================
# FUEL RECORD
# ==============================================================================

class FuelRecordBase(BaseModel):
    reporting_period_id: UUID = Field(..., description="FK to parent ReportingPeriod")
    source_document_id: Optional[UUID] = Field(
        None, description="FK to the UploadedDocument this was extracted from"
    )
    fuel_type: FuelType
    quantity_liters: float = Field(..., gt=0, description="Volume of fuel consumed in litres")
    total_cost_inr: Optional[float] = Field(None, ge=0, description="Total invoice cost in INR")


class FuelRecordCreate(FuelRecordBase):
    pass


class FuelRecordUpdate(BaseModel):
    fuel_type: Optional[FuelType] = None
    quantity_liters: Optional[float] = Field(None, gt=0)
    total_cost_inr: Optional[float] = Field(None, ge=0)
    status: Optional[VerificationStatus] = None


class FuelRecordResponse(FuelRecordBase, TimestampResponse):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: VerificationStatus


# ==============================================================================
# MATERIAL RECORD
# ==============================================================================

class MaterialRecordBase(BaseModel):
    reporting_period_id: UUID = Field(..., description="FK to parent ReportingPeriod")
    source_document_id: Optional[UUID] = Field(
        None, description="FK to the UploadedDocument this was extracted from"
    )
    material_type: MaterialType
    quantity_tonnes: float = Field(..., gt=0, description="Mass of material purchased in tonnes")
    supplier_name: Optional[str] = Field(None, max_length=255)
    supplier_stated_emission_factor: Optional[float] = Field(
        None, ge=0, description="Supplier-declared emission factor (tCO₂e/t material)"
    )


class MaterialRecordCreate(MaterialRecordBase):
    pass


class MaterialRecordUpdate(BaseModel):
    material_type: Optional[MaterialType] = None
    quantity_tonnes: Optional[float] = Field(None, gt=0)
    supplier_name: Optional[str] = Field(None, max_length=255)
    supplier_stated_emission_factor: Optional[float] = Field(None, ge=0)
    status: Optional[VerificationStatus] = None


class MaterialRecordResponse(MaterialRecordBase, TimestampResponse):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: VerificationStatus
