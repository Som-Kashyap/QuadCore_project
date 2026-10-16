from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.activity.schemas import (
    ElectricityRecordUpdate,
    ElectricityRecordResponse,
    FuelRecordUpdate,
    FuelRecordResponse,
    MaterialRecordUpdate,
    MaterialRecordResponse,
)


router = APIRouter(prefix="/api/activity", tags=["Activity & Verification"])


@router.put(
    "/electricity/{record_id}/verify",
    response_model=ElectricityRecordResponse,
)
async def verify_electricity_record(
    record_id: UUID,
    update_in: ElectricityRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.put(
    "/fuel/{record_id}/verify",
    response_model=FuelRecordResponse,
)
async def verify_fuel_record(
    record_id: UUID,
    update_in: FuelRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass


@router.put(
    "/material/{record_id}/verify",
    response_model=MaterialRecordResponse,
)
async def verify_material_record(
    record_id: UUID,
    update_in: MaterialRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pass