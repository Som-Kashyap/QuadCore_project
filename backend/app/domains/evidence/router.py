"""
Evidence domain router.
Provides endpoints to trigger live regulatory data synchronization via TinyFish
and retrieve cached Indian regulatory baselines (CEA Power Sector CO2 factors).
"""

from datetime import datetime, timezone
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.domains.auth.models import User
from app.domains.evidence.agents import fetch_cea_grid_factor
from app.domains.evidence.models import EvidenceItem
from app.domains.evidence.schemas import EvidenceItemResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/evidence", tags=["Evidence & TinyFish"])


# --------------------------------------------------------------------------- #
# POST /api/evidence/sync
# --------------------------------------------------------------------------- #
@router.post(
    "/sync",
    response_model=EvidenceItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger regulatory evidence sync via TinyFish",
)
async def trigger_evidence_sync(
    category: str = Query(
        "grid_emission_factor",
        description="Category to sync: 'grid_emission_factor' (CEA Indian National Grid)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run TinyFish agent to discover and parse the latest CEA Indian Power Sector CO2 baseline.
    Upserts the result into the persistent `evidence_items` database table.
    Guarantees resilient fallback to 0.727 tCO2/MWh if TinyFish encounters network or API issues.
    """
    logger.info("Evidence sync triggered by user %s for category: %s", current_user.id, category)

    # 1. Fetch data from TinyFish (with guaranteed fallback)
    try:
        data = await fetch_cea_grid_factor()
    except Exception as exc:
        logger.error("Unexpected error in fetch_cea_grid_factor: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve regulatory evidence.",
        )

    # 2. Database Upsert: check for existing record in this category
    try:
        stmt = select(EvidenceItem).where(
            EvidenceItem.category == data["category"],
            EvidenceItem.identifier == data["identifier"],
        )
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()

        if not item:
            # Check by category only if identifier has changed
            stmt_cat = select(EvidenceItem).where(EvidenceItem.category == data["category"])
            res_cat = await db.execute(stmt_cat)
            item = res_cat.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if item:
            logger.info("Updating existing EvidenceItem id=%s for category=%s", item.id, item.category)
            item.identifier = data["identifier"]
            item.value = data["value"]
            item.unit = data["unit"]
            item.source_title = data["source_title"]
            item.source_url = data["source_url"]
            item.retrieved_at = now
            item.metadata_payload = data.get("metadata_payload")
        else:
            logger.info("Inserting new EvidenceItem for category=%s", data["category"])
            item = EvidenceItem(
                category=data["category"],
                identifier=data["identifier"],
                value=data["value"],
                unit=data["unit"],
                source_title=data["source_title"],
                source_url=data["source_url"],
                retrieved_at=now,
                metadata_payload=data.get("metadata_payload"),
            )
            db.add(item)

        await db.flush()
        await db.commit()
        await db.refresh(item)
    except Exception as exc:
        await db.rollback()
        logger.error("Database transaction failed during evidence upsert: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist evidence item to database.",
        )

    return item


# --------------------------------------------------------------------------- #
# GET /api/evidence/
# --------------------------------------------------------------------------- #
@router.get(
    "/",
    response_model=List[EvidenceItemResponse],
    status_code=status.HTTP_200_OK,
    summary="List all cached regulatory evidence items",
)
async def list_evidence_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all cached regulatory evidence items for audit compliance verification."""
    stmt = select(EvidenceItem).order_by(EvidenceItem.category.asc())
    res = await db.execute(stmt)
    return res.scalars().all()


# --------------------------------------------------------------------------- #
# GET /api/evidence/{category}
# --------------------------------------------------------------------------- #
@router.get(
    "/{category}",
    response_model=EvidenceItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Get cached regulatory evidence item by category",
)
async def get_evidence_by_category(
    category: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the latest cached evidence record for a given category (e.g., 'grid_emission_factor')."""
    stmt = select(EvidenceItem).where(EvidenceItem.category == category)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No evidence item found for category: '{category}'. Trigger /api/evidence/sync first.",
        )
    return item