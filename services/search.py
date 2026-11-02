"""
services/search.py
==================
Search and import research papers from OpenAlex and arXiv with full academic source provenance.

1. OpenAlex:
   GET https://api.openalex.org/works?search=...&filter=has_abstract:true
   Rebuilds abstract text from abstract_inverted_index ({word: [positions]}).
   Extraction method: "openalex_inverted_index_reconstruction"

2. arXiv:
   GET https://export.arxiv.org/api/query?search_query=all:...
   Parses the Atom XML feed to extract title, authors, year, and summary.
   Extraction method: "arxiv_atom_xml"
   Fallback (if arXiv direct fails): "arxiv_fallback_openalex" (accurately documented)
"""

import logging
import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional

import requests
from services.provenance import create_provenance_record, compute_sha256

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# OpenAlex Abstract Rebuilder
# ---------------------------------------------------------------------------
def rebuild_openalex_abstract(inverted_index: Optional[Dict[str, List[int]]]) -> str:
    """
    Reconstruct continuous abstract prose from OpenAlex's inverted index format.
    Format: {"Transformer": [0], "models": [1], "achieve": [2, 15], ...}
    """
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""

    position_word_pairs = []
    for word, positions in inverted_index.items():
        if isinstance(positions, list):
            for pos in positions:
                if isinstance(pos, int):
                    position_word_pairs.append((pos, str(word)))

    if not position_word_pairs:
        return ""

    # Sort tokens strictly by position index
    position_word_pairs.sort(key=lambda x: x[0])

    words = [word for _, word in position_word_pairs]
    text = " ".join(words)

    # Clean up standard spacing artifacts
    text = re.sub(r"\s+([,.:;!?)\]])", r"\1", text)
    text = re.sub(r"([( \[])\s+", r"\1", text)
    return text.strip()


# ---------------------------------------------------------------------------
# OpenAlex Search API
# ---------------------------------------------------------------------------
def search_openalex(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Query OpenAlex for works containing an abstract and attach traceable provenance.
    """
    if not query.strip():
        return []

    url = "https://api.openalex.org/works"
    params = {
        "search": query.strip(),
        "filter": "has_abstract:true",
        "per-page": min(limit, 20),
        "mailto": "mini-project-evaluator@university.edu",
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        results = []

        for work in data.get("results", []):
            inv_index = work.get("abstract_inverted_index")
            abstract = rebuild_openalex_abstract(inv_index)
            if not abstract or len(abstract.split()) < 20:
                continue

            # Authors
            authors = []
            for authorship in work.get("authorships", []):
                author_name = authorship.get("author", {}).get("display_name")
                if author_name:
                    authors.append(author_name)

            title = work.get("display_name") or work.get("title") or "Untitled Paper"
            year = work.get("publication_year")
            work_id = work.get("id") or ""
            raw_doi = work.get("doi") # do NOT fallback to work_id for DOI!
            landing_url = work.get("primary_location", {}).get("landing_page_url") or work_id
            venue = work.get("primary_location", {}).get("source", {}).get("display_name")

            # Construct verified provenance record
            prov = create_provenance_record(
                source_type="openalex",
                source_provider="OpenAlex",
                paper_title=title,
                original_text=abstract,
                source_url=landing_url or work_id,
                doi=raw_doi,
                external_id=work_id,
                authors=authors,
                publication_year=year,
                publication_venue=venue,
                retrieval_method="api_search",
                source_api="https://api.openalex.org/works",
                original_api_record_id=work_id,
                extraction_method="openalex_inverted_index_reconstruction",
                extraction_source="openalex_abstract_inverted_index",
            )

            results.append({
                "id": work_id,
                "title": title,
                "authors": ", ".join(authors[:3]) + (" et al." if len(authors) > 3 else ""),
                "year": str(year) if year else "",
                "abstract": abstract,
                "word_count": len(abstract.split()),
                "source": "OpenAlex",
                "url": raw_doi or landing_url or work_id,
                "doi": raw_doi,
                "venue": venue or "",
                "provenance": prov,
            })

            if len(results) >= limit:
                break

        return results

    except Exception as e:
        logger.error(f"OpenAlex search error: {e}")
        return []


# ---------------------------------------------------------------------------
# arXiv Search API (Atom XML)
# ---------------------------------------------------------------------------
def search_arxiv(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Query arXiv API and parse Atom XML feed with accurate academic provenance.
    """
    if not query.strip():
        return []

    clean_query = query.strip().replace(" ", "+")
    url = f"https://export.arxiv.org/api/query?search_query=all:{clean_query}&start=0&max_results={min(limit, 20)}"

    try:
        headers = {
            "User-Agent": "ABSTRIQ-Academic-Evaluator/3.2 (mailto:mini-project-evaluator@university.edu)"
        }
        resp = requests.get(url, headers=headers, timeout=8)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)

        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "arxiv": "http://arxiv.org/schemas/atom",
        }
        results = []

        for entry in root.findall("atom:entry", ns):
            title_elem = entry.find("atom:title", ns)
            summary_elem = entry.find("atom:summary", ns)
            id_elem = entry.find("atom:id", ns)
            published_elem = entry.find("atom:published", ns)
            doi_elem = entry.find("arxiv:doi", ns)

            if summary_elem is None or not summary_elem.text:
                continue

            raw_abstract = summary_elem.text.strip()
            clean_abstract = re.sub(r"\s+", " ", raw_abstract).strip()

            title = re.sub(r"\s+", " ", title_elem.text.strip()) if title_elem is not None and title_elem.text else "Untitled Paper"
            paper_id = id_elem.text.strip() if id_elem is not None and id_elem.text else ""
            year = published_elem.text[:4] if published_elem is not None and published_elem.text else ""
            raw_doi = doi_elem.text.strip() if doi_elem is not None and doi_elem.text else None

            # Authors
            authors = []
            for author in entry.findall("atom:author", ns):
                name_elem = author.find("atom:name", ns)
                if name_elem is not None and name_elem.text:
                    authors.append(name_elem.text.strip())

            prov = create_provenance_record(
                source_type="arxiv",
                source_provider="arXiv",
                paper_title=title,
                original_text=clean_abstract,
                source_url=paper_id,
                doi=raw_doi,
                external_id=paper_id,
                authors=authors,
                publication_year=year,
                publication_venue="arXiv Preprints",
                retrieval_method="api_search",
                source_api="https://export.arxiv.org/api/query",
                original_api_record_id=paper_id,
                extraction_method="arxiv_atom_xml",
                extraction_source="arxiv_atom_feed_summary",
            )

            results.append({
                "id": paper_id,
                "title": title,
                "authors": ", ".join(authors[:3]) + (" et al." if len(authors) > 3 else ""),
                "year": year,
                "abstract": clean_abstract,
                "word_count": len(clean_abstract.split()),
                "source": "arXiv",
                "url": paper_id,
                "doi": raw_doi,
                "provenance": prov,
            })

            if len(results) >= limit:
                break

        if results:
            return results

    except Exception as e:
        logger.warning(f"arXiv direct query encountered issue ({e}). Engaging resilient OpenAlex fallback.")

    # Resilient fallback: query OpenAlex for arXiv preprints; record actual fallback provenance accurately!
    try:
        fallback_results = search_openalex(f"{query} arxiv", limit=limit)
        for p in fallback_results:
            p["source"] = "OpenAlex (arXiv fallback)"
            if "provenance" in p:
                p["provenance"]["sourceType"] = "arxiv_fallback_openalex"
                p["provenance"]["sourceProvider"] = "OpenAlex (arXiv fallback)"
                p["provenance"]["extractionMethod"] = "arxiv_fallback_openalex"
                p["provenance"]["extractionWarnings"].append(
                    "Direct arXiv query was unavailable; paper was retrieved via OpenAlex inverted index fallback."
                )
        return fallback_results
    except Exception as fb_err:
        logger.error(f"Fallback search also failed: {fb_err}")
        return []
