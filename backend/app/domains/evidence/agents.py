"""
TinyFish web agent integration module.
Dispatches autonomous search/browser missions to locate and parse Indian regulatory
and market benchmarks (CEA Power Sector CO2 Baseline, Green Open Access, IEX RECs).
Guarantees resilient fallback to vetted Indian FY 2023-24 baselines on failure or timeout.
"""

import json
import logging
from typing import Any, Dict

import httpx

from app.core.config import get_settings
from app.domains.evidence.prompts import (
    CEA_GRID_FACTOR_PROMPT,
    IEX_REC_PRICE_PROMPT,
    OPEN_ACCESS_RULES_PROMPT,
)

logger = logging.getLogger(__name__)

# Exact mandated fallback values representing official CEA FY 2023-24 baseline
FALLBACK_CEA_GRID_FACTOR: Dict[str, Any] = {
    "category": "grid_emission_factor",
    "identifier": "IN_NATIONAL_GRID_2023_24",
    "value": 0.727,
    "unit": "tCO2/MWh",
    "source_title": "CEA CO2 Baseline Database (Version 20.0)",
    "source_url": "mocked_local_fallback",
    "metadata_payload": {
        "fallback_used": True,
        "fiscal_year": "2023-24",
        "authority": "Central Electricity Authority (CEA), Ministry of Power, Govt of India",
        "description": "Weighted average emission factor for Indian National Grid (including RES).",
        "reference_standard": "CEA CO2 Baseline Database Version 20.0",
    },
}


async def fetch_cea_grid_factor() -> Dict[str, Any]:
    """
    Query the TinyFish agent API to discover and parse the latest CEA CO2 Baseline Database
    emission factor for the Indian national grid.

    Critical Fallback Requirement:
    If the TinyFish API is unconfigured, times out, throws HTTP errors, or returns
    malformed/junk data, this function catches the exception and returns the official
    vetted Indian FY 2023-24 baseline (0.727 tCO2/MWh).
    """
    settings = get_settings()
    api_key = settings.TINYFISH_API_KEY
    agent_url = settings.TINYFISH_AGENT_URL or settings.TINYFISH_API_URL

    if not api_key:
        logger.info(
            "TINYFISH_API_KEY is not set in environment. Returning vetted CEA FY 2023-24 fallback."
        )
        return FALLBACK_CEA_GRID_FACTOR.copy()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-API-Key": api_key,
        "Content-Type": "application/json",
        "User-Agent": "QuadCore-Decarbonization-Platform/1.0",
    }
    payload = {
        "prompt": CEA_GRID_FACTOR_PROMPT,
        "task": CEA_GRID_FACTOR_PROMPT,
        "stream": False,
        "timeout": 30,
    }

    try:
        logger.info("Dispatching TinyFish agent query to %s...", agent_url)
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(agent_url, json=payload, headers=headers)

            if response.status_code != 200:
                logger.warning(
                    "TinyFish Agent API returned status %d. Body: %s. Using fallback.",
                    response.status_code,
                    response.text[:200],
                )
                return FALLBACK_CEA_GRID_FACTOR.copy()

            data = response.json()
            logger.info("TinyFish response received successfully.")

            # TinyFish may return output in a 'result', 'response', or direct JSON object
            extracted = data.get("result") or data.get("output") or data.get("response") or data

            if isinstance(extracted, str):
                # Try parsing if returned as stringified JSON
                try:
                    extracted = json.loads(extracted)
                except Exception:
                    pass

            # Extract and validate numeric value
            raw_val = None
            if isinstance(extracted, dict):
                raw_val = extracted.get("value") or extracted.get("emission_factor")
            elif isinstance(extracted, (int, float)):
                raw_val = extracted

            if raw_val is None:
                logger.warning("TinyFish response lacked numeric emission factor. Using fallback.")
                return FALLBACK_CEA_GRID_FACTOR.copy()

            parsed_val = float(raw_val)

            # Plausibility check for Indian grid factor (CEA historical range: 0.65 – 0.85 tCO2/MWh)
            if not (0.5 <= parsed_val <= 1.2):
                logger.warning(
                    "Parsed emission factor %.4f falls outside physical Indian grid range (0.5 - 1.2). Using fallback.",
                    parsed_val,
                )
                return FALLBACK_CEA_GRID_FACTOR.copy()

            source_title = (
                extracted.get("source_title")
                if isinstance(extracted, dict) and extracted.get("source_title")
                else "CEA CO2 Baseline Database (Live Agent Extract)"
            )
            source_url = (
                extracted.get("source_url")
                if isinstance(extracted, dict) and extracted.get("source_url")
                else "https://cea.nic.in"
            )

            return {
                "category": "grid_emission_factor",
                "identifier": "IN_NATIONAL_GRID_2023_24",
                "value": parsed_val,
                "unit": "tCO2/MWh",
                "source_title": source_title,
                "source_url": source_url,
                "metadata_payload": {
                    "fallback_used": False,
                    "raw_agent_response": data,
                    "authority": "Central Electricity Authority (CEA), Govt of India",
                },
            }

    except Exception as exc:
        logger.warning(
            "Exception occurred during TinyFish agent query: %s. Using vetted fallback (0.727 tCO2/MWh).",
            exc,
            exc_info=True,
        )
        return FALLBACK_CEA_GRID_FACTOR.copy()
