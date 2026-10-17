import pytest

from app.domains.engine.engine import (
    DEFAULT_EMISSION_FACTORS,
    EmissionFactors,
    calculate_emissions,
)

# Fixed factors for the known test case (independent of the placeholder defaults).
FACTORS = EmissionFactors(
    electricity_tco2e_per_kwh=0.0008,  # tCO2e per kWh
    fuel_tco2e_per_litre={"diesel": 0.0027, "furnace_oil": 0.003},  # tCO2e per litre
    material_tco2e_per_tonne={"steel_scrap": 0.2, "sponge_iron_dri_coal": 2.5},  # tCO2e per tonne
)


def test_known_case():
    """Hand-calculated expectation.

    Scope 2   = 100,000 kWh * 0.0008                      = 80.0
    Scope 1   = 1,000 L * 0.0027 + 2,000 L * 0.003        = 2.7 + 6.0 = 8.7
    Precursor = 50 t * 0.2 + 30 t * 2.5                   = 10.0 + 75.0 = 85.0
    Total     = 80.0 + 8.7 + 85.0                         = 173.7
    Per tonne = 173.7 / 100 t                             = 1.737
    """
    result = calculate_emissions(
        electricity_kwh=100_000,
        fuel_litres={"diesel": 1_000, "furnace_oil": 2_000},
        materials_tonnes={"steel_scrap": 50, "sponge_iron_dri_coal": 30},
        production_tonnes=100,
        factors=FACTORS,
    )

    assert result.scope1_tco2e == pytest.approx(8.7)
    assert result.scope2_tco2e == pytest.approx(80.0)
    assert result.precursor_tco2e == pytest.approx(85.0)
    assert result.total_tco2e == pytest.approx(173.7)
    assert result.tco2e_per_tonne == pytest.approx(1.737)


def test_total_is_sum_of_parts():
    result = calculate_emissions(
        electricity_kwh=12_345,
        fuel_litres={"diesel": 321},
        materials_tonnes={"steel_scrap": 7},
        production_tonnes=9,
        factors=FACTORS,
    )
    assert result.total_tco2e == pytest.approx(
        result.scope1_tco2e + result.scope2_tco2e + result.precursor_tco2e
    )


def test_empty_activity_gives_zero():
    result = calculate_emissions(0, {}, {}, 10, FACTORS)
    assert result.total_tco2e == 0
    assert result.tco2e_per_tonne == 0


def test_no_production_gives_none_per_tonne():
    result = calculate_emissions(1_000, {}, {}, None, FACTORS)
    assert result.scope2_tco2e == pytest.approx(0.8)
    assert result.tco2e_per_tonne is None


@pytest.mark.parametrize("production", [0, -5])
def test_non_positive_production_rejected(production):
    with pytest.raises(ValueError):
        calculate_emissions(1_000, {}, {}, production, FACTORS)


def test_negative_quantity_rejected():
    with pytest.raises(ValueError):
        calculate_emissions(-1, {}, {}, 10, FACTORS)
    with pytest.raises(ValueError):
        calculate_emissions(0, {"diesel": -1}, {}, 10, FACTORS)


def test_missing_factor_rejected():
    with pytest.raises(ValueError, match="lpg"):
        calculate_emissions(0, {"lpg": 100}, {}, 10, FACTORS)
    with pytest.raises(ValueError, match="ferro_silicon"):
        calculate_emissions(0, {}, {"ferro_silicon": 1}, 10, FACTORS)


def test_default_factors_cover_all_model_enums():
    """Every FuelType / MaterialType in the DB model must have a default factor."""
    from app.domains.activity.models import FuelType, MaterialType

    assert {f.value for f in FuelType} <= set(DEFAULT_EMISSION_FACTORS.fuel_tco2e_per_litre)
    assert {m.value for m in MaterialType} <= set(DEFAULT_EMISSION_FACTORS.material_tco2e_per_tonne)
