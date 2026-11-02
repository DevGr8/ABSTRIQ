"""
llm.py
======
Unified LLM interface for the Research Abstract Evaluator.

Supports providers:
  - anthropic (plain HTTP to api.anthropic.com/v1/messages)
  - openai    (plain HTTP to api.openai.com/v1/chat/completions)
  - gemini    (plain HTTP to generativelanguage.googleapis.com)
  - mock      (offline keyword & heuristic engine; zero API keys needed)

The active provider is chosen via LLM_PROVIDER in .env.
All network calls use temperature=0 and request JSON output.
"""

import json
import logging
import os
import re
import time
from typing import Optional, Dict, Any

import requests

import config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Offline Mock Provider (Rule & Keyword Heuristics)
# ---------------------------------------------------------------------------
def _mock_score_abstract(user_prompt: str) -> str:
    """
    Offline heuristic evaluator for testing and grading without API keys.
    Inspects the abstract bounded by <abstract>...</abstract>.
    Extracts real verbatim phrases for evidence.
    """
    # Extract abstract text from the final XML tags block
    match = re.search(r"<abstract>\s*([\s\S]*?)\s*</abstract>\s*$", user_prompt, re.IGNORECASE)
    if match:
        abstract = match.group(1).strip()
    else:
        matches = re.findall(r"<abstract>\s*([\s\S]*?)\s*</abstract>", user_prompt, re.IGNORECASE)
        abstract = matches[-1].strip() if matches else user_prompt.strip()

    lower = abstract.lower()
    words = abstract.split()
    word_count = len(words)

    # 1. Check prompt injection
    injection_detected = False
    for pat in config.INJECTION_PATTERNS:
        if re.search(pat, lower):
            injection_detected = True
            break

    # Helper: find first matching sentence or phrase
    def find_phrase(keywords):
        for s in re.split(r"[.!?]\s+", abstract):
            s_clean = s.strip()
            if any(k in s_clean.lower() for k in keywords):
                # Return short verbatim excerpt (up to 12 words)
                w = s_clean.split()
                return " ".join(w[:12])
        return "not found"

    # --- Criterion 1: Purpose ---
    purpose_keys = ["propose", "investigate", "address", "objective", "aim to", "in this paper", "we present", "we introduce", "focuses on", "problem of"]
    has_purpose = any(k in lower for k in purpose_keys)
    has_gap = any(k in lower for k in ["however", "limitation", "bottleneck", "challenge", "remains unclear", "lack of", "suffer from"])
    if has_purpose and has_gap:
        p_score = 4
        p_reason = "Explicitly states the problem, research gap, and paper aim."
    elif has_purpose:
        p_score = 3
        p_reason = "Research aim and problem stated clearly, but research gap is implicit."
    elif has_gap:
        p_score = 2
        p_reason = "Mentions background challenges, but specific objective is vague."
    elif word_count > 30:
        p_score = 1
        p_reason = "General context provided without a distinct research aim."
    else:
        p_score = 0
        p_reason = "Research purpose is missing or not found."
    p_evidence = find_phrase(purpose_keys if p_score >= 2 else ["paper", "study", "research"])

    # --- Criterion 2: Method ---
    method_keys = ["framework", "architecture", "algorithm", "dataset", "trained on", "evaluated on", "benchmark", "neural", "transformer", "model", "pipeline", "methodology"]
    method_matches = sum(1 for k in method_keys if k in lower)
    if method_matches >= 3:
        m_score = 4
        m_reason = "Concrete methodology specified with algorithm, setup, and evaluation framework."
    elif method_matches >= 2:
        m_score = 3
        m_reason = "Core methodology and approach mentioned, though hyperparameter/setup details are sparse."
    elif method_matches == 1:
        m_score = 2
        m_reason = "High-level method mentioned without concrete technical specifics."
    else:
        m_score = 0 if "method" not in lower and "approach" not in lower else 1
        m_reason = "Methodology is absent or poorly described."
    m_evidence = find_phrase(method_keys)

    # --- Criterion 3: Results ---
    # Look for quantitative result metrics (not just arbitrary numbers in setup)
    has_result_metrics = any(k in lower for k in ["accuracy", "f1", "bleu", "latency", "speedup", "p <", "p=", "reduction", "outperform", "higher than", "state-of-the-art", "sota", "improved by", "yields an error", "error rate"])
    has_numbers_in_results = bool(re.search(r"(?:achieve|yield|score|speedup|accuracy|reduce|improved?|by)\s+[^.!?]*\b\d+(\.\d+)?%?\b", lower)) or bool(re.search(r"\b\d+(\.\d+)?%\b", lower))
    has_comparison = any(k in lower for k in ["compared to", "over baseline", "outperforms", "than standard", "versus", "against"])

    if has_numbers_in_results and has_result_metrics and has_comparison:
        r_score = 4
        r_reason = "Concrete numerical findings reported with direct baseline comparisons."
    elif has_numbers_in_results and (has_result_metrics or "%" in abstract):
        r_score = 3
        r_reason = "Quantified findings provided, but baseline comparison is incomplete."
    elif has_result_metrics or any(k in lower for k in ["results indicate", "results demonstrate", "findings indicate", "superior performance"]):
        r_score = 2
        r_reason = "Qualitative results claimed without specific metrics or numbers."
    elif any(k in lower for k in ["results", "findings", "observed that", "show that"]):
        r_score = 1
        r_reason = "Ambiguous or vague claim of results."
    else:
        r_score = 0
        r_reason = "No concrete experimental findings or results reported."

    # Evidence for results
    r_evidence = "not found"
    for s in re.split(r"[.!?]\s+", abstract):
        s_low = s.lower()
        if any(m in s_low for m in ["accuracy", "speedup", "%", "outperform", "results show", "findings show", "achieves"]):
            r_evidence = " ".join(s.strip().split()[:12])
            break

    # --- Criterion 4: Conclusion ---
    conclusion_keys = ["demonstrate that", "conclude that", "our findings highlight", "contribution of this work", "in conclusion", "our technique enables", "significance of these findings", "these results show that"]
    has_conclusion = any(k in lower for k in conclusion_keys)
    has_implication = any(k in lower for k in ["practical", "broad", "scalable", "applications", "enables", "implications for"])

    # If the abstract has no results (r_score <= 1) and only mentions future work, conclusion cannot be high
    if r_score <= 1 and not has_conclusion:
        if "future work" in lower or "future directions" in lower:
            c_score = 1
            c_reason = "Ends with future intentions without articulating actual results or conclusions."
            c_evidence = find_phrase(["future work", "future directions"])
        else:
            c_score = 0
            c_reason = "No conclusion, contribution, or significance statement provided."
            c_evidence = "not found"
    elif has_conclusion and has_implication:
        c_score = 4
        c_reason = "Articulates key contribution, practical implications, and broader impact."
        c_evidence = find_phrase(conclusion_keys)
    elif has_conclusion or any(k in lower for k in ["in summary", "these findings", "this work demonstrates"]):
        c_score = 3
        c_reason = "Clear conclusion and contribution stated, though broader implications are omitted."
        c_evidence = find_phrase(["these findings", "this work", "demonstrates", "conclude"])
    elif any(k in lower for k in ["suggests", "highlights", "shows that"]):
        c_score = 2
        c_reason = "Minimal closing statement without clear significance or limitations."
        c_evidence = find_phrase(["suggests", "highlights", "shows"])
    else:
        c_score = 0
        c_reason = "No conclusion or contribution statement provided."
        c_evidence = "not found"

    # --- Criterion 5: Clarity ---
    if config.IDEAL_MIN_WORDS <= word_count <= config.IDEAL_MAX_WORDS:
        cl_score = 4
        cl_reason = f"Excellent structure and length ({word_count} words, ideal is 120-250)."
    elif 90 <= word_count <= 320:
        cl_score = 3
        cl_reason = f"Clear academic prose, acceptable length ({word_count} words)."
    elif 50 <= word_count <= 450:
        cl_score = 2
        cl_reason = f"Noticeable length or phrasing issues ({word_count} words)."
    else:
        cl_score = 1
        cl_reason = f"Word count ({word_count} words) is far outside academic standards."
    cl_evidence = " ".join(words[:10]) if words else "not found"

    # Strict constraint: if injection was attempted, do not reward
    if injection_detected:
        p_score = min(p_score, 2)
        m_score = min(m_score, 2)
        r_score = min(r_score, 2)
        c_score = min(c_score, 2)
        cl_score = min(cl_score, 2)

    total = p_score + m_score + r_score + c_score + cl_score

    payload = {
        "purpose": {"score": p_score, "reason": p_reason, "evidence": p_evidence},
        "method": {"score": m_score, "reason": m_reason, "evidence": m_evidence},
        "results": {"score": r_score, "reason": r_reason, "evidence": r_evidence},
        "conclusion": {"score": c_score, "reason": c_reason, "evidence": c_evidence},
        "clarity": {"score": cl_score, "reason": cl_reason, "evidence": cl_evidence},
        "total": total,
        "injection_detected": injection_detected,
    }
    return json.dumps(payload, indent=2)


def _mock_suggest(user_prompt: str) -> str:
    """
    Offline heuristic suggestion generator for weak items (<= 2).
    Generates tailored advice without inventing fake numbers.
    """
    suggestions = []
    lower = user_prompt.lower()

    if "purpose" in lower:
        suggestions.append({
            "item": "purpose",
            "issue": "The research problem or literature gap is not explicitly articulated.",
            "fix": "Open with 1-2 sentences stating the specific gap in prior work and explicitly state: 'In this paper, we investigate... to address [specific bottleneck]'."
        })
    if "method" in lower:
        suggestions.append({
            "item": "method",
            "issue": "Lacks concrete technical details on the architecture, setup, or datasets used.",
            "fix": "Name the specific model or algorithm proposed, identify the benchmark dataset(s), and state the training/evaluation framework."
        })
    if "results" in lower:
        suggestions.append({
            "item": "results",
            "issue": "Findings are qualitative or missing direct baseline comparisons.",
            "fix": "Include 1-2 primary quantitative metrics with percentage improvements or error reduction compared against standard baselines."
        })
    if "conclusion" in lower:
        suggestions.append({
            "item": "conclusion",
            "issue": "Missing broader implications, limitations, or actionable takeaways.",
            "fix": "Close with a sentence outlining the practical significance of your findings and future research directions."
        })
    if "clarity" in lower:
        suggestions.append({
            "item": "clarity",
            "issue": "Length or academic flow needs adjustment.",
            "fix": "Aim for 120-250 words following the standard sequence: Context -> Problem -> Proposed Method -> Findings -> Impact."
        })

    return json.dumps({"suggestions": suggestions[:5]}, indent=2)


# ---------------------------------------------------------------------------
# Provider HTTP Callers
# ---------------------------------------------------------------------------
def _call_gemini_http(system: str, user: str, model: str, api_key: str) -> str:
    """Plain HTTP call to Google Gemini REST API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json",
        },
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=25)
    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError(f"Gemini returned no candidates: {data}")
    return candidates[0]["content"]["parts"][0]["text"]


def _call_openai_http(system: str, user: str, model: str, api_key: str) -> str:
    """Plain HTTP call to OpenAI Chat Completions API."""
    url = "https://api.openai.com/v1/chat/completions"
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=25)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def _call_inception_http(system: str, user: str, model: str, api_key: str) -> str:
    """Plain HTTP call to Inception Labs API (https://api.inceptionlabs.ai/v1/chat/completions)."""
    url = "https://api.inceptionlabs.ai/v1/chat/completions"
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    payload = {
        "model": model or "mercury-3",
        "reasoning_effort": "low",
        "messages": messages,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices", [])
    if not choices:
        raise ValueError(f"Inception API returned no choices: {data}")
    msg = choices[0].get("message", {})
    text = msg.get("content") or msg.get("reasoning_content") or ""
    if not text.strip():
        raise ValueError(f"Inception API returned empty content: {data}")
    return text


def _call_nvidia_http(system: str, user: str, model: str, api_key: str) -> str:
    """Plain HTTP call to NVIDIA NIM (OpenAI-compatible) endpoint."""
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.0,
        "max_tokens": 4096,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=65)
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices", [])
    if not choices:
        raise ValueError(f"NVIDIA API returned no choices: {data}")
    msg = choices[0].get("message", {})
    # For reasoning models, content can be in content or reasoning_content
    text = msg.get("content") or msg.get("reasoning_content") or ""
    if not text.strip():
        raise ValueError(f"NVIDIA API returned empty content: {data}")
    return text


def _call_anthropic_http(system: str, user: str, model: str, api_key: str) -> str:
    """Plain HTTP call to Anthropic Messages API."""
    url = "https://api.anthropic.com/v1/messages"
    payload = {
        "model": model,
        "max_tokens": 2048,
        "temperature": 0.0,
        "messages": [{"role": "user", "content": user}],
    }
    if system:
        payload["system"] = system

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=25)
    resp.raise_for_status()
    data = resp.json()
    return data["content"][0]["text"]


# ---------------------------------------------------------------------------
# Public Unified Function
# ---------------------------------------------------------------------------
def call_llm(
    system: Optional[str],
    user: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    ONE function to call the configured LLM provider.
    Supports: inception | nvidia | openai | gemini | anthropic | mock

    Parameters
    ----------
    system : System instruction or role prompt (can be None)
    user   : User prompt (abstract + instructions)
    provider : Optional provider override
    model  : Optional model override
    api_key : Optional API key override (e.g. user-supplied from UI)

    Returns
    -------
    dict:
      {
        "text": str,
        "provider": str,
        "model": str,
        "latency_s": float,
        "is_mock": bool
      }
    """
    active_provider = (provider or config.LLM_PROVIDER).strip().lower()
    active_model = model or (config.LLM_MODEL if not provider else None) or config.DEFAULT_MODELS.get(active_provider, "default")
    api_key_to_use = (api_key or config.LLM_API_KEY).strip()

    start_time = time.perf_counter()

    # 1. Mock Provider (Default offline heuristic)
    if active_provider == "mock" or not api_key_to_use:
        if active_provider != "mock" and not api_key_to_use:
            logger.info(f"No API key provided for '{active_provider}'. Falling back to MOCK provider.")
            active_provider = "mock"
            active_model = config.DEFAULT_MODELS["mock"]

        # If it's a suggestion request (identified by prompt keyword)
        if "<weak_items>" in user or "suggestions" in (system or "").lower():
            raw_text = _mock_suggest(user)
        else:
            raw_text = _mock_score_abstract(user)

        latency = round(time.perf_counter() - start_time, 4)
        return {
            "text": raw_text,
            "provider": "mock",
            "model": active_model,
            "latency_s": latency,
            "is_mock": True,
        }

    # 2. Live API Providers
    try:
        if active_provider == "gemini":
            raw_text = _call_gemini_http(system or "", user, active_model, api_key_to_use)
        elif active_provider == "openai":
            raw_text = _call_openai_http(system or "", user, active_model, api_key_to_use)
        elif active_provider == "anthropic":
            raw_text = _call_anthropic_http(system or "", user, active_model, api_key_to_use)
        elif active_provider == "nvidia":
            raw_text = _call_nvidia_http(system or "", user, active_model, api_key_to_use)
        elif active_provider in ("inception", "mercury", "inceptionlabs"):
            raw_text = _call_inception_http(system or "", user, active_model, api_key_to_use)
        else:
            raise ValueError(f"Unsupported LLM_PROVIDER: {active_provider}")

        latency = round(time.perf_counter() - start_time, 3)
        return {
            "text": raw_text,
            "provider": active_provider,
            "model": active_model,
            "latency_s": latency,
            "is_mock": False,
        }

    except Exception as e:
        logger.error(f"Live LLM call to '{active_provider}' failed: {e}. Falling back to MOCK.")
        # Graceful fallback to mock on network or credential error
        if "<weak_items>" in user:
            raw_text = _mock_suggest(user)
        else:
            raw_text = _mock_score_abstract(user)

        latency = round(time.perf_counter() - start_time, 3)
        return {
            "text": raw_text,
            "provider": f"mock (fallback from {active_provider})",
            "model": config.DEFAULT_MODELS["mock"],
            "latency_s": latency,
            "is_mock": True,
            "fallback_error": str(e),
        }
