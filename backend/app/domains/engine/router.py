"""
Calculation Engine and Reporting Endpoints.
Thin presentation controller delegating calculations, pathways, and snapshotting
to the engine service layer with OWASP BOLA protection.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.auth.models import User
from app.domains.engine.service import (
    CalculationValidationError,
    PeriodNotFoundError,
    calculate_period_footprint,
)
from app.domains.reporting.schemas import (
    CalculationResultResponse,
    ReportArchiveResponse,
    ReportFormat,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["Calculation Engine & Reports"])


# --------------------------------------------------------------------------- #
# POST /api/reports/calculate/{period_id}
# --------------------------------------------------------------------------- #
@router.post(
    "/calculate/{period_id}",
    response_model=CalculationResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate deterministic carbon footprint and renewable pathways",
)
async def calculate_footprint(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run deterministic GHG Protocol calculation (Scope 1, Scope 2, Precursor)
    for a reporting period owned by the user, generate rule-based decarbonization
    pathways, and create an immutable audit trail snapshot.
    """
    try:
        period, pathways, snapshot = await calculate_period_footprint(
            db=db,
            period_id=period_id,
            user_id=current_user.id,
        )
    except PeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except CalculationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception calculating footprint for period %s user %s: %s",
            period_id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during footprint calculation",
        )

    return CalculationResultResponse(
        period_id=period.id,
        total_scope1_tco2e=period.total_scope1_tco2e or 0.0,
        total_scope2_tco2e=period.total_scope2_tco2e or 0.0,
        total_precursor_tco2e=period.total_precursor_tco2e or 0.0,
        total_emissions_tco2e=period.total_emissions_tco2e or 0.0,
        specific_emissions_tco2e_per_tonne=period.specific_emissions_tco2e_per_tonne,
        recommendations=pathways,
    )


# --------------------------------------------------------------------------- #
# POST /api/reports/export/{period_id}
# --------------------------------------------------------------------------- #
@router.post(
    "/export/{period_id}",
    response_model=ReportArchiveResponse,
    status_code=status.HTTP_200_OK,
    summary="Export and archive audit report with frozen computation snapshot",
)
async def export_and_archive_report(
    period_id: int,
    format: ReportFormat = Query(..., description="Export format: pdf, xlsx, csv, docx"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an audit report archive frozen with the immutable computation snapshot.
    """
    # Verify period and calculate/freeze snapshot
    try:
        period, pathways, snapshot = await calculate_period_footprint(
            db=db,
            period_id=period_id,
            user_id=current_user.id,
        )
    except PeriodNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Unhandled error exporting report for period %s: %s", period_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while preparing the report export",
        )

    # In prototype: return the archived report response model with snapshot
    # This matches GeneratedReportResponse schema
    from datetime import datetime, timezone
    from uuid import uuid4

    return ReportArchiveResponse(
        id=uuid4(),
        reporting_period_id=period.id,
        report_title=f"Decarbonization Audit Report - {period.start_date} to {period.end_date}",
        report_type="comprehensive_decarbonization",
        export_format=format.value,
        mime_type="application/pdf" if format == ReportFormat.PDF else "application/octet-stream",
        storage_path=f"storage/reports/report_period_{period.id}_{format.value}",
        file_size_bytes=1024,
        computation_snapshot=snapshot,
        generated_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


# --------------------------------------------------------------------------- #
# GET /api/reports/download/{report_id}
# --------------------------------------------------------------------------- #
@router.get(
    "/download/{report_id}",
    response_class=FileResponse,
    summary="Download compiled report artifact",
)
async def download_report_artifact(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream exported report artifact."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Report compilation download is pending worker artifact generation.",
    )
