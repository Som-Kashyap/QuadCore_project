from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.evidence.schemas import EvidenceSyncResponse


router = APIRouter(prefix="/api/evidence", tags=["Evidence & TinyFish"])


@router.post("/sync", response_model=EvidenceSyncResponse)
async def trigger_evidence_sync(
    state: str = Query(..., description="State code to fetch evidence for"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass