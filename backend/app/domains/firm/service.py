"""
Firm business logic — CRUD operations with tenant isolation and transaction safety.
No FastAPI dependencies here; this is a pure service layer.
"""

import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.firm.models import Firm
from app.domains.firm.schemas import FirmCreate, FirmUpdate

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain Exceptions
# ---------------------------------------------------------------------------
class FirmServiceError(Exception):
    """Base exception for all firm service domain errors."""
    pass


class FirmNotFoundError(FirmServiceError):
    """Raised when a firm is not found or does not belong to the user."""
    pass


class FirmConflictError(FirmServiceError):
    """Raised when a unique constraint or DB conflict occurs."""
    pass


# ---------------------------------------------------------------------------
# Service Functions
# ---------------------------------------------------------------------------
async def create_firm(
    db: AsyncSession, payload: FirmCreate, user_id: int
) -> Firm:
    """
    Create a new firm assigned to the current user (tenant isolation).

    Raises:
        FirmConflictError: If a constraint violation occurs.
    """
    firm = Firm(
        owner_id=user_id,
        name=payload.name.strip(),
        registration_identifier=(
            payload.registration_identifier.strip()
            if payload.registration_identifier
            else None
        ),
        segment=payload.segment.strip() if payload.segment else "induction_furnace",
        state=payload.state.strip(),
        roof_area_sqm=payload.roof_area_sqm,
        contracted_demand_mva=payload.contracted_demand_mva,
        tariff_category=(
            payload.tariff_category.strip() if payload.tariff_category else None
        ),
    )
    db.add(firm)

    try:
        await db.flush()
        await db.commit()
        await db.refresh(firm)
    except IntegrityError as exc:
        await db.rollback()
        logger.warning(
            "IntegrityError creating firm for user_id=%s: %s", user_id, exc
        )
        raise FirmConflictError("A firm with these details already exists.") from exc
    except Exception as exc:
        await db.rollback()
        logger.error(
            "Unexpected error creating firm for user_id=%s: %s",
            user_id,
            exc,
            exc_info=True,
        )
        raise

    logger.info("Firm created successfully: firm_id=%s owner_id=%s", firm.id, user_id)
    return firm


async def get_firm_by_id(
    db: AsyncSession, firm_id: UUID, user_id: int
) -> Firm:
    """
    Fetch a single firm by UUID with strict owner isolation (OWASP BOLA protection).

    Raises:
        FirmNotFoundError: If firm does not exist or belongs to another user.
    """
    result = await db.execute(
        select(Firm).where(Firm.id == firm_id, Firm.owner_id == user_id)
    )
    firm = result.scalar_one_or_none()

    if firm is None:
        logger.warning(
            "Firm lookup failed or access denied: firm_id=%s user_id=%s",
            firm_id,
            user_id,
        )
        raise FirmNotFoundError("Firm not found")

    return firm


async def list_firms_for_user(
    db: AsyncSession, user_id: int
) -> list[Firm]:
    """
    Retrieve all firms owned by the authenticated user.
    """
    result = await db.execute(
        select(Firm)
        .where(Firm.owner_id == user_id)
        .order_by(Firm.created_at.desc())
    )
    return list(result.scalars().all())


async def update_firm(
    db: AsyncSession, firm_id: UUID, payload: FirmUpdate, user_id: int
) -> Firm:
    """
    Partially update a firm owned by the user.

    Raises:
        FirmNotFoundError: If firm does not exist or user is unauthorized.
        FirmConflictError: If update causes a database constraint conflict.
    """
    firm = await get_firm_by_id(db, firm_id, user_id)
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        return firm

    for key, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(firm, key, value)

    try:
        await db.flush()
        await db.commit()
        await db.refresh(firm)
    except IntegrityError as exc:
        await db.rollback()
        logger.warning(
            "IntegrityError updating firm_id=%s for user_id=%s: %s",
            firm_id,
            user_id,
            exc,
        )
        raise FirmConflictError("Update conflicts with existing data.") from exc
    except Exception as exc:
        await db.rollback()
        logger.error(
            "Unexpected error updating firm_id=%s for user_id=%s: %s",
            firm_id,
            user_id,
            exc,
            exc_info=True,
        )
        raise

    logger.info("Firm updated successfully: firm_id=%s owner_id=%s", firm.id, user_id)
    return firm


async def delete_firm(
    db: AsyncSession, firm_id: UUID, user_id: int
) -> None:
    """
    Delete a firm owned by the user. Cascades to reporting periods and documents.

    Raises:
        FirmNotFoundError: If firm does not exist or user is unauthorized.
    """
    firm = await get_firm_by_id(db, firm_id, user_id)

    try:
        await db.delete(firm)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error(
            "Unexpected error deleting firm_id=%s for user_id=%s: %s",
            firm_id,
            user_id,
            exc,
            exc_info=True,
        )
        raise

    logger.info("Firm deleted successfully: firm_id=%s owner_id=%s", firm_id, user_id)
