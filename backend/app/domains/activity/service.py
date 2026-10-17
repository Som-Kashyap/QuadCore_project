"""
Activity domain service layer.
Coordinates verified electricity, fuel, and material activity records.
Enforces multi-tenant OWASP BOLA, state invalidation on reporting periods,
and automated document-to-activity ingestion.
"""

import logging
from typing import Any, Dict, List, Optional, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.activity.models import (
    ElectricityRecord,
    FuelRecord,
    FuelType,
    MaterialRecord,
    MaterialType,
    VerificationStatus,
)
from app.domains.activity.schemas import (
    ElectricityRecordCreate,
    ElectricityRecordUpdate,
    FuelRecordCreate,
    FuelRecordUpdate,
    MaterialRecordCreate,
    MaterialRecordUpdate,
)
from app.domains.documents.models import DocumentCategory, UploadedDocument
from app.domains.firm.models import Firm
from app.domains.reporting.models import ReportingPeriod

logger = logging.getLogger(__name__)


# ==============================================================================
# DOMAIN EXCEPTIONS
# ==============================================================================

class ActivityServiceError(Exception):
    """Base exception for activity domain errors."""
    pass


class ActivityRecordNotFoundError(ActivityServiceError):
    """Raised when an activity record is not found or caller is unauthorized."""
    pass


class ActivityValidationError(ActivityServiceError):
    """Raised when record data violates physical boundaries or business rules."""
    pass


class ActivityPeriodAccessDeniedError(ActivityServiceError):
    """Raised when target reporting period is missing or does not belong to user."""
    pass


# ==============================================================================
# TENANT ISOLATION HELPERS
# ==============================================================================

async def _verify_period_ownership(
    db: AsyncSession,
    period_id: int,
    user_id: int,
) -> ReportingPeriod:
    """Enforces OWASP BOLA: verifies user owns the firm that owns the reporting period."""
    stmt = (
        select(ReportingPeriod)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(ReportingPeriod.id == period_id, Firm.owner_id == user_id)
    )
    res = await db.execute(stmt)
    period = res.scalar_one_or_none()
    if not period:
        logger.warning(
            "Activity rejected: period_id=%s not found or access denied for user_id=%s",
            period_id,
            user_id,
        )
        raise ActivityPeriodAccessDeniedError(
            f"Reporting period {period_id} was not found or access is unauthorized."
        )
    return period


# ==============================================================================
# ELECTRICITY RECORDS
# ==============================================================================

async def create_electricity_record(
    db: AsyncSession,
    record_in: ElectricityRecordCreate,
    user_id: int,
) -> ElectricityRecord:
    """Create a verified or pending electricity consumption record."""
    period = await _verify_period_ownership(db, int(record_in.reporting_period_id), user_id)

    if record_in.consumed_kwh <= 0:
        raise ActivityValidationError("Consumed kWh must be strictly positive.")

    if record_in.power_factor is not None and not (0.0 <= record_in.power_factor <= 1.0):
        raise ActivityValidationError("Power factor must be between 0.0 and 1.0.")

    record = ElectricityRecord(
        reporting_period_id=period.id,
        source_document_id=record_in.source_document_id,
        consumed_kwh=record_in.consumed_kwh,
        peak_demand_kva=record_in.peak_demand_kva,
        power_factor=record_in.power_factor,
        total_billed_inr=record_in.total_billed_inr,
        status=VerificationStatus.PENDING_REVIEW,
    )
    db.add(record)
    period.is_calculation_stale = True

    try:
        await db.flush()
        await db.commit()
        await db.refresh(record)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit electricity record: %s", exc, exc_info=True)
        raise ActivityServiceError("Failed to persist electricity record.") from exc

    logger.info("Created ElectricityRecord id=%s for period_id=%s", record.id, period.id)
    return record


async def get_electricity_record(
    db: AsyncSession,
    record_id: int,
    user_id: int,
) -> ElectricityRecord:
    """Fetch a single electricity record with OWASP BOLA tenant verification."""
    stmt = (
        select(ElectricityRecord)
        .join(ReportingPeriod, ElectricityRecord.reporting_period_id == ReportingPeriod.id)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(ElectricityRecord.id == record_id, Firm.owner_id == user_id)
    )
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise ActivityRecordNotFoundError(f"Electricity record {record_id} was not found.")
    return record


async def list_electricity_records(
    db: AsyncSession,
    period_id: int,
    user_id: int,
) -> Sequence[ElectricityRecord]:
    """List all electricity records for a verified reporting period."""
    await _verify_period_ownership(db, period_id, user_id)
    stmt = (
        select(ElectricityRecord)
        .where(ElectricityRecord.reporting_period_id == period_id)
        .order_by(ElectricityRecord.id.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


async def update_or_verify_electricity_record(
    db: AsyncSession,
    record_id: int,
    update_in: ElectricityRecordUpdate,
    user_id: int,
) -> ElectricityRecord:
    """Update operational data or verification status for an electricity record."""
    record = await get_electricity_record(db, record_id, user_id)
    period = await _verify_period_ownership(db, record.reporting_period_id, user_id)

    update_data = update_in.model_dump(exclude_unset=True)
    if not update_data:
        return record

    if "consumed_kwh" in update_data and update_data["consumed_kwh"] <= 0:
        raise ActivityValidationError("Consumed kWh must be strictly positive.")

    if "power_factor" in update_data and update_data["power_factor"] is not None:
        if not (0.0 <= update_data["power_factor"] <= 1.0):
            raise ActivityValidationError("Power factor must be between 0.0 and 1.0.")

    if "status" in update_data and isinstance(update_data["status"], str):
        update_data["status"] = VerificationStatus(update_data["status"])

    for field, val in update_data.items():
        setattr(record, field, val)

    period.is_calculation_stale = True

    try:
        await db.flush()
        await db.commit()
        await db.refresh(record)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit electricity record update: %s", exc, exc_info=True)
        raise ActivityServiceError("Failed to update electricity record.") from exc

    return record


async def delete_electricity_record(
    db: AsyncSession,
    record_id: int,
    user_id: int,
) -> None:
    """Delete an electricity record and flag period calculations as stale."""
    record = await get_electricity_record(db, record_id, user_id)
    period = await _verify_period_ownership(db, record.reporting_period_id, user_id)

    period.is_calculation_stale = True
    try:
        await db.delete(record)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete electricity record %s: %s", record_id, exc, exc_info=True)
        raise ActivityServiceError("Failed to delete electricity record.") from exc


# ==============================================================================
# FUEL RECORDS
# ==============================================================================

async def create_fuel_record(
    db: AsyncSession,
    record_in: FuelRecordCreate,
    user_id: int,
) -> FuelRecord:
    """Create a verified or pending fuel consumption record."""
    period = await _verify_period_ownership(db, int(record_in.reporting_period_id), user_id)

    if record_in.quantity_liters <= 0:
        raise ActivityValidationError("Fuel quantity in litres must be strictly positive.")

    fuel_enum = FuelType(record_in.fuel_type.value) if isinstance(record_in.fuel_type, FuelType) else FuelType(record_in.fuel_type)

    record = FuelRecord(
        reporting_period_id=period.id,
        source_document_id=record_in.source_document_id,
        fuel_type=fuel_enum,
        quantity_liters=record_in.quantity_liters,
        total_cost_inr=record_in.total_cost_inr,
        status=VerificationStatus.PENDING_REVIEW,
    )
    db.add(record)
    period.is_calculation_stale = True

    try:
        await db.flush()
        await db.commit()
        await db.refresh(record)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit fuel record: %s", exc, exc_info=True)
        raise ActivityServiceError("Failed to persist fuel record.") from exc

    logger.info("Created FuelRecord id=%s for period_id=%s", record.id, period.id)
    return record


async def get_fuel_record(
    db: AsyncSession,
    record_id: int,
    user_id: int,
) -> FuelRecord:
    """Fetch a single fuel record with OWASP BOLA tenant verification."""
    stmt = (
        select(FuelRecord)
        .join(ReportingPeriod, FuelRecord.reporting_period_id == ReportingPeriod.id)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(FuelRecord.id == record_id, Firm.owner_id == user_id)
    )
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise ActivityRecordNotFoundError(f"Fuel record {record_id} was not found.")
    return record


async def list_fuel_records(
    db: AsyncSession,
    period_id: int,
    user_id: int,
) -> Sequence[FuelRecord]:
    """List all fuel consumption records for a verified reporting period."""
    await _verify_period_ownership(db, period_id, user_id)
    stmt = (
        select(FuelRecord)
        .where(FuelRecord.reporting_period_id == period_id)
        .order_by(FuelRecord.id.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


async def update_or_verify_fuel_record(
    db: AsyncSession,
    record_id: int,
    update_in: FuelRecordUpdate,
    user_id: int,
) -> FuelRecord:
    """Update fuel operational data or verification status."""
    record = await get_fuel_record(db, record_id, user_id)
    period = await _verify_period_ownership(db, record.reporting_period_id, user_id)

    update_data = update_in.model_dump(exclude_unset=True)
    if not update_data:
        return record

    if "quantity_liters" in update_data and update_data["quantity_liters"] <= 0:
        raise ActivityValidationError("Fuel quantity in litres must be strictly positive.")

    if "fuel_type" in update_data and update_data["fuel_type"] is not None:
        update_data["fuel_type"] = FuelType(update_data["fuel_type"])

    if "status" in update_data and isinstance(update_data["status"], str):
        update_data["status"] = VerificationStatus(update_data["status"])

    for field, val in update_data.items():
        setattr(record, field, val)

    period.is_calculation_stale = True

    try:
        await db.flush()
        await db.commit()
        await db.refresh(record)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit fuel record update: %s", exc, exc_info=True)
        raise ActivityServiceError("Failed to update fuel record.") from exc

    return record


async def delete_fuel_record(
    db: AsyncSession,
    record_id: int,
    user_id: int,
) -> None:
    """Delete a fuel record and flag period calculations as stale."""
    record = await get_fuel_record(db, record_id, user_id)
    period = await _verify_period_ownership(db, record.reporting_period_id, user_id)

    period.is_calculation_stale = True
    try:
        await db.delete(record)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete fuel record %s: %s", record_id, exc, exc_info=True)
        raise ActivityServiceError("Failed to delete fuel record.") from exc


# ==============================================================================
# MATERIAL RECORDS
# ==============================================================================

async def create_material_record(
    db: AsyncSession,
    record_in: MaterialRecordCreate,
    user_id: int,
) -> MaterialRecord:
    """Create a verified or pending material procurement record."""
    period = await _verify_period_ownership(db, int(record_in.reporting_period_id), user_id)

    if record_in.quantity_tonnes <= 0:
        raise ActivityValidationError("Material quantity in tonnes must be strictly positive.")

    mat_enum = MaterialType(record_in.material_type.value) if isinstance(record_in.material_type, MaterialType) else MaterialType(record_in.material_type)

    record = MaterialRecord(
        reporting_period_id=period.id,
        source_document_id=record_in.source_document_id,
        material_type=mat_enum,
        quantity_tonnes=record_in.quantity_tonnes,
        supplier_name=record_in.supplier_name,
        supplier_stated_emission_factor=record_in.supplier_stated_emission_factor,
        status=VerificationStatus.PENDING_REVIEW,
    )
    db.add(record)
    period.is_calculation_stale = True

    try:
        await db.flush()
        await db.commit()
        await db.refresh(record)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit material record: %s", exc, exc_info=True)
        raise ActivityServiceError("Failed to persist material record.") from exc

    logger.info("Created MaterialRecord id=%s for period_id=%s", record.id, period.id)
    return record


async def get_material_record(
    db: AsyncSession,
    record_id: int,
    user_id: int,
) -> MaterialRecord:
    """Fetch a single material record with OWASP BOLA tenant verification."""
    stmt = (
        select(MaterialRecord)
        .join(ReportingPeriod, MaterialRecord.reporting_period_id == ReportingPeriod.id)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(MaterialRecord.id == record_id, Firm.owner_id == user_id)
    )
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise ActivityRecordNotFoundError(f"Material record {record_id} was not found.")
    return record


async def list_material_records(
    db: AsyncSession,
    period_id: int,
    user_id: int,
) -> Sequence[MaterialRecord]:
    """List all material records for a verified reporting period."""
    await _verify_period_ownership(db, period_id, user_id)
    stmt = (
        select(MaterialRecord)
        .where(MaterialRecord.reporting_period_id == period_id)
        .order_by(MaterialRecord.id.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


async def update_or_verify_material_record(
    db: AsyncSession,
    record_id: int,
    update_in: MaterialRecordUpdate,
    user_id: int,
) -> MaterialRecord:
    """Update material operational data or verification status."""
    record = await get_material_record(db, record_id, user_id)
    period = await _verify_period_ownership(db, record.reporting_period_id, user_id)

    update_data = update_in.model_dump(exclude_unset=True)
    if not update_data:
        return record

    if "quantity_tonnes" in update_data and update_data["quantity_tonnes"] <= 0:
        raise ActivityValidationError("Material quantity in tonnes must be strictly positive.")

    if "material_type" in update_data and update_data["material_type"] is not None:
        update_data["material_type"] = MaterialType(update_data["material_type"])

    if "status" in update_data and isinstance(update_data["status"], str):
        update_data["status"] = VerificationStatus(update_data["status"])

    for field, val in update_data.items():
        setattr(record, field, val)

    period.is_calculation_stale = True

    try:
        await db.flush()
        await db.commit()
        await db.refresh(record)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit material record update: %s", exc, exc_info=True)
        raise ActivityServiceError("Failed to update material record.") from exc

    return record


async def delete_material_record(
    db: AsyncSession,
    record_id: int,
    user_id: int,
) -> None:
    """Delete a material record and flag period calculations as stale."""
    record = await get_material_record(db, record_id, user_id)
    period = await _verify_period_ownership(db, record.reporting_period_id, user_id)

    period.is_calculation_stale = True
    try:
        await db.delete(record)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete material record %s: %s", record_id, exc, exc_info=True)
        raise ActivityServiceError("Failed to delete material record.") from exc


# ==============================================================================
# CONSOLIDATED PERIOD ACTIVITY
# ==============================================================================

async def get_period_activity_summary(
    db: AsyncSession,
    period_id: int,
    user_id: int,
) -> Dict[str, Any]:
    """Retrieve all electricity, fuel, and material records for a reporting period."""
    await _verify_period_ownership(db, period_id, user_id)

    elec_records = await list_electricity_records(db, period_id, user_id)
    fuel_records = await list_fuel_records(db, period_id, user_id)
    mat_records = await list_material_records(db, period_id, user_id)

    return {
        "reporting_period_id": period_id,
        "electricity_records": elec_records,
        "fuel_records": fuel_records,
        "material_records": mat_records,
    }


# ==============================================================================
# DOCUMENT-TO-ACTIVITY INGESTION
# ==============================================================================

async def ingest_extracted_document_to_activity(
    db: AsyncSession,
    document_id: UUID,
    user_id: int,
) -> Dict[str, Any]:
    """
    Parse structured extraction JSON from UploadedDocument and auto-create
    corresponding activity records in PENDING_REVIEW status.
    """
    stmt = (
        select(UploadedDocument)
        .join(ReportingPeriod, UploadedDocument.reporting_period_id == ReportingPeriod.id)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(UploadedDocument.id == document_id, Firm.owner_id == user_id)
    )
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()

    if not doc:
        raise ActivityRecordNotFoundError(f"Document {document_id} was not found or access denied.")

    raw_json = doc.extraction_raw_json
    if not raw_json or not isinstance(raw_json, dict):
        raise ActivityValidationError(f"Document {document_id} does not contain structured extraction data.")

    extracted_fields = raw_json.get("extracted_fields") or raw_json

    period = await _verify_period_ownership(db, doc.reporting_period_id, user_id)

    elec_created = 0
    fuel_created = 0
    mat_created = 0
    details: List[str] = []

    # Category 1: ELECTRICITY_BILL
    if doc.category in (DocumentCategory.ELECTRICITY_BILL, "electricity_bill"):
        consumed = extracted_fields.get("consumed_kwh") or extracted_fields.get("units_kwh")
        if consumed and float(consumed) > 0:
            rec = ElectricityRecord(
                reporting_period_id=period.id,
                source_document_id=doc.id,
                consumed_kwh=float(consumed),
                peak_demand_kva=float(extracted_fields.get("peak_demand_kva") or 0.0) or None,
                power_factor=float(extracted_fields.get("power_factor") or 0.0) or None,
                total_billed_inr=float(extracted_fields.get("total_amount_inr") or extracted_fields.get("total_billed_inr") or 0.0) or None,
                status=VerificationStatus.PENDING_REVIEW,
            )
            db.add(rec)
            elec_created += 1
            details.append(f"Created ElectricityRecord ({consumed} kWh) from utility bill")

    # Category 2: FUEL_INVOICE
    elif doc.category in (DocumentCategory.FUEL_INVOICE, "fuel_invoice"):
        qty = extracted_fields.get("quantity_liters") or extracted_fields.get("volume_litres")
        fuel_str = (extracted_fields.get("fuel_type") or "diesel").lower()
        if qty and float(qty) > 0:
            try:
                fuel_enum = FuelType(fuel_str)
            except ValueError:
                fuel_enum = FuelType.DIESEL

            rec = FuelRecord(
                reporting_period_id=period.id,
                source_document_id=doc.id,
                fuel_type=fuel_enum,
                quantity_liters=float(qty),
                total_cost_inr=float(extracted_fields.get("total_cost_inr") or extracted_fields.get("invoice_amount_inr") or 0.0) or None,
                status=VerificationStatus.PENDING_REVIEW,
            )
            db.add(rec)
            fuel_created += 1
            details.append(f"Created FuelRecord ({qty} L {fuel_enum.value}) from invoice")

    # Category 3: PURCHASE_REGISTER / MATERIAL
    elif doc.category in (DocumentCategory.PURCHASE_REGISTER, "purchase_register"):
        items = extracted_fields.get("items") or [extracted_fields]
        for it in items:
            qty = it.get("quantity_tonnes") or it.get("quantity_t") or it.get("weight_mt")
            mat_str = (it.get("material_type") or "steel_scrap").lower()
            if qty and float(qty) > 0:
                try:
                    mat_enum = MaterialType(mat_str)
                except ValueError:
                    mat_enum = MaterialType.STEEL_SCRAP

                rec = MaterialRecord(
                    reporting_period_id=period.id,
                    source_document_id=doc.id,
                    material_type=mat_enum,
                    quantity_tonnes=float(qty),
                    supplier_name=it.get("supplier_name"),
                    supplier_stated_emission_factor=float(it.get("supplier_emission_factor") or 0.0) or None,
                    status=VerificationStatus.PENDING_REVIEW,
                )
                db.add(rec)
                mat_created += 1
                details.append(f"Created MaterialRecord ({qty} t {mat_enum.value})")

    if elec_created or fuel_created or mat_created:
        period.is_calculation_stale = True
        try:
            await db.flush()
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("Failed to commit ingested activity records: %s", exc, exc_info=True)
            raise ActivityServiceError("Failed to ingest records into activity database.") from exc

    return {
        "document_id": doc.id,
        "reporting_period_id": period.id,
        "electricity_records_created": elec_created,
        "fuel_records_created": fuel_created,
        "material_records_created": mat_created,
        "details": details,
    }
