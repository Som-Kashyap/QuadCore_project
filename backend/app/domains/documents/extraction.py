"""
Extraction service coordinating document parsing and Vision/LLM metric extraction.
Delegates to GroqExtractionClient for .pdf and .docx files.
"""

import logging
from pathlib import Path
from typing import Any, Dict

from app.domains.documents.client import (
    GroqExtractionClient,
    GroqAPIKeyMissingError,
    GroqClientError,
    UnsupportedDocumentFormatError,
)
from app.domains.documents.schemas import DocumentCategory, FileFormat

logger = logging.getLogger(__name__)


async def extract_document_metrics(
    file_path: Path | str,
    file_format: FileFormat,
    category: DocumentCategory,
) -> Dict[str, Any]:
    """
    Extract structured industrial decarbonization metrics from an uploaded document.
    Dispatches .pdf and .docx to GroqExtractionClient.
    """
    if file_format not in (FileFormat.PDF, FileFormat.DOCX):
        logger.info(
            "Automatic extraction skipped for format %s. Storing raw document for manual verification.",
            file_format.value,
        )
        return {
            "status": "pending_manual_review",
            "message": f"Automated extraction currently supports .pdf and .docx. Uploaded format is {file_format.value}."
        }

    client = GroqExtractionClient()
    try:
        extracted_data = await client.extract(
            file_path=file_path,
            extension=file_format.value,
            category=category,
        )
        return {
            "status": "success",
            "model": client.DEFAULT_MODEL,
            "extracted_fields": extracted_data,
        }
    except GroqAPIKeyMissingError:
        logger.warning("GROQ_API_KEY is not configured in .env. Skipping automated extraction.")
        return {
            "status": "unconfigured",
            "message": "GROQ_API_KEY is not set in environment or .env."
        }
    except GroqClientError as exc:
        logger.error("Groq extraction failed for %s: %s", file_path, exc)
        return {
            "status": "failed",
            "error": str(exc),
        }
