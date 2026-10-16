from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.reporting.schemas import (
    ReportingPeriodCreate,
    ReportingPeriodUpdate,
    ReportingPeriodResponse,
)


router = APIRouter(prefix="/api/reporting-periods", tags=["Reporting Periods"])


@router.post("/", response_model=ReportingPeriodResponse, status_code=201)
async def create_reporting_period(
    period_in: ReportingPeriodCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.get("/{period_id}", response_model=ReportingPeriodResponse)
async def get_reporting_period(
    period_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.patch("/{period_id}", response_model=ReportingPeriodResponse)
async def update_reporting_period(
    period_id: UUID,
    period_in: ReportingPeriodUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.delete("/{period_id}", status_code=204)
async def delete_reporting_period(
    period_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass