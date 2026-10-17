"""
Reporting domain service layer.
Handles ReportingPeriod lifecycle and GeneratedReport archives with OWASP BOLA protection.
"""

import logging
from typing import Optional, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.firm.models import Firm
from app.domains.reporting.models import GeneratedReport, ReportingPeriod
from app.domains.reporting.schemas import ReportingPeriodCreate, ReportingPeriodUpdate

logger = logging.getLogger(__name__)


# ==============================================================================
# DOMAIN EXCEPTIONS
# ==============================================================================

class ReportingServiceError(Exception):
    """Base exception for reporting domain errors."""
    pass


class ReportingPeriodNotFoundError(ReportingServiceError):
    """Raised when reporting period is not found or access is denied (OWASP BOLA)."""
    pass


class ReportingPeriodValidationError(ReportingServiceError):
    """Raised when period dates or physical constraints are invalid."""
    pass


class ReportingPeriodConflictError(ReportingServiceError):
    """Raised when a reporting period already exists for the same boundary."""
    pass


class GeneratedReportNotFoundError(ReportingServiceError):
    """Raised when a generated report artifact is not found or unauthorized."""
    pass


# ==============================================================================
# SERVICE FUNCTIONS
# ==============================================================================

async def create_reporting_period(
    db: AsyncSession,
    period_in: ReportingPeriodCreate,
    user_id: int,
) -> ReportingPeriod:
    """
    Create a new reporting period container for a firm owned by the user.
    Validates tenant ownership and date sanity.
    """
    # 1. Enforce OWASP BOLA: Ensure firm exists and belongs to current_user
    firm_stmt = select(Firm).where(Firm.id == period_in.firm_id, Firm.owner_id == user_id)
    firm_res = await db.execute(firm_stmt)
    firm = firm_res.scalar_one_or_none()
    if not firm:
        logger.warning(
            "ReportingPeriod creation denied: firm_id=%s not found or access denied for user_id=%s",
            period_in.firm_id,
            user_id,
        )
        raise ReportingPeriodNotFoundError(
            f"Firm with ID {period_in.firm_id} was not found or access is unauthorized."
        )

    # 2. Date sanity check
    if period_in.start_date > period_in.end_date:
        raise ReportingPeriodValidationError(
            f"Start date ({period_in.start_date}) cannot be after end date ({period_in.end_date})."
        )

    # 3. Check for exact duplicate reporting period
    dup_stmt = select(ReportingPeriod).where(
        ReportingPeriod.firm_id == period_in.firm_id,
        ReportingPeriod.start_date == period_in.start_date,
        ReportingPeriod.end_date == period_in.end_date,
    )
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        raise ReportingPeriodConflictError(
            f"A reporting period for firm {period_in.firm_id} from {period_in.start_date} to {period_in.end_date} already exists."
        )

    # 4. Instantiate and persist
    period = ReportingPeriod(
        firm_id=period_in.firm_id,
        start_date=period_in.start_date,
        end_date=period_in.end_date,
        production_tonnes=period_in.production_tonnes,
        is_calculation_stale=True,
    )
    db.add(period)
    try:
        await db.flush()
        await db.commit()
        await db.refresh(period)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit new reporting period: %s", exc, exc_info=True)
        raise ReportingServiceError("Database error occurred while creating reporting period.") from exc

    logger.info("Created ReportingPeriod id=%s for firm_id=%s", period.id, period.firm_id)
    return period


async def get_reporting_period_by_id(
    db: AsyncSession,
    period_id: int,
    user_id: int,
) -> ReportingPeriod:
    """
    Retrieve a reporting period ensuring the caller owns the parent firm (OWASP BOLA).
    """
    stmt = (
        select(ReportingPeriod)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(
            ReportingPeriod.id == period_id,
            Firm.owner_id == user_id,
        )
    )
    res = await db.execute(stmt)
    period = res.scalar_one_or_none()
    if not period:
        logger.warning(
            "Access denied or period not found: period_id=%s, user_id=%s",
            period_id,
            user_id,
        )
        raise ReportingPeriodNotFoundError(f"Reporting period with ID {period_id} was not found.")
    return period


async def list_reporting_periods(
    db: AsyncSession,
    user_id: int,
    firm_id: Optional[UUID] = None,
) -> Sequence[ReportingPeriod]:
    """
    List reporting periods owned by the user, optionally filtered by firm_id.
    """
    stmt = (
        select(ReportingPeriod)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(Firm.owner_id == user_id)
    )
    if firm_id is not None:
        stmt = stmt.where(ReportingPeriod.firm_id == firm_id)

    stmt = stmt.order_by(ReportingPeriod.start_date.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


async def update_reporting_period(
    db: AsyncSession,
    period_id: int,
    period_in: ReportingPeriodUpdate,
    user_id: int,
) -> ReportingPeriod:
    """
    Update reporting period details (dates, production). If operational parameters change,
    mark calculation as stale.
    """
    period = await get_reporting_period_by_id(db, period_id, user_id)

    update_data = period_in.model_dump(exclude_unset=True)
    if not update_data:
        return period

    new_start = update_data.get("start_date", period.start_date)
    new_end = update_data.get("end_date", period.end_date)
    if new_start > new_end:
        raise ReportingPeriodValidationError(
            f"Start date ({new_start}) cannot be after end date ({new_end})."
        )

    # If date range or production volume changed, flag calculations as stale
    stale_triggers = {"start_date", "end_date", "production_tonnes"}
    if any(k in update_data and update_data[k] != getattr(period, k) for k in stale_triggers):
        period.is_calculation_stale = True

    for field, val in update_data.items():
        setattr(period, field, val)

    try:
        await db.flush()
        await db.commit()
        await db.refresh(period)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit update for period %s: %s", period_id, exc, exc_info=True)
        raise ReportingServiceError("Database error occurred while updating reporting period.") from exc

    return period


async def delete_reporting_period(
    db: AsyncSession,
    period_id: int,
    user_id: int,
) -> None:
    """
    Delete a reporting period. Cascades to documents, activity records, and generated reports.
    """
    period = await get_reporting_period_by_id(db, period_id, user_id)
    try:
        await db.delete(period)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete period %s: %s", period_id, exc, exc_info=True)
        raise ReportingServiceError("Database error occurred while deleting reporting period.") from exc
    logger.info("Deleted reporting period %s by user %s", period_id, user_id)


async def list_generated_reports_for_period(
    db: AsyncSession,
    period_id: int,
    user_id: int,
) -> Sequence[GeneratedReport]:
    """
    List all generated audit reports archived for a reporting period.
    """
    # Enforce BOLA via period lookup
    await get_reporting_period_by_id(db, period_id, user_id)

    stmt = (
        select(GeneratedReport)
        .where(GeneratedReport.reporting_period_id == period_id)
        .order_by(GeneratedReport.generated_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()
