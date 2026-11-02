"""
services/extractor.py
=====================
Extracts research abstracts and paper titles from uploaded PDF and TXT files,
generating cryptographic SHA-256 document and text hashes for academic provenance.

Rules:
  - For PDF: inspects text only from the first 2 pages (using pypdf).
  - Finds text following 'Abstract' up to 'Keywords', 'Index Terms', or 'Introduction'.
  - Computes document SHA-256 hash and attaches provenance metadata.
  - Provides clean error messages if abstract boundaries are not found.
"""

import io
import logging
from pathlib import Path
import re
from typing import Tuple, Optional, Union, Dict, Any

import pypdf
from services.provenance import create_provenance_record, compute_sha256

logger = logging.getLogger(__name__)


def find_abstract_in_text(raw_text: str) -> Optional[str]:
    """
    Search continuous document text for the abstract section.
    Locates the word 'Abstract' and extracts text up to 'Keywords' or 'Introduction'.
    """
    if not raw_text or not raw_text.strip():
        return None

    # Normalise line breaks and spacing
    text = re.sub(r"\r\n|\r", "\n", raw_text)

    # 1. Match 'Abstract' heading (case-insensitive, standalone or with punctuation)
    abstract_start_pat = re.compile(
        r"(?:^|\n|\s)(?:ABSTRACT|Abstract|A\s*B\s*S\s*T\s*R\s*A\s*C\s*T)\s*[:.\-—–]?\s*",
        re.IGNORECASE,
    )
    match_start = abstract_start_pat.search(text)
    if not match_start:
        return None

    body_after = text[match_start.end():]

    # 2. Match common ending boundaries: Keywords, Index Terms, Introduction
    end_boundary_pat = re.compile(
        r"(?:\n|\s{2,})(?:(?:Key\s*words?|Index\s*Terms?|Keywords?)\s*[:.\-—–]|"
        r"(?:(?:1|I)\.?\s+)?(?:INTRODUCTION|Introduction)\b)",
        re.IGNORECASE,
    )

    match_end = end_boundary_pat.search(body_after)
    if match_end:
        candidate = body_after[:match_end.start()].strip()
    else:
        # Fallback: take up to the first 400 words if explicit boundary isn't found
        words = body_after.strip().split()
        candidate = " ".join(words[:300])

    # Clean up hyphenation at line breaks (e.g., 'trans- \nformer' -> 'transformer')
    clean = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", candidate)
    # Collapse multiple whitespace/newlines into single space
    clean = re.sub(r"\s+", " ", clean).strip()

    # Reject if candidate is trivially short (< 10 words)
    if len(clean.split()) < 10:
        return None

    return clean


def extract_title_heuristic(first_page_text: str) -> Optional[str]:
    """
    Heuristic to extract paper title from the top non-empty lines of page 1.
    """
    lines = [line.strip() for line in first_page_text.split("\n") if line.strip()]
    candidate_lines = []

    for line in lines[:8]:
        lower = line.lower()
        if any(skip in lower for skip in ["arxiv:", "ieee", "acm", "proceedings", "conference", "vol.", "no.", "page", "http"]):
            continue
        if re.match(r"^(abstract|keywords|introduction)\b", lower):
            break
        candidate_lines.append(line)
        if len(" ".join(candidate_lines).split()) >= 6:
            break

    if candidate_lines:
        title = " ".join(candidate_lines)
        title = re.sub(r"\s+", " ", title).strip()
        if 4 <= len(title.split()) <= 25:
            return title

    return None


def extract_from_pdf(
    file_input: Union[str, io.BytesIO, bytes],
    filename: str = "document.pdf",
) -> Tuple[Optional[str], Optional[str]]:
    """
    Read first two pages of a PDF and extract title and abstract.
    Maintains backward compatibility returning (title, abstract).
    """
    title, abstract, _ = extract_from_pdf_with_provenance(file_input, filename=filename)
    return title, abstract


def extract_from_pdf_with_provenance(
    file_input: Union[str, io.BytesIO, bytes],
    filename: str = "document.pdf",
) -> Tuple[Optional[str], Optional[str], Optional[Dict[str, Any]]]:
    """
    Read first two pages of a PDF, compute document SHA-256, and generate provenance.
    Returns (title, abstract, provenance).
    """
    try:
        raw_bytes = b""
        if isinstance(file_input, bytes):
            raw_bytes = file_input
            stream = io.BytesIO(file_input)
        elif isinstance(file_input, (str, Path)):
            with open(file_input, "rb") as f:
                raw_bytes = f.read()
            stream = io.BytesIO(raw_bytes)
        else:
            raw_bytes = file_input.read()
            stream = io.BytesIO(raw_bytes)

        doc_hash = compute_sha256(raw_bytes)

        reader = pypdf.PdfReader(stream)
        num_pages = len(reader.pages)
        if num_pages == 0:
            return None, None, None

        page_texts = []
        for i in range(min(2, num_pages)):
            text = reader.pages[i].extract_text() or ""
            page_texts.append(text)

        combined_text = "\n\n".join(page_texts)
        title = extract_title_heuristic(page_texts[0]) if page_texts else "Uploaded Research Document"
        abstract = find_abstract_in_text(combined_text)

        warnings = []
        if not title:
            warnings.append("Automatic title detection was inconclusive; using default filename.")
            title = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()

        page_range = f"Pages 1-{min(2, num_pages)} of {num_pages}"

        prov = None
        if abstract:
            prov = create_provenance_record(
                source_type="pdf_upload",
                source_provider="Uploaded Document (PDF)",
                paper_title=title,
                original_text=abstract,
                source_url=None,
                doi=None,
                external_id=filename,
                retrieval_method="document_upload",
                source_api=None,
                original_api_record_id=filename,
                extraction_method="pdf_text_extraction",
                extraction_source="pypdf_page_text_extractor",
                extraction_warnings=warnings,
                document_hash=doc_hash,
                page_range=page_range,
            )

        return title, abstract, prov

    except Exception as e:
        logger.error(f"Error parsing PDF: {e}")
        return None, None, None


def extract_from_txt(
    content: str,
    filename: str = "document.txt",
) -> Tuple[Optional[str], Optional[str]]:
    """Backward compatible plain text extraction."""
    title, abstract, _ = extract_from_txt_with_provenance(content, filename=filename)
    return title, abstract


def extract_from_txt_with_provenance(
    content: str,
    filename: str = "document.txt",
) -> Tuple[Optional[str], Optional[str], Optional[Dict[str, Any]]]:
    """Plain text extraction with SHA-256 document and text provenance."""
    lines = [l.strip() for l in content.split("\n") if l.strip()]
    title = lines[0] if lines and len(lines[0].split()) <= 25 else filename.rsplit(".", 1)[0].title()
    abstract = find_abstract_in_text(content)

    prov = None
    if abstract:
        doc_hash = compute_sha256(content.encode("utf-8"))
        prov = create_provenance_record(
            source_type="txt_upload",
            source_provider="Uploaded Document (Text)",
            paper_title=title,
            original_text=abstract,
            source_url=None,
            doi=None,
            external_id=filename,
            retrieval_method="document_upload",
            source_api=None,
            original_api_record_id=filename,
            extraction_method="txt_text_extraction",
            extraction_source="plain_text_stream",
            document_hash=doc_hash,
            page_range="Plain Text Document",
        )

    return title, abstract, prov
