"""End-to-end check of POST /api/reports/calculate/{period_id}.

Uses in-memory SQLite and replaces the DB / auth dependencies, so no Postgres
is needed. Extra test dependencies: pytest, pytest-asyncio, aiosqlite, httpx.
"""

from datetime import date

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.dependencies import get_current_user, get_db
from app.domains.activity.models import (
    ElectricityRecord,
    FuelRecord,
    FuelType,
    MaterialRecord,
    MaterialType,
    VerificationStatus,
)
from app.domains.engine import router as engine_router
from app.domains.engine.engine import EmissionFactors
from app.domains.firm.models import Firm
from app.domains.reporting.models import ReportingPeriod
from app.main import app

# Same fixed factors / expected numbers as tests/test_engine.py::test_known_case
FACTORS = EmissionFactors(
    electricity_tco2e_per_kwh=0.0008,
    fuel_tco2e_per_litre={"diesel": 0.0027, "furnace_oil": 0.003, "lpg": 0.0015},
    material_tco2e_per_tonne={"steel_scrap": 0.2, "sponge_iron_dri_coal": 2.5},
)


@pytest_asyncio.fixture
async def session_factory(monkeypatch):
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with factory() as session:
            yield session

    async def override_user():
        return None

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_user
    monkeypatch.setattr(engine_router, "DEFAULT_EMISSION_FACTORS", FACTORS)

    yield factory

    app.dependency_overrides.clear()
    await engine.dispose()


async def _seed(factory):
    async with factory() as s:
        s.add(Firm(id=1, name="Test Steel", state="Haryana"))
        s.add(
            ReportingPeriod(
                id=1,
                firm_id=1,
                start_date=date(2026, 4, 1),
                end_date=date(2026, 6, 30),
                production_tonnes=100,
            )
        )
        await s.flush()
        s.add(ElectricityRecord(reporting_period_id=1, consumed_kwh=100_000))
        s.add(FuelRecord(reporting_period_id=1, fuel_type=FuelType.DIESEL, quantity_liters=1_000))
        s.add(FuelRecord(reporting_period_id=1, fuel_type=FuelType.FURNACE_OIL, quantity_liters=2_000))
        s.add(
            MaterialRecord(
                reporting_period_id=1, material_type=MaterialType.STEEL_SCRAP, quantity_tonnes=50
            )
        )
        s.add(
            MaterialRecord(
                reporting_period_id=1,
                material_type=MaterialType.SPONGE_IRON_DRI_COAL,
                quantity_tonnes=30,
            )
        )
        # A flagged record must be ignored by the calculation.
        s.add(
            FuelRecord(
                reporting_period_id=1,
                fuel_type=FuelType.DIESEL,
                quantity_liters=99_999,
                status=VerificationStatus.FLAGGED,
            )
        )
        await s.commit()


@pytest.mark.asyncio
async def test_calculate_endpoint_known_case(session_factory):
    await _seed(session_factory)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/reports/calculate/1", headers={"Authorization": "Bearer x"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["period_id"] == 1
    assert body["total_scope1_tco2e"] == pytest.approx(8.7)
    assert body["total_scope2_tco2e"] == pytest.approx(80.0)
    assert body["total_precursor_tco2e"] == pytest.approx(85.0)
    assert body["total_emissions_tco2e"] == pytest.approx(173.7)
    assert body["specific_emissions_tco2e_per_tonne"] == pytest.approx(1.737)

    # Results are persisted on the reporting period.
    async with session_factory() as s:
        period = (await s.execute(select(ReportingPeriod).where(ReportingPeriod.id == 1))).scalar_one()
        assert period.total_emissions_tco2e == pytest.approx(173.7)
        assert period.is_calculation_stale is False


@pytest.mark.asyncio
async def test_calculate_endpoint_unknown_period_404(session_factory):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/reports/calculate/999", headers={"Authorization": "Bearer x"})
    assert resp.status_code == 404
