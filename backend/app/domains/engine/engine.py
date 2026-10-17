"""Deterministic emissions calculation engine.

Pure functions only: no database, no network. Callers (e.g. the
``POST /api/reports/calculate/{period_id}`` endpoint) collect the activity
data and emission factors and pass them in.

Input units
-----------
* Electricity ........ kWh
* Fuel ............... litres, keyed by fuel type (``FuelType.value``)
* Purchased materials  tonnes, keyed by material type (``MaterialType.value``)
* Production ......... tonnes

Emission factors are expressed per *activity unit*:
* electricity: tCO2e per kWh
* fuel:        tCO2e per litre
* materials:   tCO2e per tonne

All outputs are in tCO2e.

Scope mapping
-------------
* Scope 1   = direct fuel combustion
* Scope 2   = purchased electricity
* Precursor = purchased materials (upstream / embedded emissions)
"""

from dataclasses import dataclass
from math import isfinite
from typing import Mapping, Optional


@dataclass(frozen=True)
class EmissionFactors:
    electricity_tco2e_per_kwh: float
    fuel_tco2e_per_litre: Mapping[str, float]
    material_tco2e_per_tonne: Mapping[str, float]


@dataclass(frozen=True)
class EmissionResult:
    scope1_tco2e: float
    scope2_tco2e: float
    precursor_tco2e: float
    total_tco2e: float
    # None when no production quantity is supplied for the period.
    tco2e_per_tonne: Optional[float]


# ------------------------------------------------------------------------------
# PLACEHOLDER factors - NOT verified values.
# Used only until the evidence pipeline (evidence_items table) supplies
# sourced factors. Replace/confirm every number below against the authoritative
# source (e.g. CEA grid factor, IPCC/DEFRA fuel factors, supplier data) before
# any figure is reported externally.
# ------------------------------------------------------------------------------
DEFAULT_EMISSION_FACTORS = EmissionFactors(
    electricity_tco2e_per_kwh=0.000727,
    fuel_tco2e_per_litre={
        "diesel": 0.00268,
        "furnace_oil": 0.00315,
        "lpg": 0.00151,
    },
    material_tco2e_per_tonne={
        "steel_scrap": 0.15,
        "sponge_iron_dri_coal": 2.6,
        "sponge_iron_dri_gas": 1.6,
        "ferro_manganese": 1.9,
        "ferro_silicon": 4.0,
        "carbon_additive": 3.0,
    },
)


def _check_quantity(name: str, value: float) -> float:
    if not isfinite(value) or value < 0:
        raise ValueError(f"{name} must be a finite number >= 0, got {value!r}")
    return value


def _sum_with_factors(
    quantities: Mapping[str, float],
    factors: Mapping[str, float],
    label: str,
) -> float:
    total = 0.0
    for key, quantity in quantities.items():
        _check_quantity(f"{label} quantity for '{key}'", quantity)
        if key not in factors:
            raise ValueError(f"No emission factor provided for {label} '{key}'")
        factor = factors[key]
        if not isfinite(factor) or factor < 0:
            raise ValueError(
                f"Emission factor for {label} '{key}' must be a finite number >= 0, got {factor!r}"
            )
        total += quantity * factor
    return total


def calculate_emissions(
    electricity_kwh: float,
    fuel_litres: Mapping[str, float],
    materials_tonnes: Mapping[str, float],
    production_tonnes: Optional[float],
    factors: EmissionFactors,
) -> EmissionResult:
    """Calculate Scope 1, Scope 2, precursor, total and per-tonne emissions (tCO2e).

    Raises ValueError for negative / non-finite quantities, for a fuel or
    material that has no emission factor, and for production_tonnes <= 0.
    ``production_tonnes=None`` is allowed and gives ``tco2e_per_tonne=None``.
    """
    _check_quantity("electricity_kwh", electricity_kwh)
    electricity_factor = factors.electricity_tco2e_per_kwh
    if not isfinite(electricity_factor) or electricity_factor < 0:
        raise ValueError(
            f"Electricity emission factor must be a finite number >= 0, got {electricity_factor!r}"
        )

    scope2 = electricity_kwh * electricity_factor
    scope1 = _sum_with_factors(fuel_litres, factors.fuel_tco2e_per_litre, "fuel")
    precursor = _sum_with_factors(
        materials_tonnes, factors.material_tco2e_per_tonne, "material"
    )
    total = scope1 + scope2 + precursor

    per_tonne: Optional[float] = None
    if production_tonnes is not None:
        if not isfinite(production_tonnes) or production_tonnes <= 0:
            raise ValueError(
                f"production_tonnes must be a finite number > 0, got {production_tonnes!r}"
            )
        per_tonne = total / production_tonnes

    return EmissionResult(
        scope1_tco2e=scope1,
        scope2_tco2e=scope2,
        precursor_tco2e=precursor,
        total_tco2e=total,
        tco2e_per_tonne=per_tonne,
    )
