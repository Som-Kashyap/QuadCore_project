from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.reporting.schemas import (
    ReportFormat,
    CalculationResultResponse,
    ReportArchiveResponse,
)


router = APIRouter(prefix="/api/reports", tags=["Calculation Engine & Reports"])


@router.post("/calculate/{period_id}", response_model=CalculationResultResponse)
async def calculate_footprint(
    period_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


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
