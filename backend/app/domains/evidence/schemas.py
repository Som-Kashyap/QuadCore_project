from datetime import datetime
from typing import Any, Optional, Union
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.core.schemas import TimestampResponse


# ==============================================================================
# EVIDENCE ITEM
# ==============================================================================

class EvidenceItemBase(BaseModel):
    category: str = Field(
        ..., max_length=100, description="Logical category (e.g. 'grid_emission_factor')"
    )
    identifier: str = Field(
        ..., max_length=100, description="Unique slug (e.g. 'IN_NATIONAL_GRID_2023_24')"
    )
    value: float = Field(..., description="Numeric constant (emission factor, tariff rate, etc.)")
    unit: str = Field(..., max_length=50, description="Physical unit (e.g. 'tCO2/MWh')")
    source_title: str = Field(..., max_length=255, description="Human-readable name of the source document")
    source_url: str = Field(..., description="URL of the authoritative source document")
    metadata_payload: Optional[dict[str, Any]] = Field(
        None, description="Arbitrary supplementary metadata from the fetch/parse step"
    )


class EvidenceItemCreate(EvidenceItemBase):
    pass


class EvidenceItemUpdate(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=50)
    source_title: Optional[str] = Field(None, max_length=255)
    source_url: Optional[str] = None
    metadata_payload: Optional[dict[str, Any]] = None


class EvidenceItemResponse(EvidenceItemBase, TimestampResponse):
    model_config = ConfigDict(from_attributes=True)

    id: Union[int, UUID]
    retrieved_at: datetime


# ==============================================================================
# EVIDENCE SYNC (response for POST /evidence/sync)
# ==============================================================================

class EvidenceSyncResponse(BaseModel):
    category: str = Field(..., description="Evidence category synced")
    identifier: str = Field(..., description="Identifier slug")
    evidence_item: EvidenceItemResponse = Field(..., description="Persisted evidence item")
    synced_from_tinyfish: bool = Field(..., description="Whether live TinyFish agent was used or fallback")
