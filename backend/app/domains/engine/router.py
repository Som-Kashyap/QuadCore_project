from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db, get_current_user

# Import every model module so SQLAlchemy can resolve all relationship() strings.
from app.domains.firm import models as _firm_models  # noqa: F401
from app.domains.documents import models as _document_models  # noqa: F401
from app.domains.activity.models import VerificationStatus
from app.domains.reporting.models import ReportingPeriod

from app.domains.engine.engine import DEFAULT_EMISSION_FACTORS, calculate_emissions
from app.domains.reporting.schemas import (
    ReportFormat,
    CalculationResultResponse,
    ReportArchiveResponse,
)


router = APIRouter(prefix="/api/reports", tags=["Calculation Engine & Reports"])


@router.post("/calculate/{period_id}", response_model=CalculationResultResponse)
async def calculate_footprint(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    stmt = (
        select(ReportingPeriod)
        .where(ReportingPeriod.id == period_id)
        .options(
            selectinload(ReportingPeriod.electricity_records),
            selectinload(ReportingPeriod.fuel_records),
            selectinload(ReportingPeriod.material_records),
        )
    )
    period = (await db.execute(stmt)).scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail="Reporting period not found")

    # Flagged records are excluded; pending and confirmed records are included.
    def usable(records):
        return [r for r in records if r.status != VerificationStatus.FLAGGED]

    electricity_kwh = sum(r.consumed_kwh for r in usable(period.electricity_records))

    fuel_litres: dict[str, float] = defaultdict(float)
    for r in usable(period.fuel_records):
        fuel_litres[r.fuel_type.value] += r.quantity_liters

    materials_tonnes: dict[str, float] = defaultdict(float)
    for r in usable(period.material_records):
        materials_tonnes[r.material_type.value] += r.quantity_tonnes

    try:
        result = calculate_emissions(
            electricity_kwh=electricity_kwh,
            fuel_litres=fuel_litres,
            materials_tonnes=materials_tonnes,
            production_tonnes=period.production_tonnes,
            factors=DEFAULT_EMISSION_FACTORS,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Persist the deterministic results on the period.
    period.total_scope1_tco2e = result.scope1_tco2e
    period.total_scope2_tco2e = result.scope2_tco2e
    period.total_precursor_tco2e = result.precursor_tco2e
    period.total_emissions_tco2e = result.total_tco2e
    period.specific_emissions_tco2e_per_tonne = result.tco2e_per_tonne
    period.is_calculation_stale = False
    await db.commit()

    return CalculationResultResponse(
        period_id=period.id,
        total_scope1_tco2e=result.scope1_tco2e,
        total_scope2_tco2e=result.scope2_tco2e,
        total_precursor_tco2e=result.precursor_tco2e,
        total_emissions_tco2e=result.total_tco2e,
        specific_emissions_tco2e_per_tonne=result.tco2e_per_tonne,
        recommendations=[],  # pathways engine (pathways.py) is not implemented yet
    )


@router.post("/export/{period_id}", response_model=ReportArchiveResponse)
async def export_and_archive_report(
    period_id: UUID,
    format: ReportFormat = Query(..., description="Export format: pdf, xlsx, csv, docx"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.get("/download/{report_id}", response_class=FileResponse)
async def download_report_artifact(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass
