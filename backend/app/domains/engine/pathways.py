"""
Renewable Pathways Generator (Decarbonization Recommendation Engine).
Generates rule-based, factory-specific renewable energy and efficiency recommendations
based on physical site parameters and calculated Scope 2 footprint.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class FactoryParameters:
    roof_area_sqm: Optional[float] = None
    contracted_demand_mva: Optional[float] = None
    state: str = "National Grid"
    current_tariff: Optional[str] = None


def generate_decarbonization_pathways(
    factory: FactoryParameters,
    scope2_tco2e: float,
    electricity_kwh: float,
    grid_emission_factor: float = 0.000727,
) -> List[Dict[str, Any]]:
    """
    Generate firm-specific renewable energy pathways based on factory baseline inputs
    and deterministic emissions calculation results.

    Returns a list of structured recommendation dictionaries including headline,
    tCO2e reduction impact, financial estimates, and calculation assumptions.
    """
    recommendations: List[Dict[str, Any]] = []

    # -------------------------------------------------------------------------
    # Rule 1: On-Site Rooftop Solar PV
    # -------------------------------------------------------------------------
    if factory.roof_area_sqm and factory.roof_area_sqm > 0:
        # Standard industrial rule of thumb: 10 sqm = 1 kWp capacity
        solar_capacity_kw = round(factory.roof_area_sqm / 10.0, 2)
        
        # Standard Indian solar irradiation yield: ~1450 kWh per kWp per year
        annual_solar_generation_kwh = round(solar_capacity_kw * 1450.0, 2)
        
        # Avoided Scope 2 emissions per year
        solar_annual_tco2e_reduction = round(
            annual_solar_generation_kwh * grid_emission_factor, 2
        )

        # Percentage of current Scope 2 offset
        offset_pct = (
            round(min(100.0, (solar_annual_tco2e_reduction / scope2_tco2e) * 100.0), 2)
            if scope2_tco2e > 0
            else 0.0
        )

        # Financial estimate: typical industrial EPC capex ₹48,000/kWp, tariff ₹7.5/kWh
        estimated_capex_inr = round(solar_capacity_kw * 48000.0, 2)
        annual_bill_savings_inr = round(annual_solar_generation_kwh * 7.50, 2)
        payback_years = (
            round(estimated_capex_inr / annual_bill_savings_inr, 2)
            if annual_bill_savings_inr > 0
            else 4.5
        )

        recommendations.append({
            "id": "pathway_rooftop_solar",
            "category": "on_site_solar",
            "headline": f"Deploy {solar_capacity_kw:,.1f} kWp On-Site Rooftop Solar PV",
            "description": (
                f"Utilize {factory.roof_area_sqm:,.0f} sqm of factory rooftop to generate "
                f"~{annual_solar_generation_kwh:,.0f} kWh/year of zero-emission captive power, "
                f"offsetting {offset_pct:.1f}% of your Scope 2 electricity footprint."
            ),
            "tco2e_reduction_annual": solar_annual_tco2e_reduction,
            "percentage_scope2_offset": offset_pct,
            "financial_estimates": {
                "estimated_capex_inr": estimated_capex_inr,
                "annual_bill_savings_inr": annual_bill_savings_inr,
                "simple_payback_years": payback_years,
            },
            "assumptions": {
                "rooftop_area_per_kw_sqm": 10.0,
                "solar_yield_kwh_per_kw_year": 1450.0,
                "grid_emission_factor_tco2e_per_kwh": grid_emission_factor,
                "estimated_blended_tariff_inr_per_kwh": 7.50,
                "installed_capex_inr_per_kwp": 48000.0,
            },
        })

    # -------------------------------------------------------------------------
    # Rule 2: Green Energy Open Access (GEOA) Off-Site PPA
    # -------------------------------------------------------------------------
    # Statutory threshold under Indian Green Energy Open Access Rules 2022: >= 100 kW (0.1 MVA)
    if factory.contracted_demand_mva and factory.contracted_demand_mva >= 0.1:
        # Typical open access procurement can replace 50% to 70% of energy requirements
        geoa_replacement_ratio = 0.60
        geoa_procurement_kwh = round(electricity_kwh * geoa_replacement_ratio, 2)
        geoa_tco2e_reduction = round(scope2_tco2e * geoa_replacement_ratio, 2)
        geoa_offset_pct = 60.0

        # Financial estimate: Landed green PPA cost ~₹5.0/kWh vs commercial DISCOM tariff ~₹8.0/kWh
        # Net savings: ~₹3.0/kWh
        estimated_annual_opex_savings_inr = round(geoa_procurement_kwh * 3.00, 2)

        recommendations.append({
            "id": "pathway_green_open_access",
            "category": "green_open_access",
            "headline": "Procure Off-Site Renewable Power via Green Energy Open Access (PPA)",
            "description": (
                f"With a contracted demand of {factory.contracted_demand_mva} MVA, your plant exceeds "
                f"the 100 kW (0.1 MVA) national Green Open Access threshold. Enter into an off-site "
                f"Solar/Wind Hybrid PPA to replace ~60% of baseline utility power."
            ),
            "tco2e_reduction_annual": geoa_tco2e_reduction,
            "percentage_scope2_offset": geoa_offset_pct,
            "financial_estimates": {
                "estimated_capex_inr": 0.0,  # Third-party RESCO PPA requires zero upfront Capex
                "annual_opex_savings_inr": estimated_annual_opex_savings_inr,
                "landed_green_tariff_inr_per_kwh": 5.00,
                "average_grid_tariff_inr_per_kwh": 8.00,
            },
            "assumptions": {
                "geoa_eligibility_threshold_mva": 0.1,
                "green_power_replacement_share": geoa_replacement_ratio,
                "grid_emission_factor_tco2e_per_kwh": grid_emission_factor,
                "regulatory_framework": "Ministry of Power Green Open Access Rules 2022",
            },
        })

    # -------------------------------------------------------------------------
    # Rule 3: IEX Renewable Energy Certificates (RECs)
    # -------------------------------------------------------------------------
    if scope2_tco2e > 0 and electricity_kwh > 0:
        # 1 REC = 1 MWh = 1,000 kWh of renewable electricity attribute
        recs_required = round(electricity_kwh / 1000.0, 2)
        
        # Current Indian Energy Exchange (IEX) market clearing rate: ~₹360 per certificate
        rec_unit_price_inr = 360.0
        total_rec_procurement_cost_inr = round(recs_required * rec_unit_price_inr, 2)
        
        recommendations.append({
            "id": "pathway_renewable_energy_certificates",
            "category": "rec_market",
            "headline": "Neutralize Residual Scope 2 Emissions via IEX Renewable Energy Certificates (RECs)",
            "description": (
                f"Surrender {recs_required:,.0f} Renewable Energy Certificates (RECs) traded on the "
                f"Indian Energy Exchange (IEX) to legally zero out your remaining {scope2_tco2e:,.2f} tCO2e "
                f"Scope 2 emissions on paper under market-based GHG accounting."
            ),
            "tco2e_reduction_annual": round(scope2_tco2e, 2),
            "percentage_scope2_offset": 100.0,
            "financial_estimates": {
                "estimated_total_cost_inr": total_rec_procurement_cost_inr,
                "cost_per_mwh_inr": rec_unit_price_inr,
                "effective_cost_per_tco2e_inr": round(
                    total_rec_procurement_cost_inr / scope2_tco2e, 2
                ) if scope2_tco2e > 0 else 0.0,
            },
            "assumptions": {
                "rec_denomination": "1 REC = 1 MWh (1,000 kWh)",
                "iex_market_clearing_price_inr": rec_unit_price_inr,
                "standard": "GHG Protocol Scope 2 Market-Based Reporting Criteria",
            },
        })

    return recommendations
