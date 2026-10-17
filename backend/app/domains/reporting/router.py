"""
Reporting domain presentation controller.
Exposes REST endpoints for ReportingPeriod CRUD and GeneratedReport archives.
Delegates all business logic to reporting service with OWASP BOLA protection.
"""

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.domains.auth.models import User
from app.domains.reporting.schemas import (
    GeneratedReportResponse,
    ReportingPeriodCreate,
    ReportingPeriodResponse,
    ReportingPeriodUpdate,
)
from app.domains.reporting.service import (
    ReportingPeriodConflictError,
    ReportingPeriodNotFoundError,
    ReportingPeriodValidationError,
    create_reporting_period,
    delete_reporting_period,
    get_reporting_period_by_id,
    list_generated_reports_for_period,
    list_reporting_periods,
    update_reporting_period,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reporting-periods", tags=["Reporting Periods"])


# --------------------------------------------------------------------------- #
# POST /api/reporting-periods/
# --------------------------------------------------------------------------- #
@router.post(
    "/",
    response_model=ReportingPeriodResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new reporting period",
)
async def create_new_period(
    period_in: ReportingPeriodCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new reporting period container for a firm owned by the authenticated user."""
    try:
        return await create_reporting_period(db, period_in, current_user.id)
    except ReportingPeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except ReportingPeriodValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except ReportingPeriodConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception creating reporting period for user %s: %s",
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the reporting period",
        )


# --------------------------------------------------------------------------- #
# GET /api/reporting-periods/
# --------------------------------------------------------------------------- #
@router.get(
    "/",
    response_model=List[ReportingPeriodResponse],
    status_code=status.HTTP_200_OK,
    summary="List all reporting periods owned by user",
)
async def list_periods(
    firm_id: Optional[UUID] = Query(None, description="Filter periods by specific firm UUID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all reporting periods belonging to user's firms, optionally filtered by firm_id."""
    try:
        return await list_reporting_periods(db, current_user.id, firm_id)
    except Exception as exc:
        logger.error(
            "Unhandled exception listing reporting periods for user %s: %s",
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving reporting periods",
        )


# --------------------------------------------------------------------------- #
# GET /api/reporting-periods/{period_id}
# --------------------------------------------------------------------------- #
@router.get(
    "/{period_id}",
    response_model=ReportingPeriodResponse,
    status_code=status.HTTP_200_OK,
    summary="Get reporting period details",
)
async def get_period(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details and calculated totals for a specific reporting period."""
    try:
        return await get_reporting_period_by_id(db, period_id, current_user.id)
    except ReportingPeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception retrieving period %s for user %s: %s",
            period_id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching the reporting period",
        )


# --------------------------------------------------------------------------- #
# PATCH /api/reporting-periods/{period_id}
# --------------------------------------------------------------------------- #
@router.patch(
    "/{period_id}",
    response_model=ReportingPeriodResponse,
    status_code=status.HTTP_200_OK,
    summary="Update reporting period",
)
async def update_period(
    period_id: int,
    period_in: ReportingPeriodUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partially update reporting period dates or production. Flags calculations as stale if dates/production change."""
    try:
        return await update_reporting_period(db, period_id, period_in, current_user.id)
    except ReportingPeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except ReportingPeriodValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception updating period %s for user %s: %s",
            period_id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating the reporting period",
        )


# --------------------------------------------------------------------------- #
# DELETE /api/reporting-periods/{period_id}
# --------------------------------------------------------------------------- #
@router.delete(
    "/{period_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete reporting period",
)
async def delete_period(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a reporting period and cascade deletion to associated records and documents."""
    try:
        await delete_reporting_period(db, period_id, current_user.id)
    except ReportingPeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception deleting period %s for user %s: %s",
            period_id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting the reporting period",
        )


# --------------------------------------------------------------------------- #
# GET /api/reporting-periods/{period_id}/reports
# --------------------------------------------------------------------------- #
@router.get(
    "/{period_id}/reports",
    response_model=List[GeneratedReportResponse],
    status_code=status.HTTP_200_OK,
    summary="List generated reports for period",
)
async def list_reports(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all compiled report archives for the given reporting period."""
    try:
        return await list_generated_reports_for_period(db, period_id, current_user.id)
    except ReportingPeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception listing reports for period %s user %s: %s",
            period_id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving report archives",
        )