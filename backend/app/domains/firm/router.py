from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.firm.schemas import FirmCreate, FirmUpdate, FirmResponse


router = APIRouter(prefix="/api/firms", tags=["Firms"])


@router.post("/", response_model=FirmResponse, status_code=201)
async def create_firm(
    firm_in: FirmCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.get("/{firm_id}", response_model=FirmResponse)
async def get_firm(
    firm_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.delete("/{firm_id}", status_code=204)
async def delete_firm(
    firm_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass
