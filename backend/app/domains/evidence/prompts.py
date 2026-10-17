"""
Prompts and search mission specifications for TinyFish web agent integration.
Strictly focused on authoritative Indian regulatory publications and market databases:
- Central Electricity Authority (CEA), Ministry of Power (CO2 Baseline Database)
- Ministry of Power Green Energy Open Access Rules (100 kW threshold)
- Indian Energy Exchange (IEX) Renewable Energy Certificate (REC) clearing rates
"""

CEA_GRID_FACTOR_PROMPT = """
You are an environmental regulatory auditor specialized in the Indian power and steel sector.
Your mission is to find the latest official grid emission factor published by the Central Electricity Authority (CEA), Ministry of Power, Government of India.

Instructions:
1. Locate the latest published version of the "CO2 Baseline Database for the Indian Power Sector" (specifically Version 20.0 or FY 2023-24).
2. Extract the "Weighted Average Emission factor" (also referred to as the combined/operating margin including renewable energy sources, RES).
3. The standard Indian national grid value is typically around 0.71 to 0.75 tCO2/MWh (or kgCO2/kWh).
4. Extract and verify:
   - "value": The numeric emission factor as a float (e.g., 0.727).
   - "unit": "tCO2/MWh"
   - "source_title": Full official document title (e.g., "CO2 Baseline Database for the Indian Power Sector (Version 20.0)").
   - "source_url": Authoritative URL from cea.nic.in or national regulatory repository.
   - "publication_year": "2023-24"

Output format:
Return a valid JSON object only with keys:
{
  "value": 0.727,
  "unit": "tCO2/MWh",
  "source_title": "CEA CO2 Baseline Database (Version 20.0)",
  "source_url": "https://cea.nic.in/wp-content/uploads/baseline/2023/12/user_guide_ver20.pdf",
  "published_year": "2023-24",
  "authority": "Central Electricity Authority (CEA), Ministry of Power, Govt of India"
}
"""

OPEN_ACCESS_RULES_PROMPT = """
You are an Indian power sector regulatory analyst.
Locate the "Electricity (Promoting Renewable Energy Through Green Energy Open Access) Rules, 2022" notified by the Ministry of Power, Government of India.
Extract the national contracted demand threshold (in kW or MVA) required for an industrial manufacturing entity to qualify for Green Open Access power procurement.
Verify the threshold reduction from 1 MW to 100 kW (0.1 MVA).
Return a JSON object with:
{
  "value": 0.1,
  "unit": "MVA",
  "threshold_kw": 100.0,
  "source_title": "Green Energy Open Access Rules, 2022",
  "source_url": "https://powermin.gov.in"
}
"""

IEX_REC_PRICE_PROMPT = """
You are an energy market analyst in India.
Locate the latest Renewable Energy Certificate (REC) trading session results on the Indian Energy Exchange (IEX).
Extract the market clearing price (MCP) per REC certificate (in INR / ₹).
Return a JSON object with:
{
  "value": 360.0,
  "unit": "INR/REC",
  "source_title": "IEX Green Market REC Trading Session",
  "source_url": "https://www.iexindia.com"
}
"""
