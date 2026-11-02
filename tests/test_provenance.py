"""
tests/test_provenance.py
Automated tests for Academic Source Provenance (ABSTRIQ 3.2)
Verifies hash generation, normalization, DOI validation, extraction tracking,
edit detection, and SQLite persistence.
"""

import pytest
import hashlib
from services import provenance, evaluator, db, extractor


def test_compute_sha256_and_normalization():
    text1 = "  Transformer   models  suffer from complexity.  \n\n"
    text2 = "Transformer models suffer from complexity."

    norm1 = provenance.normalize_abstract_text(text1)
    norm2 = provenance.normalize_abstract_text(text2)

    assert norm1 == norm2
    assert provenance.compute_sha256(norm1) == provenance.compute_sha256(norm2)
    assert len(provenance.compute_sha256(norm1)) == 64


def test_doi_validation():
    # Valid DOIs normalized to canonical https://doi.org/ URL
    assert provenance.validate_doi("10.1145/3372278.3390678") == "https://doi.org/10.1145/3372278.3390678"
    assert provenance.validate_doi("https://doi.org/10.1038/s41586-020-2649-2") == "https://doi.org/10.1038/s41586-020-2649-2"
    assert provenance.validate_doi("doi:10.1109/CVPR.2016.90") == "https://doi.org/10.1109/CVPR.2016.90"

    # Invalid / Fabricated DOIs
    assert provenance.validate_doi("invalid_doi_string") is None
    assert provenance.validate_doi("http://example.com/paper") is None
    assert provenance.validate_doi("") is None
    assert provenance.validate_doi(None) is None


def test_url_validation():
    assert provenance.validate_url("https://arxiv.org/abs/2301.00001") == "https://arxiv.org/abs/2301.00001"
    assert provenance.validate_url("ftp://invalid.com") is None
    assert provenance.validate_url("not_a_url") is None
    assert provenance.validate_url(None) is None


def test_create_provenance_record_openalex():
    raw_text = (
        "Transformer language models suffer from quadratic computational and memory complexity "
        "with respect to sequence length, creating a major performance bottleneck when processing extended documents. "
        "In this paper, we propose SparseFlash, an efficient attention mechanism that leverages dynamic block sparsification "
        "to retain salient key-value states while discarding redundant tokens during autoregressive inference."
    )
    rec = provenance.create_provenance_record(
        source_type="openalex",
        source_provider="OpenAlex",
        source_url="https://openalex.org/W12345678",
        doi="10.1145/12345.6789",
        paper_title="Scalable Graph Neural Networks",
        authors=["Alice Smith", "Bob Jones"],
        publication_venue="NeurIPS 2024",
        publication_year=2024,
        external_id="W12345678",
        extraction_method="openalex_inverted_index_reconstruction",
        extraction_source="OpenAlex REST API abstract_inverted_index",
        original_text=raw_text,
    )

    assert rec["provenanceVersion"] == "3.2.0"
    assert rec["sourceProvider"] == "OpenAlex"
    assert rec["doi"] == "https://doi.org/10.1145/12345.6789"
    assert rec["extractionMethod"] == "openalex_inverted_index_reconstruction"
    assert rec["manuallyEdited"] is False
    assert len(rec["originalTextHash"]) == 64
    assert len(rec["normalizedTextHash"]) == 64
    assert rec["originalTextHash"] == rec["normalizedTextHash"]


def test_create_provenance_record_arxiv():
    raw_text = (
        "We study sample complexity bounds for offline reinforcement learning under linear function approximation. "
        "Specifically, we analyze pessimistic value iteration and demonstrate that data coverage over reachable state-action "
        "distributions is sufficient to guarantee polynomial sample efficiency without requiring global exploratory coverage."
    )
    rec = provenance.create_provenance_record(
        source_type="arxiv",
        source_provider="arXiv",
        source_url="https://arxiv.org/abs/2402.12345",
        paper_title="Sample Complexity of Offline RL",
        authors=["Charlie Brown"],
        publication_year=2024,
        external_id="2402.12345v1",
        extraction_method="arxiv_atom_xml",
        extraction_source="arXiv Export API atom:summary",
        original_text=raw_text,
    )

    assert rec["provenanceVersion"] == "3.2.0"
    assert rec["sourceProvider"] == "arXiv"
    assert rec["doi"] is None
    assert rec["extractionMethod"] == "arxiv_atom_xml"
    assert rec["manuallyEdited"] is False


def test_txt_extraction_provenance():
    sample_txt = (
        "Title: Sparse Attention Mechanism\n\n"
        "Abstract\n"
        "Transformer language models suffer from quadratic complexity when processing extended contexts. "
        "In this paper, we propose dynamic block sparsification to discard redundant tokens during inference. "
        "We evaluate our approach on 16 benchmark tasks and achieve 4.2x speedup while preserving full accuracy."
    )
    title, abstract, prov = extractor.extract_from_txt_with_provenance(sample_txt, filename="test.txt")

    assert abstract is not None
    assert "dynamic block sparsification" in abstract
    assert prov is not None
    assert prov["sourceType"] == "txt_upload"
    assert prov["extractionMethod"] == "txt_text_extraction"
    assert prov["documentHash"] is not None
    assert len(prov["documentHash"]) == 64


def test_evaluator_preserves_provenance_and_tracks_edits():
    orig_text = (
        "Transformer language models suffer from quadratic computational and memory complexity with respect to sequence length, "
        "creating a major performance bottleneck when processing extended documents. In this paper, we propose SparseFlash, an efficient "
        "attention mechanism that leverages dynamic block sparsification to retain salient key-value states while discarding redundant tokens "
        "during autoregressive inference. We evaluate SparseFlash across 16 tasks in the LongBench benchmark on sequence lengths up to 64k tokens."
    )
    prov = provenance.create_provenance_record(
        source_type="openalex",
        source_provider="OpenAlex",
        source_url="https://openalex.org/W999",
        paper_title="SparseFlash Attention",
        authors=["Author A"],
        publication_year=2024,
        original_text=orig_text,
    )

    # User modifies abstract in Studio (appends an extra sentence)
    modified_text = orig_text + " Our experimental findings show a 4.2x throughput increase and 68 percent reduction in peak memory consumption."

    eval_result = evaluator.evaluate_abstract(
        abstract=modified_text,
        title="SparseFlash Attention",
        source="openalex",
        prompt_version="score_v3",
        provenance=prov,
        original_abstract=orig_text,
    )

    assert eval_result["success"] is True
    res_prov = eval_result["provenance"]
    assert res_prov is not None
    assert res_prov["manuallyEdited"] is True
    assert res_prov["modificationTimestamp"] is not None
    # Original hash points to orig_text, normalized hash points to modified_text
    assert res_prov["originalTextHash"] == provenance.compute_sha256(orig_text)
    assert res_prov["normalizedTextHash"] == provenance.compute_sha256(modified_text)
    assert res_prov["originalTextHash"] != res_prov["normalizedTextHash"]
    assert eval_result["original_abstract"] == orig_text


def test_sqlite_provenance_persistence():
    orig_text = (
        "Transformer language models suffer from quadratic computational complexity when processing extended documents in production environments. "
        "In this work, we present a deterministic benchmark for automated peer review abstract evaluations. "
        "We evaluate our rubric engine on 500 computer science research papers and verify sentence-level empirical evidence bindings."
    )
    prov = provenance.create_provenance_record(
        source_type="arxiv",
        source_provider="arXiv",
        source_url="https://arxiv.org/abs/2401.99999",
        paper_title="DB Provenance Test",
        original_text=orig_text,
    )

    res = evaluator.evaluate_abstract(
        abstract=orig_text,
        title="DB Provenance Test",
        source="arxiv",
        prompt_version="score_v3",
        provenance=prov,
        original_abstract=orig_text,
    )

    eval_id = res["run_id"]
    history = db.get_evaluations_history(limit=10)
    matching = [h for h in history if h.get("id") == eval_id]
    assert len(matching) == 1
    record = matching[0]
    assert record["title"] == "DB Provenance Test"
    assert record["original_abstract"] == orig_text
    assert record["provenance"] is not None
    assert record["provenance"]["provenanceVersion"] == "3.2.0"
    assert record["provenance"]["sourceProvider"] == "arXiv"
