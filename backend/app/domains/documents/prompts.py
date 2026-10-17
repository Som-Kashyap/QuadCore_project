"""
System prompts and JSON schemas for LLM vision/text document extraction.
Provides structured prompt templates per DocumentCategory.
"""

from typing import Dict
from app.domains.documents.schemas import DocumentCategory

BASE_SYSTEM_PROMPT = """You are an expert industrial carbon accounting and audit AI specializing in decarbonization data extraction for factories and mills.
Your job is to accurately extract key numerical operational and financial fields from parsed industrial documents (invoices, bills, registers, production logs).

CRITICAL INSTRUCTIONS:
1. Return ONLY valid, well-formed JSON matching the specified schema. Do NOT include markdown code blocks (e.g. do not wrap in ```json), commentary, or extra text.
2. If a field cannot be determined or is not present, use null.
3. Convert all quantities to numbers (floats or integers). Do not include commas in numbers (e.g. use 12500.5, not '12,500.5').
4. Standardize dates to ISO format (YYYY-MM-DD) whenever possible.
5. Provide a confidence_score between 0.0 and 1.0 representing your certainty in the extraction.
"""

CATEGORY_PROMPTS: Dict[DocumentCategory, str] = {
    DocumentCategory.ELECTRICITY_BILL: """Extract electricity utility consumption details from this bill.
Target JSON Schema:
{
  "billing_period_start": "YYYY-MM-DD or null",
  "billing_period_end": "YYYY-MM-DD or null",
  "kwh_consumed": "float (total active energy consumption in kWh / units) or null",
  "contracted_demand_mva": "float (contracted/sanctioned demand in MVA or kVA) or null",
  "tariff_category": "string (e.g. HT-2, Industrial High Tension) or null",
  "utility_provider": "string (DISCOM / utility company name) or null",
  "total_amount_inr": "float (total bill payable in INR) or null",
  "consumer_number": "string or null",
  "confidence_score": "float (0.0 to 1.0)",
  "extraction_notes": "string"
}""",

    DocumentCategory.FUEL_INVOICE: """Extract fuel purchase and delivery details from this fuel invoice.
Target JSON Schema:
{
  "fuel_type": "string (e.g. thermal coal, diesel, furnace oil, natural gas, coking coal) or null",
  "quantity": "float (quantity purchased/delivered) or null",
  "unit": "string (e.g. tonnes, MT, liters, scm) or null",
  "invoice_date": "YYYY-MM-DD or null",
  "invoice_number": "string or null",
  "supplier_name": "string (vendor / supplier company) or null",
  "total_amount_inr": "float (total invoice amount in INR) or null",
  "calorific_value_gcv": "float (calorific value if specified) or null",
  "confidence_score": "float (0.0 to 1.0)",
  "extraction_notes": "string"
}""",

    DocumentCategory.PURCHASE_REGISTER: """Extract raw material / precursor purchase register records from this document.
Target JSON Schema:
{
  "vendor_name": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "invoice_number": "string or null",
  "items": [
    {
      "description": "string",
      "quantity": "float or null",
      "unit": "string or null",
      "amount_inr": "float or null"
    }
  ],
  "total_weight_tonnes": "float (total weight of raw materials in tonnes) or null",
  "total_amount_inr": "float or null",
  "confidence_score": "float (0.0 to 1.0)",
  "extraction_notes": "string"
}""",

    DocumentCategory.PRODUCTION_LOG: """Extract industrial production output metrics from this production log.
Target JSON Schema:
{
  "log_date": "YYYY-MM-DD or null",
  "production_tonnes": "float (total billet, ingot, or finished steel in tonnes) or null",
  "product_type": "string (e.g. MS Billet, TMT Bars, Sponge Iron) or null",
  "heats_count": "integer (number of heats in induction/electric arc furnace) or null",
  "rejection_scrap_tonnes": "float (reheating or casting scrap in tonnes) or null",
  "confidence_score": "float (0.0 to 1.0)",
  "extraction_notes": "string"
}""",

    DocumentCategory.OTHER_EVIDENCE: """Extract key verifiable metrics and metadata from this supporting audit evidence.
Target JSON Schema:
{
  "document_title": "string or null",
  "document_date": "YYYY-MM-DD or null",
  "issuing_authority_or_vendor": "string or null",
  "key_metrics": "object with numerical or categorical metrics found",
  "summary": "string describing the document content and scope",
  "confidence_score": "float (0.0 to 1.0)",
  "extraction_notes": "string"
}"""
}


def get_prompt_for_category(category: DocumentCategory) -> str:
    """Retrieve the prompt template matching the specified DocumentCategory."""
    return CATEGORY_PROMPTS.get(
        category,
        CATEGORY_PROMPTS[DocumentCategory.OTHER_EVIDENCE]
    )
