from datetime import date, datetime
from enum import Enum
from typing import Optional, Any, Union
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


from app.core.schemas import TimestampResponse


# ==============================================================================
# ENUMS (Pydantic / API models)
# ==============================================================================

class ReportFormat(str, Enum):
    PDF = "pdf"
    EXCEL = "xlsx"
    CSV = "csv"
    DOCX = "docx"


class ReportType(str, Enum):
    COMPREHENSIVE_DECARBONIZATION = "comprehensive_decarbonization"
    EU_CBAM_SUPPLIER_SHEET = "eu_cbam_supplier_sheet"
    INTERNAL_AUDIT_SUMMARY = "internal_audit_summary"


# ==============================================================================
# REPORTING PERIOD
# ==============================================================================

class ReportingPeriodBase(BaseModel):
    firm_id: UUID = Field(..., description="FK to the owning Firm")
    start_date: date = Field(..., description="Period start date (inclusive)")
    end_date: date = Field(..., description="Period end date (inclusive)")
    production_tonnes: Optional[float] = Field(
        None, gt=0, description="Total billet / finished product in tonnes"
    )


class ReportingPeriodCreate(ReportingPeriodBase):
    pass


class ReportingPeriodUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    production_tonnes: Optional[float] = Field(None, gt=0)


class ReportingPeriodResponse(ReportingPeriodBase, TimestampResponse):
    model_config = ConfigDict(from_attributes=True)

    id: Union[int, UUID]

    # Calculated emission totals (populated by the engine after a run)
    total_scope1_tco2e: Optional[float] = None
    total_scope2_tco2e: Optional[float] = None
    total_precursor_tco2e: Optional[float] = None
    total_emissions_tco2e: Optional[float] = None
    specific_emissions_tco2e_per_tonne: Optional[float] = None
    is_calculation_stale: bool


# ==============================================================================
# GENERATED REPORT
# ==============================================================================

class GeneratedReportBase(BaseModel):
    reporting_period_id: Union[int, UUID] = Field(..., description="FK to the parent ReportingPeriod")
    report_title: str = Field(..., max_length=255)

    report_type: ReportType
    export_format: ReportFormat
    mime_type: str = Field(..., max_length=100)
    storage_path: str = Field(..., description="S3 URI or local storage key")
    file_size_bytes: int = Field(..., gt=0)
    computation_snapshot: dict[str, Any] = Field(
        ..., description="Frozen calculation snapshot used to render this report"
    )


class GeneratedReportCreate(GeneratedReportBase):
    pass


class GeneratedReportResponse(GeneratedReportBase, TimestampResponse):
    model_config = ConfigDict(from_attributes=True)

    id: Union[int, UUID]
    generated_at: datetime


# ==============================================================================
# CALCULATION ENGINE (response for POST /reports/calculate/{period_id})
# ==============================================================================

class CalculationResultResponse(BaseModel):
    # int: matches ReportingPeriod.id (Integer PK in models and migration)
    period_id: int
    total_scope1_tco2e: float = Field(..., description="Total Scope 1 emissions in tCO₂e")
    total_scope2_tco2e: float = Field(..., description="Total Scope 2 emissions in tCO₂e")
    total_precursor_tco2e: float = Field(..., description="Total precursor (Scope 3 upstream) in tCO₂e")
    total_emissions_tco2e: float = Field(..., description="Grand total emissions in tCO₂e")
    specific_emissions_tco2e_per_tonne: Optional[float] = Field(
        None, description="Emission intensity per tonne of product"
    )
    recommendations: list[Union[str, dict[str, Any]]] = Field(
        default_factory=list, description="Renewable / efficiency recommendations from the pathways engine"
    )



# ==============================================================================
# REPORT ARCHIVE (response for POST /reports/export/{period_id})
# ==============================================================================

class ReportArchiveResponse(GeneratedReportResponse):
    """Wraps GeneratedReportResponse — returned when a report is compiled and archived."""
    pass
