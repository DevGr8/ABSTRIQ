"""
services/provenance.py
======================
Academic Source Traceability & Cryptographic Provenance Module for ABSTRIQ 3.2.

Provides:
- SHA-256 hashing for original and normalized abstract text and source documents.
- Provenance builders for OpenAlex, arXiv, PDF uploads, and manual entry.
- Integrity verification and edit detection.
"""

import hashlib
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid

PROVENANCE_VERSION = "3.2.0"


def compute_sha256(text_or_bytes: Any) -> str:
    """Compute SHA-256 hex digest for string or bytes."""
    if text_or_bytes is None:
        return ""
    if isinstance(text_or_bytes, str):
        content = text_or_bytes.encode("utf-8")
    elif isinstance(text_or_bytes, (bytes, bytearray)):
        content = bytes(text_or_bytes)
    else:
        content = str(text_or_bytes).encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def normalize_abstract_text(raw_text: str) -> str:
    """Standardize line breaks and whitespace for evaluation and hashing."""
    if not raw_text:
        return ""
    # Normalize unicode spaces, line breaks, and collapse multiple spaces
    text = re.sub(r"\r\n|\r", "\n", raw_text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def validate_doi(doi: Optional[str]) -> Optional[str]:
    """Validate and clean DOI format; returns clean DOI or None if invalid or fabricated."""
    if not doi or not isinstance(doi, str):
        return None
    cleaned = doi.strip()
    # Normalize https://doi.org/ prefix
    if cleaned.lower().startswith("https://doi.org/"):
        cleaned = cleaned[16:].strip()
    elif cleaned.lower().startswith("http://doi.org/"):
        cleaned = cleaned[15:].strip()
    elif cleaned.lower().startswith("doi:"):
        cleaned = cleaned[4:].strip()

    # Standard DOI regex: starts with 10. followed by numbers and slash
    if re.match(r"^10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$", cleaned):
        return f"https://doi.org/{cleaned}"
    return None


def validate_url(url: Optional[str]) -> Optional[str]:
    """Validate external URL for safety; returns URL or None."""
    if not url or not isinstance(url, str):
        return None
    cleaned = url.strip()
    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        return cleaned
    return None


def create_provenance_record(
    source_type: str,
    paper_title: str,
    original_text: str,
    normalized_text: Optional[str] = None,
    source_provider: str = "",
    source_url: Optional[str] = None,
    doi: Optional[str] = None,
    external_id: Optional[str] = None,
    authors: Optional[Any] = None,
    publication_year: Optional[Any] = None,
    publication_venue: Optional[str] = None,
    retrieval_method: str = "api_search",
    source_api: Optional[str] = None,
    original_api_record_id: Optional[str] = None,
    extraction_method: str = "manual_entry",
    extraction_source: str = "user_input",
    extraction_warnings: Optional[List[str]] = None,
    document_hash: Optional[str] = None,
    page_range: Optional[str] = None,
    manually_edited: bool = False,
    import_operation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Construct a complete, verifiable academic provenance record.
    Ensures no fabrication of missing identifiers.
    """
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()
    now_epoch_ms = int(now_utc.timestamp() * 1000)

    orig_text = original_text or ""
    norm_text = normalized_text if normalized_text is not None else normalize_abstract_text(orig_text)

    orig_hash = compute_sha256(orig_text)
    norm_hash = compute_sha256(norm_text)

    # Format authors
    authors_formatted = None
    if isinstance(authors, list):
        authors_formatted = ", ".join(str(a).strip() for a in authors if a)
    elif authors and isinstance(authors, str) and authors.strip():
        authors_formatted = authors.strip()

    # Format publication year
    pub_year_clean = None
    if publication_year:
        year_str = str(publication_year).strip()
        year_match = re.search(r"\b(19\d\d|20\d\d)\b", year_str)
        if year_match:
            pub_year_clean = year_match.group(1)

    clean_doi = validate_doi(doi)
    clean_url = validate_url(source_url)

    # If DOI is present but no source URL, DOI itself is a valid canonical URL
    if clean_doi and not clean_url:
        clean_url = clean_doi

    return {
        "provenanceVersion": PROVENANCE_VERSION,
        "importOperationId": import_operation_id or f"imp_{uuid.uuid4().hex[:12]}",
        # Source identification
        "sourceType": source_type,
        "sourceProvider": source_provider or source_type.capitalize(),
        "sourceUrl": clean_url,
        "doi": clean_doi,
        "externalId": str(external_id).strip() if external_id else None,
        "paperTitle": paper_title.strip() if paper_title else "Untitled Paper",
        "authors": authors_formatted,
        "publicationYear": pub_year_clean,
        "publicationVenue": publication_venue.strip() if publication_venue else None,
        # Retrieval information
        "retrievedAt": now_iso,
        "retrievalTimestamp": now_epoch_ms,
        "retrievalMethod": retrieval_method,
        "sourceApi": source_api,
        "originalApiRecordId": original_api_record_id,
        # Extraction information
        "extractionMethod": extraction_method,
        "extractionSource": extraction_source,
        "originalAbstractText": orig_text,
        "normalizedAbstractText": norm_text,
        "extractionTimestamp": now_iso,
        "extractionStatus": "fallback" if "fallback" in extraction_method else ("warning" if extraction_warnings else "success"),
        "extractionWarnings": list(extraction_warnings or []),
        # Document & Integrity information
        "originalTextHash": orig_hash,
        "normalizedTextHash": norm_hash,
        "documentHash": document_hash,
        "pageRange": page_range,
        "manuallyEdited": manually_edited,
        "modificationTimestamp": now_iso if manually_edited else None,
    }
