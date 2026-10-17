"""
Firm endpoints — create, list, retrieve, update, delete.
Thin presentation controller delegating all business logic to the service layer.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.auth.models import User
from app.domains.firm.schemas import FirmCreate, FirmResponse, FirmUpdate
from app.domains.firm.service import (
    FirmConflictError,
    FirmNotFoundError,
    create_firm,
    delete_firm,
    get_firm_by_id,
    list_firms_for_user,
    update_firm,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/firms", tags=["Firms"])


# --------------------------------------------------------------------------- #
# POST /api/firms/
# --------------------------------------------------------------------------- #
@router.post(
    "/",
    response_model=FirmResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new firm",
)
async def create_new_firm(
    firm_in: FirmCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new firm entity owned by the authenticated user."""
    try:
        return await create_firm(db, firm_in, current_user.id)
    except FirmConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception creating firm for user %s: %s",
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the firm",
        )


# --------------------------------------------------------------------------- #
# GET /api/firms/
# --------------------------------------------------------------------------- #
@router.get(
    "/",
    response_model=list[FirmResponse],
    status_code=status.HTTP_200_OK,
    summary="List all firms owned by user",
)
async def list_firms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all firms associated with the authenticated user."""
    try:
        return await list_firms_for_user(db, current_user.id)
    except Exception as exc:
        logger.error(
            "Unhandled exception listing firms for user %s: %s",
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving firms",
        )


# --------------------------------------------------------------------------- #
# GET /api/firms/{firm_id}
# --------------------------------------------------------------------------- #
@router.get(
    "/{firm_id}",
    response_model=FirmResponse,
    status_code=status.HTTP_200_OK,
    summary="Get firm details",
)
async def get_firm(
    firm_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch details of a specific firm owned by the user."""
    try:
        return await get_firm_by_id(db, firm_id, current_user.id)
    except FirmNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception fetching firm %s for user %s: %s",
            firm_id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching the firm",
        )


# --------------------------------------------------------------------------- #
# PATCH /api/firms/{firm_id}
# --------------------------------------------------------------------------- #
@router.patch(
    "/{firm_id}",
    response_model=FirmResponse,
    status_code=status.HTTP_200_OK,
    summary="Update firm baseline",
)
async def update_existing_firm(
    firm_id: UUID,
    firm_in: FirmUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partially update operational parameters for a firm owned by the user."""
    try:
        return await update_firm(db, firm_id, firm_in, current_user.id)
    except FirmNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except FirmConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception updating firm %s for user %s: %s",
            firm_id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating the firm",
        )


# --------------------------------------------------------------------------- #
# DELETE /api/firms/{firm_id}
# --------------------------------------------------------------------------- #
@router.delete(
    "/{firm_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a firm",
)
async def remove_firm(
    firm_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a firm and cascade to its reporting periods and documents."""
    try:
        await delete_firm(db, firm_id, current_user.id)
    except FirmNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Unhandled exception deleting firm %s for user %s: %s",
            firm_id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting the firm",
        )
