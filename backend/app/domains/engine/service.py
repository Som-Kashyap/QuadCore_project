"""
Engine service layer coordinating deterministic emission calculation,
renewable pathway generation, audit snapshot creation, and database persistence.
"""

from collections import defaultdict
import logging
from typing import Any, Dict, List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.activity.models import VerificationStatus
from app.domains.engine.engine import (
    DEFAULT_EMISSION_FACTORS,
    EmissionFactors,
    EmissionResult,
    calculate_emissions,
)
from app.domains.engine.pathways import FactoryParameters, generate_decarbonization_pathways
from app.domains.engine.snapshot import build_computation_snapshot
from app.domains.firm.models import Firm
from app.domains.reporting.models import ReportingPeriod

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain Exceptions
# ---------------------------------------------------------------------------
class EngineServiceError(Exception):
    """Base exception for all calculation engine domain errors."""
    pass


class PeriodNotFoundError(EngineServiceError):
    """Raised when a reporting period is not found or does not belong to the user."""
    pass


class CalculationValidationError(EngineServiceError):
    """Raised when calculation inputs or factors violate physical bounds."""
    pass


# ---------------------------------------------------------------------------
# Service Functions
# ---------------------------------------------------------------------------
async def calculate_period_footprint(
    db: AsyncSession,
    period_id: int,
    user_id: int,
    custom_factors: EmissionFactors | None = None,
) -> Tuple[ReportingPeriod, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Orchestrate deterministic emission calculation, renewable pathways generation,
    and audit trail snapshotting for a verified reporting period owned by user.

    Returns:
        Tuple of (updated ReportingPeriod, list of pathway recommendations, computation snapshot).
    """
    # 1. Tenant ownership validation and eager loading of activity records
    query = (
        select(ReportingPeriod)
        .join(Firm, ReportingPeriod.firm_id == Firm.id)
        .where(
            ReportingPeriod.id == period_id,
            Firm.owner_id == user_id,
        )
        .options(
            selectinload(ReportingPeriod.electricity_records),
            selectinload(ReportingPeriod.fuel_records),
            selectinload(ReportingPeriod.material_records),
            selectinload(ReportingPeriod.firm),
        )
    )
    result = await db.execute(query)
    period = result.scalar_one_or_none()

    if period is None:
        logger.warning(
            "Calculation rejected: period_id=%s not found or access denied for user_id=%s",
            period_id,
            user_id,
        )
        raise PeriodNotFoundError("Reporting period not found or you are not authorized to access it.")

    # 2. Filter records: exclude FLAGGED audit records
    def is_usable(record) -> bool:
        return record.status != VerificationStatus.FLAGGED

    electricity_kwh = sum(r.consumed_kwh for r in period.electricity_records if is_usable(r))

    fuel_litres: Dict[str, float] = defaultdict(float)
    for r in period.fuel_records:
        if is_usable(r):
            fuel_litres[r.fuel_type.value] += r.quantity_liters

    materials_tonnes: Dict[str, float] = defaultdict(float)
    for r in period.material_records:
        if is_usable(r):
            materials_tonnes[r.material_type.value] += r.quantity_tonnes

    # 3. Determine emission factors (priority: custom -> synced EvidenceItem -> CEA defaults)
    factors = custom_factors
    if factors is None:
        from app.domains.evidence.models import EvidenceItem

        ev_stmt = select(EvidenceItem).where(EvidenceItem.category == "grid_emission_factor")
        ev_res = await db.execute(ev_stmt)
        ev_item = ev_res.scalar_one_or_none()

        # Convert tCO2/MWh to tCO2e/kWh (1 MWh = 1000 kWh)
        grid_factor = (
            (ev_item.value / 1000.0)
            if (ev_item and ev_item.value > 0 and "mwh" in ev_item.unit.lower())
            else (ev_item.value if (ev_item and ev_item.value > 0 and "kwh" in ev_item.unit.lower()) else DEFAULT_EMISSION_FACTORS.electricity_tco2e_per_kwh)
        )

        factors = EmissionFactors(
            electricity_tco2e_per_kwh=grid_factor,
            fuel_tco2e_per_litre=DEFAULT_EMISSION_FACTORS.fuel_tco2e_per_litre,
            material_tco2e_per_tonne=DEFAULT_EMISSION_FACTORS.material_tco2e_per_tonne,
        )

    # 3. Deterministic calculation
    try:
        emission_result: EmissionResult = calculate_emissions(
            electricity_kwh=electricity_kwh,
            fuel_litres=fuel_litres,
            materials_tonnes=materials_tonnes,
            production_tonnes=period.production_tonnes,
            factors=factors,
        )
    except ValueError as exc:
        logger.warning("Calculation validation error for period_id=%s: %s", period_id, exc)
        raise CalculationValidationError(str(exc)) from exc

    # 4. Generate Renewable Decarbonization Pathways
    firm = period.firm
    factory_params = FactoryParameters(
        roof_area_sqm=firm.roof_area_sqm if firm else None,
        contracted_demand_mva=firm.contracted_demand_mva if firm else None,
        state=firm.state if firm else "National Grid",
        current_tariff=firm.tariff_category if firm else None,
    )

    pathways = generate_decarbonization_pathways(
        factory=factory_params,
        scope2_tco2e=emission_result.scope2_tco2e,
        electricity_kwh=electricity_kwh,
        grid_emission_factor=factors.electricity_tco2e_per_kwh,
    )

    # 5. Build immutable computation snapshot
    firm_dict = {
        "id": str(firm.id) if firm else "",
        "name": firm.name if firm else "",
        "registration_identifier": firm.registration_identifier if firm else None,
        "segment": firm.segment if firm else "induction_furnace",
        "state": firm.state if firm else "",
        "contracted_demand_mva": firm.contracted_demand_mva if firm else None,
        "roof_area_sqm": firm.roof_area_sqm if firm else None,
        "tariff_category": firm.tariff_category if firm else None,
    }

    snapshot = build_computation_snapshot(
        period_id=period.id,
        period_start=str(period.start_date),
        period_end=str(period.end_date),
        firm_data=firm_dict,
        electricity_kwh=electricity_kwh,
        fuel_litres=fuel_litres,
        materials_tonnes=materials_tonnes,
        production_tonnes=period.production_tonnes,
        factors=factors,
        emission_results=emission_result,
        pathways=pathways,
    )

    # 6. Atomic database update
    period.total_scope1_tco2e = emission_result.scope1_tco2e
    period.total_scope2_tco2e = emission_result.scope2_tco2e
    period.total_precursor_tco2e = emission_result.precursor_tco2e
    period.total_emissions_tco2e = emission_result.total_tco2e
    period.specific_emissions_tco2e_per_tonne = emission_result.tco2e_per_tonne
    period.is_calculation_stale = False

    try:
        await db.flush()
        await db.commit()
        await db.refresh(period)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to commit calculated footprint for period %s: %s", period_id, exc, exc_info=True)
        raise

    logger.info(
        "Emissions calculated and committed: period_id=%s total_tco2e=%.2f pathways_count=%d",
        period.id,
        emission_result.total_tco2e,
        len(pathways),
    )

    return period, pathways, snapshot
