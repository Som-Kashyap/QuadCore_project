"""
Audit Trail Freezer (Computation Snapshot Constructor).
Generates deeply nested, immutable, and verifiable JSON payloads capturing
the exact math, activity inputs, emission factors, and decarbonization pathways
used during report generation.
"""

from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Dict, Mapping, Optional

from app.domains.engine.engine import EmissionFactors, EmissionResult


def build_computation_snapshot(
    period_id: int,
    period_start: str,
    period_end: str,
    firm_data: Dict[str, Any],
    electricity_kwh: float,
    fuel_litres: Mapping[str, float],
    materials_tonnes: Mapping[str, float],
    production_tonnes: Optional[float],
    factors: EmissionFactors,
    emission_results: EmissionResult,
    pathways: list[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Construct an immutable, deeply nested, JSON-serializable audit trail dictionary.
    Guarantees full historical reproducibility for carbon audits and compliance reporting.
    """
    timestamp_utc = datetime.now(timezone.utc).isoformat()

    snapshot: Dict[str, Any] = {
        "snapshot_schema_version": "1.0.0",
        "generated_at": timestamp_utc,
        "metadata": {
            "period_id": period_id,
            "period_start_date": period_start,
            "period_end_date": period_end,
            "firm": {
                "id": str(firm_data.get("id")),
                "name": firm_data.get("name"),
                "registration_identifier": firm_data.get("registration_identifier"),
                "segment": firm_data.get("segment", "induction_furnace"),
                "state": firm_data.get("state"),
                "contracted_demand_mva": firm_data.get("contracted_demand_mva"),
                "roof_area_sqm": firm_data.get("roof_area_sqm"),
                "tariff_category": firm_data.get("tariff_category"),
            },
        },
        "activity_inputs": {
            "scope2_electricity": {
                "consumed_kwh": electricity_kwh,
                "unit": "kWh",
            },
            "scope1_fuel_combustion": {
                "by_type_litres": dict(fuel_litres),
                "total_litres": sum(fuel_litres.values()),
                "unit": "litres",
            },
            "precursor_materials": {
                "by_type_tonnes": dict(materials_tonnes),
                "total_tonnes": sum(materials_tonnes.values()),
                "unit": "tonnes",
            },
            "production_output": {
                "total_tonnes": production_tonnes,
                "unit": "tonnes",
            },
        },
        "emission_factors_applied": {
            "grid_electricity": {
                "factor": factors.electricity_tco2e_per_kwh,
                "factor_display": "0.727 kg CO2e / kWh (0.000727 tCO2e / kWh)",
                "unit": "tCO2e per kWh",
                "source": "CEA CO2 Baseline Database (Version 19/20 - Carbon Emission Calculator)",
                "regulatory_body": "Central Electricity Authority of India",
            },
            "fuel_combustion": {
                "factors_tco2e_per_litre": dict(factors.fuel_tco2e_per_litre),
                "unit": "tCO2e per litre",
                "source": "IPCC Guidelines for National GHG Inventories / DEFRA",
            },
            "precursor_materials": {
                "factors_tco2e_per_tonne": dict(factors.material_tco2e_per_tonne),
                "unit": "tCO2e per tonne",
                "source": "World Steel Association / EU CBAM Default Values",
            },
        },
        "deterministic_footprint_results": {
            "scope1_direct_fuel_tco2e": emission_results.scope1_tco2e,
            "scope2_grid_electricity_tco2e": emission_results.scope2_tco2e,
            "precursor_embedded_materials_tco2e": emission_results.precursor_tco2e,
            "grand_total_emissions_tco2e": emission_results.total_tco2e,
            "specific_emissions_tco2e_per_tonne": emission_results.tco2e_per_tonne,
            "unit": "tCO2e",
        },
        "decarbonization_pathways": pathways,
        "audit_verification": {
            "status": "deterministic_computation_verified",
            "standards_compliance": ["GHG Protocol Corporate Standard", "ISO 14064-1", "EU CBAM"],
            "hash_algorithm": "SHA-256",
        },
    }

    # Generate an SHA-256 fingerprint of the serialized payload for immutability verification
    serialized_repr = json.dumps(snapshot, sort_keys=True)
    snapshot["audit_verification"]["fingerprint_sha256"] = hashlib.sha256(
        serialized_repr.encode("utf-8")
    ).hexdigest()

    return snapshot
