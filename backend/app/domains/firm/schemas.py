from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

from app.core.schemas import TimestampResponse


# ==============================================================================
# BASE SCHEMA
# ==============================================================================

class FirmBase(BaseModel):
    name: str = Field(..., max_length=255, description="Factory or company name")
    registration_identifier: Optional[str] = Field(
        None, max_length=100, description="GSTIN or CIN"
    )
    segment: str = Field(
        default="induction_furnace",
        max_length=100,
        description="Industry segment (e.g. induction_furnace)",
    )
    state: str = Field(..., max_length=100, description="State where the firm operates")
    roof_area_sqm: Optional[float] = Field(
        None, gt=0, description="Available rooftop area in square metres"
    )
    contracted_demand_mva: Optional[float] = Field(
        None, gt=0, description="Contracted demand with utility in MVA"
    )
    tariff_category: Optional[str] = Field(
        None, max_length=100, description="Electricity tariff category"
    )


# ==============================================================================
# CREATE  (request body → POST /firms)
# ==============================================================================

class FirmCreate(FirmBase):
    pass


# ==============================================================================
# UPDATE  (request body → PATCH /firms/{id})
# ==============================================================================

class FirmUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    registration_identifier: Optional[str] = Field(None, max_length=100)
    segment: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    roof_area_sqm: Optional[float] = Field(None, gt=0)
    contracted_demand_mva: Optional[float] = Field(None, gt=0)
    tariff_category: Optional[str] = Field(None, max_length=100)


# ==============================================================================
# RESPONSE  (serialized ORM row → GET /firms/{id})
# ==============================================================================

class FirmResponse(FirmBase, TimestampResponse):
    model_config = ConfigDict(from_attributes=True)

    id: int
