"""
Activity domain router.
Provides REST endpoints for electricity, fuel, and material activity tracking,
verification transitions, and automated document-derived ingestion.
"""

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.domains.activity.schemas import (
    DocumentIngestResponse,
    ElectricityRecordCreate,
    ElectricityRecordResponse,
    ElectricityRecordUpdate,
    FuelRecordCreate,
    FuelRecordResponse,
    FuelRecordUpdate,
    MaterialRecordCreate,
    MaterialRecordResponse,
    MaterialRecordUpdate,
    PeriodActivitySummaryResponse,
)
from app.domains.activity.service import (
    ActivityPeriodAccessDeniedError,
    ActivityRecordNotFoundError,
    ActivityValidationError,
    create_electricity_record,
    create_fuel_record,
    create_material_record,
    delete_electricity_record,
    delete_fuel_record,
    delete_material_record,
    get_electricity_record,
    get_fuel_record,
    get_material_record,
    get_period_activity_summary,
    ingest_extracted_document_to_activity,
    list_electricity_records,
    list_fuel_records,
    list_material_records,
    update_or_verify_electricity_record,
    update_or_verify_fuel_record,
    update_or_verify_material_record,
)
from app.domains.auth.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/activity", tags=["Activity & Verification"])


# ==============================================================================
# ELECTRICITY ENDPOINTS
# ==============================================================================

@router.post(
    "/electricity/",
    response_model=ElectricityRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record electricity consumption",
)
async def create_electricity(
    record_in: ElectricityRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new electricity consumption entry for a verified reporting period."""
    try:
        return await create_electricity_record(db, record_in, current_user.id)
    except ActivityPeriodAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ActivityValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("Error creating electricity record: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create electricity record")


@router.get(
    "/electricity/period/{period_id}",
    response_model=List[ElectricityRecordResponse],
    status_code=status.HTTP_200_OK,
    summary="List electricity records for a reporting period",
)
async def list_electricity(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await list_electricity_records(db, period_id, current_user.id)
    except ActivityPeriodAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error listing electricity records for period %s: %s", period_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list electricity records")


@router.get(
    "/electricity/{record_id}",
    response_model=ElectricityRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single electricity record",
)
async def get_electricity(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await get_electricity_record(db, record_id, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error retrieving electricity record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch electricity record")


@router.put(
    "/electricity/{record_id}/verify",
    response_model=ElectricityRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify or update electricity record",
)
@router.patch(
    "/electricity/{record_id}",
    response_model=ElectricityRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Partially update electricity record",
)
async def update_electricity(
    record_id: int,
    update_in: ElectricityRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await update_or_verify_electricity_record(db, record_id, update_in, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ActivityValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("Error updating electricity record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update electricity record")


@router.delete(
    "/electricity/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete electricity record",
)

async def delete_electricity(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await delete_electricity_record(db, record_id, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error deleting electricity record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete electricity record")


# ==============================================================================
# FUEL ENDPOINTS
# ==============================================================================

@router.post(
    "/fuel/",
    response_model=FuelRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record fuel consumption",
)
async def create_fuel(
    record_in: FuelRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new fuel consumption entry (diesel, furnace oil, LPG)."""
    try:
        return await create_fuel_record(db, record_in, current_user.id)
    except ActivityPeriodAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ActivityValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("Error creating fuel record: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create fuel record")


@router.get(
    "/fuel/period/{period_id}",
    response_model=List[FuelRecordResponse],
    status_code=status.HTTP_200_OK,
    summary="List fuel records for a reporting period",
)
async def list_fuel(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await list_fuel_records(db, period_id, current_user.id)
    except ActivityPeriodAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error listing fuel records for period %s: %s", period_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list fuel records")


@router.get(
    "/fuel/{record_id}",
    response_model=FuelRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single fuel record",
)
async def get_fuel(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await get_fuel_record(db, record_id, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error retrieving fuel record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch fuel record")


@router.put(
    "/fuel/{record_id}/verify",
    response_model=FuelRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify or update fuel record",
)
@router.patch(
    "/fuel/{record_id}",
    response_model=FuelRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Partially update fuel record",
)
async def update_fuel(
    record_id: int,
    update_in: FuelRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await update_or_verify_fuel_record(db, record_id, update_in, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ActivityValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("Error updating fuel record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update fuel record")


@router.delete(
    "/fuel/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete fuel record",
)
async def delete_fuel(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await delete_fuel_record(db, record_id, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error deleting fuel record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete fuel record")


# ==============================================================================
# MATERIAL ENDPOINTS
# ==============================================================================

@router.post(
    "/material/",
    response_model=MaterialRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record material procurement",
)
async def create_material(
    record_in: MaterialRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new material entry (scrap, DRI, ferroalloys)."""
    try:
        return await create_material_record(db, record_in, current_user.id)
    except ActivityPeriodAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ActivityValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("Error creating material record: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create material record")


@router.get(
    "/material/period/{period_id}",
    response_model=List[MaterialRecordResponse],
    status_code=status.HTTP_200_OK,
    summary="List material records for a reporting period",
)
async def list_material(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await list_material_records(db, period_id, current_user.id)
    except ActivityPeriodAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error listing material records for period %s: %s", period_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list material records")


@router.get(
    "/material/{record_id}",
    response_model=MaterialRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single material record",
)
async def get_material(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await get_material_record(db, record_id, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error retrieving material record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch material record")


@router.put(
    "/material/{record_id}/verify",
    response_model=MaterialRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify or update material record",
)
@router.patch(
    "/material/{record_id}",
    response_model=MaterialRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Partially update material record",
)
async def update_material(
    record_id: int,
    update_in: MaterialRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await update_or_verify_material_record(db, record_id, update_in, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ActivityValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("Error updating material record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update material record")


@router.delete(
    "/material/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete material record",
)
async def delete_material(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await delete_material_record(db, record_id, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error deleting material record %s: %s", record_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete material record")


# ==============================================================================
# CONSOLIDATED SUMMARY & INGESTION
# ==============================================================================

@router.get(
    "/period/{period_id}",
    response_model=PeriodActivitySummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get consolidated activity records for reporting period",
)
async def get_period_summary(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all electricity, fuel, and material records belonging to a reporting period."""
    try:
        return await get_period_activity_summary(db, period_id, current_user.id)
    except ActivityPeriodAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error fetching activity summary for period %s: %s", period_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch period activity")


@router.post(
    "/ingest/{document_id}",
    response_model=DocumentIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Auto-ingest extracted document metrics into activity records",
)
async def ingest_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse extracted LLM fields from an uploaded document into pending activity records."""
    try:
        return await ingest_extracted_document_to_activity(db, document_id, current_user.id)
    except ActivityRecordNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ActivityValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("Error ingesting document %s into activity: %s", document_id, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to ingest document metrics")