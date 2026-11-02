"""
services/extractor.py
=====================
Extracts research abstracts and paper titles from uploaded PDF and TXT files.

Rules:
  - For PDF: inspects text only from the first 2 pages (using pypdf).
  - Finds text following 'Abstract' up to 'Keywords', 'Index Terms', or 'Introduction'.
  - Provides clean error messages if abstract boundaries are not found.
"""

import io
import logging
import re
from typing import Tuple, Optional, Union

import pypdf

logger = logging.getLogger(__name__)


def find_abstract_in_text(raw_text: str) -> Optional[str]:
    """
    Search continuous document text for the abstract section.
    Locates the word 'Abstract' and extracts text up to 'Keywords' or 'Introduction'.

    Parameters
    ----------
    raw_text : Extracted string content from document.

    Returns
    -------
    Optional[str] : Cleaned abstract text, or None if not found.
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
        # Skip headers, page numbers, arxiv watermarks, or conference headers
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
        # Collapse whitespace
        title = re.sub(r"\s+", " ", title).strip()
        if 4 <= len(title.split()) <= 25:
            return title

    return None


def extract_from_pdf(file_input: Union[str, io.BytesIO, bytes]) -> Tuple[Optional[str], Optional[str]]:
    """
    Read first two pages of a PDF and extract title and abstract.

    Returns
    -------
    Tuple[Optional[str], Optional[str]] : (title, abstract)
    """
    try:
        if isinstance(file_input, bytes):
            stream = io.BytesIO(file_input)
        elif isinstance(file_input, (str, Path)):
            stream = open(file_input, "rb")
        else:
            stream = file_input

        reader = pypdf.PdfReader(stream)
        num_pages = len(reader.pages)
        if num_pages == 0:
            return None, None

        # Extract text from first 2 pages only
        page_texts = []
        for i in range(min(2, num_pages)):
            text = reader.pages[i].extract_text() or ""
            page_texts.append(text)

        combined_text = "\n\n".join(page_texts)
        title = extract_title_heuristic(page_texts[0]) if page_texts else None
        abstract = find_abstract_in_text(combined_text)

        return title, abstract

    except Exception as e:
        logger.error(f"Error parsing PDF: {e}")
        return None, None


def extract_from_txt(content: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract title and abstract from plain text document.
    """
    lines = [l.strip() for l in content.split("\n") if l.strip()]
    title = lines[0] if lines and len(lines[0].split()) <= 25 else None
    abstract = find_abstract_in_text(content)
    return title, abstract
