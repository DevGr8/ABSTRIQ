"""
services/evaluator.py
=====================
Core 5-stage abstract evaluation workflow:

Stage 1: pre_check()           - Rule-based validation (no LLM calls)
Stage 2: score_abstract()      - LLM scoring with prompt templates
Stage 3: generate_suggestions() - Actionable suggestions for items scoring <= 2
Stage 4: validate_evaluation() - JSON parsing, score checks, evidence verification
Stage 5: store_and_automate()  - Excel persistence and automation triggers
"""

import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import config
import llm
from services import storage
from services import automation
from services import db
from services.provenance import create_provenance_record, compute_sha256, normalize_abstract_text

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Stage 1: Pre-Check (No LLM Calls)
# ---------------------------------------------------------------------------
def pre_check(text: str) -> Dict[str, Any]:
    """
    Examine the candidate abstract before calling any LLM.
    Enforces word counts, prose quality, and identifies prompt injection attempts.

    Returns
    -------
    dict:
      {
        "valid": bool,
        "error": Optional[str],
        "word_count": int,
        "warnings": List[str],
        "injection_detected": bool
      }
    """
    warnings = []
    injection_detected = False

    if not text or not text.strip():
        return {
            "valid": False,
            "error": "The abstract is empty. Please paste or import an abstract.",
            "word_count": 0,
            "warnings": [],
            "injection_detected": False,
        }

    clean_text = text.strip()
    words = clean_text.split()
    word_count = len(words)

    # 1. Check Prompt Injection first (regardless of length)
    lower_text = clean_text.lower()
    for pat in config.INJECTION_PATTERNS:
        if re.search(pat, lower_text):
            injection_detected = True
            warnings.append("Security warning: Prompt manipulation or injection phrase detected in abstract.")
            break

    # 2. Word Count Checks
    if word_count < config.MIN_WORD_COUNT:
        return {
            "valid": False,
            "error": f"Abstract is too short ({word_count} words). Academic abstracts must be at least {config.MIN_WORD_COUNT} words.",
            "word_count": word_count,
            "warnings": warnings,
            "injection_detected": injection_detected,
        }

    if word_count > config.MAX_WORD_COUNT:
        return {
            "valid": False,
            "error": f"Abstract is too long ({word_count} words). Academic abstracts should not exceed {config.MAX_WORD_COUNT} words.",
            "word_count": word_count,
            "warnings": warnings,
            "injection_detected": injection_detected,
        }

    # 2. Non-Prose / Gibberish Detection
    # Ratio of non-alphanumeric characters
    non_alpha = sum(1 for c in clean_text if not (c.isalnum() or c in " .,;:!?-\"'()\n"))
    if non_alpha / max(len(clean_text), 1) > 0.35:
        return {
            "valid": False,
            "error": "Input does not appear to be readable prose (contains excessive symbols or code).",
            "word_count": word_count,
            "warnings": [],
            "injection_detected": False,
        }

    # Repetition check (e.g. "test test test")
    unique_words = set(w.lower() for w in words)
    if len(unique_words) / max(word_count, 1) < 0.20:
        return {
            "valid": False,
            "error": "Input contains repetitive or degenerate text.",
            "word_count": word_count,
            "warnings": [],
            "injection_detected": False,
        }

    # 3. Prompt Injection Detection
    lower_text = clean_text.lower()
    for pat in config.INJECTION_PATTERNS:
        if re.search(pat, lower_text):
            injection_detected = True
            warnings.append("Security warning: Prompt manipulation or injection phrase detected in abstract.")
            break

    # 4. Length Advisories
    if word_count < config.IDEAL_MIN_WORDS:
        warnings.append(f"Abstract is on the shorter side ({word_count} words). Target 120-250 words for optimal rigor.")
    elif word_count > config.IDEAL_MAX_WORDS:
        warnings.append(f"Abstract is slightly long ({word_count} words). Consider trimming toward 120-250 words.")

    return {
        "valid": True,
        "error": None,
        "word_count": word_count,
        "warnings": warnings,
        "injection_detected": injection_detected,
    }


# ---------------------------------------------------------------------------
# Helper: Normalisation & Clean JSON Extraction
# ---------------------------------------------------------------------------
def _clean_json_response(raw_text: str) -> str:
    """Strip markdown fences (```json ... ```) and extract JSON payload."""
    text = raw_text.strip()
    # Remove markdown code fences
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    # If surrounded by commentary, extract from first { to last }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace : last_brace + 1]

    return text


def _normalise_for_matching(text: str) -> str:
    """Lower-case and strip punctuation/extra spaces for fuzzy verification."""
    clean = re.sub(r"[^\w\s]", "", text.lower())
    return re.sub(r"\s+", " ", clean).strip()


# ---------------------------------------------------------------------------
# Stage 4: Validation (Code-Level Safeguards)
# ---------------------------------------------------------------------------
def validate_evaluation(raw_json_str: str, abstract: str) -> Tuple[bool, Dict[str, Any], List[str]]:
    """
    Parse JSON output, verify score bounds, check evidence against abstract,
    and RECOMPUTE total in Python.

    Returns
    -------
    Tuple[bool, Dict[str, Any], List[str]] : (is_valid, parsed_data, warnings_list)
    """
    warnings = []
    cleaned_str = _clean_json_response(raw_json_str)

    try:
        data = json.loads(cleaned_str)
    except Exception as e:
        logger.warning(f"JSON decode failed on response: {e}")
        return False, {}, [f"JSON parsing error: {e}"]

    # Ensure all 5 rubric items exist
    missing_items = [item for item in config.RUBRIC_ITEMS if item not in data]
    if missing_items:
        return False, {}, [f"Missing rubric criteria in LLM response: {missing_items}"]

    norm_abstract = _normalise_for_matching(abstract)
    computed_total = 0
    validated_items = {}

    for item in config.RUBRIC_ITEMS:
        item_data = data[item]
        if not isinstance(item_data, dict):
            item_data = {"score": 0, "reason": str(item_data), "evidence": "not found"}

        # Validate score is integer in range 0-4
        raw_score = item_data.get("score", 0)
        try:
            score = int(round(float(raw_score)))
        except (ValueError, TypeError):
            score = 0
            warnings.append(f"Invalid score format for {item}: '{raw_score}' coerced to 0.")

        if score < 0 or score > 4:
            warnings.append(f"Score for {item} ({score}) was outside 0-4; clamped.")
            score = max(0, min(4, score))

        computed_total += score

        # Check evidence quote
        evidence = str(item_data.get("evidence", "")).strip()
        evidence_found = True

        if evidence and evidence.lower() not in ("not found", "none", "n/a", "missing"):
            norm_evidence = _normalise_for_matching(evidence)
            if norm_evidence and norm_evidence not in norm_abstract:
                # Evidence quote does not match text verbatim!
                evidence_found = False
                warnings.append(f"Possible hallucination: evidence quote for '{item}' not found in abstract text.")

        validated_items[item] = {
            "score": score,
            "reason": str(item_data.get("reason", "")),
            "evidence": evidence or "not found",
            "evidence_found": evidence_found,
            "title": config.RUBRIC[item]["title"],
            "max": 4,
        }

    # Injection detected flag (from LLM or prompt)
    llm_injection = bool(data.get("injection_detected", False))

    result = {
        "items": validated_items,
        "total_score": computed_total,
        "max_score": 20,
        "percentage": round((computed_total / 20.0) * 100, 1),
        "llm_injection_flag": llm_injection,
    }

    return True, result, warnings


# ---------------------------------------------------------------------------
# Stage 2: LLM Scoring with Retry
# ---------------------------------------------------------------------------
def score_abstract(
    abstract: str,
    prompt_version: str = "score_v3",
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
    api_key_override: Optional[str] = None,
) -> Tuple[Dict[str, Any], Dict[str, Any], List[str]]:
    """
    Stage 2: Score abstract using specified prompt template.
    Retries once if validation fails.
    """
    prompt_file = config.PROMPTS_DIR / f"{prompt_version}.txt"
    if not prompt_file.exists():
        logger.warning(f"Prompt file {prompt_file} not found; falling back to score_v3.txt")
        prompt_file = config.PROMPTS_DIR / "score_v3.txt"

    prompt_template = prompt_file.read_text(encoding="utf-8")
    user_prompt = prompt_template.replace("{ABSTRACT}", abstract)

    all_warnings = []
    last_llm_meta = {}

    # Attempt scoring (max 2 attempts)
    for attempt in range(2):
        llm_resp = llm.call_llm(
            system="You are an academic reviewer. Respond with valid JSON only.",
            user=user_prompt,
            provider=provider_override,
            model=model_override,
            api_key=api_key_override,
        )
        last_llm_meta = {
            "provider": llm_resp.get("provider", "mock"),
            "model": llm_resp.get("model", ""),
            "latency_s": llm_resp.get("latency_s", 0.0),
            "is_mock": llm_resp.get("is_mock", False),
        }

        is_valid, parsed_data, val_warnings = validate_evaluation(llm_resp["text"], abstract)
        all_warnings.extend(val_warnings)

        if is_valid:
            return parsed_data, last_llm_meta, all_warnings

        logger.warning(f"Scoring attempt {attempt + 1} validation failed. Retrying...")
        time.sleep(0.5)

    # If both attempts failed, return fallback structured data
    logger.error("All scoring attempts failed validation. Generating safe fallback.")
    fallback_data = {
        "items": {
            item: {
                "score": 0,
                "reason": "Scoring response could not be validated.",
                "evidence": "not found",
                "evidence_found": True,
                "title": config.RUBRIC[item]["title"],
                "max": 4,
            }
            for item in config.RUBRIC_ITEMS
        },
        "total_score": 0,
        "max_score": 20,
        "percentage": 0.0,
        "llm_injection_flag": False,
    }
    all_warnings.append("Validation failed after retry; assigned fallback score.")
    return fallback_data, last_llm_meta, all_warnings


# ---------------------------------------------------------------------------
# Stage 3: LLM Suggestions (for items <= 2)
# ---------------------------------------------------------------------------
def generate_suggestions(
    abstract: str,
    scored_items: Dict[str, Any],
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
    api_key_override: Optional[str] = None,
) -> List[Dict[str, str]]:
    """
    Stage 3: Up to 5 concrete suggestions for criteria scoring <= 2.
    AI is strictly instructed not to invent facts or numbers.
    """
    weak_items = [
        item for item, val in scored_items.items()
        if val.get("score", 0) <= 2
    ]

    if not weak_items:
        return []

    suggest_file = config.PROMPTS_DIR / "suggest.txt"
    if not suggest_file.exists():
        return []

    template = suggest_file.read_text(encoding="utf-8")
    weak_block = "\n".join(
        f"- {item} (score {scored_items[item]['score']}/4): {scored_items[item]['reason']}"
        for item in weak_items
    )

    user_prompt = template.replace("{WEAK_ITEMS}", weak_block).replace("{ABSTRACT}", abstract)

    try:
        resp = llm.call_llm(
            system="You are an academic writing coach. Return valid JSON only.",
            user=user_prompt,
            provider=provider_override,
            model=model_override,
            api_key=api_key_override,
        )
        cleaned = _clean_json_response(resp["text"])
        data = json.loads(cleaned)
        suggestions = data.get("suggestions", [])
        return suggestions[:5]
    except Exception as e:
        logger.warning(f"Suggestion generation failed: {e}")
        # Deterministic rule-based fallback
        fallback_sugs = []
        for item in weak_items:
            fallback_sugs.append({
                "item": item,
                "issue": f"The '{item}' criterion scored low ({scored_items[item]['score']}/4).",
                "fix": f"Revise the abstract to provide concrete details for {item} without omitting key information.",
            })
        return fallback_sugs


# ---------------------------------------------------------------------------
# Stage 5: Orchestrator (Pre-Check -> Score -> Suggest -> Store -> Automate)
# ---------------------------------------------------------------------------
def evaluate_abstract(
    abstract: str,
    title: str = "",
    source: str = "paste",
    prompt_version: str = "score_v3",
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
    api_key_override: Optional[str] = None,
    user_id: Optional[int] = None,
    excel_path: Optional[Path] = None,
    provenance: Optional[Dict[str, Any]] = None,
    original_abstract: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run complete evaluation pipeline for an abstract, preserving cryptographic source provenance.
    """
    start_time = time.perf_counter()
    run_id = f"eval_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # Stage 1: Pre-check
    pc = pre_check(abstract)
    if not pc["valid"]:
        return {
            "success": False,
            "error": pc["error"],
            "pre_check": pc,
            "run_id": run_id,
        }

    combined_warnings = list(pc["warnings"])

    # Stage 2: Score (with retry and validation)
    score_data, llm_meta, val_warnings = score_abstract(
        abstract=abstract,
        prompt_version=prompt_version,
        provider_override=provider_override,
        model_override=model_override,
        api_key_override=api_key_override,
    )
    combined_warnings.extend(val_warnings)

    if score_data.get("llm_injection_flag") or pc.get("injection_detected"):
        injection_alert = True
        if "Security warning: Prompt manipulation or injection phrase detected in abstract." not in combined_warnings:
            combined_warnings.append("Security warning: Prompt manipulation or injection phrase detected in abstract.")
    else:
        injection_alert = False

    # Stage 3: Suggestions (for items <= 2)
    suggestions = generate_suggestions(
        abstract=abstract,
        scored_items=score_data["items"],
        provider_override=provider_override,
        model_override=model_override,
        api_key_override=api_key_override,
    )

    elapsed_seconds = round(time.perf_counter() - start_time, 2)

    # Process and build provenance metadata
    orig_text = (original_abstract or (provenance.get("originalAbstractText") if provenance else None) or abstract).strip()
    norm_text = normalize_abstract_text(abstract)
    is_edited = (provenance.get("manuallyEdited", False) if provenance else False) or (orig_text != norm_text)

    if not provenance:
        prov_record = create_provenance_record(
            source_type="manual",
            source_provider="Manual Input",
            paper_title=title or "Manual Abstract",
            original_text=orig_text,
            normalized_text=norm_text,
            retrieval_method="direct_input",
            extraction_method="manual_entry",
            extraction_source="user_direct_input",
            manually_edited=is_edited,
        )
    else:
        prov_record = dict(provenance)
        prov_record["originalAbstractText"] = orig_text
        prov_record["normalizedAbstractText"] = norm_text
        prov_record["originalTextHash"] = compute_sha256(orig_text)
        prov_record["normalizedTextHash"] = compute_sha256(norm_text)
        prov_record["manuallyEdited"] = is_edited
        if is_edited and not prov_record.get("modificationTimestamp"):
            prov_record["modificationTimestamp"] = now_iso

    # Build evaluation record for storage
    row_record = {
        "timestamp": now_iso,
        "id": run_id,
        "source": source,
        "title": title or "Untitled Paper",
        "prompt_version": prompt_version,
        "model": f"{llm_meta.get('provider')}:{llm_meta.get('model')}",
        "status": "completed",
        "word_count": pc["word_count"],
        "score_purpose": score_data["items"]["purpose"]["score"],
        "score_method": score_data["items"]["method"]["score"],
        "score_results": score_data["items"]["results"]["score"],
        "score_conclusion": score_data["items"]["conclusion"]["score"],
        "score_clarity": score_data["items"]["clarity"]["score"],
        "total": score_data["total_score"],
        "warnings": "; ".join(combined_warnings) if combined_warnings else "none",
        "suggestions": suggestions,
        "seconds": elapsed_seconds,
        "abstract": norm_text,
        "original_abstract": orig_text,
        "provenance": prov_record,
    }

    # Stage 5A: Save to Excel & SQLite
    storage.save_evaluation(row_record, excel_path=excel_path)
    db.save_db_evaluation(row_record, user_id=user_id)

    # Stage 5B: Run Automation trigger
    auto_result = automation.run_automation(row_record, excel_path=excel_path)

    return {
        "success": True,
        "run_id": run_id,
        "timestamp": now_iso,
        "title": title or "Untitled Paper",
        "source": source,
        "word_count": pc["word_count"],
        "prompt_version": prompt_version,
        "llm": llm_meta,
        "scores": score_data["items"],
        "total_score": score_data["total_score"],
        "max_score": 20,
        "percentage": score_data["percentage"],
        "suggestions": suggestions,
        "warnings": combined_warnings,
        "injection_detected": injection_alert,
        "automation": auto_result,
        "elapsed_seconds": elapsed_seconds,
        "abstract": norm_text,
        "original_abstract": orig_text,
        "provenance": prov_record,
    }
