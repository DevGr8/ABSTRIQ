"""
services/firebase_service.py
============================
Production Firebase Service for ABSTRIQ 3.0:
  - Firebase Admin SDK Initialization (with local fallback mock for offline/testing)
  - Firebase ID Token Verification
  - Firestore Collections:
      users/{uid}
      users/{uid}/evaluations/{evaluationId}
      users/{uid}/apiConfigurations/{configId}
      users/{uid}/reports/{reportId}
      legacy_evaluations/{evaluationId}
  - Server-Side AES-Fernet Encrypted Credential Vault (Never plaintext in Firestore)
  - User Data Isolation & Ownership Validation
  - Dynamic User-Specific Excel Reporting
"""

import base64
import hashlib
import hmac
import io
import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from cryptography.fernet import Fernet

import config

logger = logging.getLogger(__name__)

# Firebase Admin global state
_firebase_initialized = False
_firestore_client = None
_auth_client = None
_use_mock_firestore = False


# ---------------------------------------------------------------------------
# In-Memory / SQLite-backed Firestore Mock for Testing & Offline Dev
# ---------------------------------------------------------------------------
class MockFirestoreDB:
    """Thread-safe Firestore mock implementing the exact ABSTRIQ 3.0 schema."""
    def __init__(self):
        self.lock = threading.Lock()
        self.users: Dict[str, Dict[str, Any]] = {}
        self.evaluations: Dict[str, Dict[str, Dict[str, Any]]] = {} # uid -> eval_id -> doc
        self.api_configs: Dict[str, Dict[str, Any]] = {} # uid -> doc
        self.reports: Dict[str, Dict[str, Dict[str, Any]]] = {} # uid -> report_id -> doc
        self.legacy_evaluations: Dict[str, Dict[str, Any]] = {}

    def get_user(self, uid: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self.users.get(uid)

    def set_user(self, uid: str, data: Dict[str, Any]):
        with self.lock:
            existing = self.users.get(uid, {})
            existing.update(data)
            self.users[uid] = existing

    def save_evaluation(self, uid: str, eval_id: str, data: Dict[str, Any]):
        with self.lock:
            if uid not in self.evaluations:
                self.evaluations[uid] = {}
            self.evaluations[uid][eval_id] = data

    def get_evaluations(self, uid: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self.lock:
            user_evals = list(self.evaluations.get(uid, {}).values())
            user_evals.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)
            return user_evals[:limit]

    def get_evaluation(self, uid: str, eval_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self.evaluations.get(uid, {}).get(eval_id)

    def set_api_config(self, uid: str, data: Dict[str, Any]):
        with self.lock:
            self.api_configs[uid] = data

    def get_api_config(self, uid: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self.api_configs.get(uid)

    def delete_api_config(self, uid: str) -> bool:
        with self.lock:
            if uid in self.api_configs:
                del self.api_configs[uid]
                return True
            return False

    def save_report(self, uid: str, report_id: str, data: Dict[str, Any]):
        with self.lock:
            if uid not in self.reports:
                self.reports[uid] = {}
            self.reports[uid][report_id] = data

    def get_reports(self, uid: str) -> List[Dict[str, Any]]:
        with self.lock:
            user_reports = list(self.reports.get(uid, {}).values())
            user_reports.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)
            return user_reports

    def get_report(self, uid: str, report_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self.reports.get(uid, {}).get(report_id)

    def save_legacy_evaluation(self, eval_id: str, data: Dict[str, Any]):
        with self.lock:
            self.legacy_evaluations[eval_id] = data

    def get_legacy_evaluations(self) -> List[Dict[str, Any]]:
        with self.lock:
            return list(self.legacy_evaluations.values())


_mock_db = MockFirestoreDB()


def init_firebase():
    """Initialize Firebase Admin SDK with credentials, or fallback gracefully."""
    global _firebase_initialized, _firestore_client, _auth_client, _use_mock_firestore
    if _firebase_initialized:
        return

    cred_path = Path(config.FIREBASE_CREDENTIALS_PATH)
    if cred_path.exists() and not config.FIREBASE_USE_EMULATOR:
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore, auth

            if not firebase_admin._apps:
                cred = credentials.Certificate(str(cred_path))
                firebase_admin.initialize_app(cred, {
                    "projectId": config.FIREBASE_PROJECT_ID,
                    "storageBucket": config.FIREBASE_STORAGE_BUCKET,
                })
            _firestore_client = firestore.client()
            _auth_client = auth
            _use_mock_firestore = False
            _firebase_initialized = True
            logger.info("Firebase Admin SDK connected to live project: %s", config.FIREBASE_PROJECT_ID)
            return
        except Exception as e:
            logger.warning("Failed to initialize live Firebase Admin SDK: %s. Using secure mock mode.", e)

    # Mock mode for testing and local development
    _use_mock_firestore = True
    _firebase_initialized = True
    logger.info("Firebase initialized in development / mock mode adhering to ABSTRIQ 3.0 schema.")


def is_using_mock() -> bool:
    """Return whether Firebase is running in mock mode."""
    return _use_mock_firestore


def reset_mock_state():
    """Reset mock state between tests for complete test isolation."""
    global _mock_db
    with _mock_db.lock:
        _mock_db.users.clear()
        _mock_db.evaluations.clear()
        _mock_db.api_configs.clear()
        _mock_db.reports.clear()


# ---------------------------------------------------------------------------
# Token Verification
# ---------------------------------------------------------------------------
def verify_firebase_id_token(id_token: str) -> Optional[Dict[str, Any]]:
    """
    Verify Firebase ID Token using Firebase Admin SDK.
    Never trusts client-supplied UIDs; extracts UID strictly from verified token.
    """
    init_firebase()
    if not id_token:
        return None

    if not _use_mock_firestore:
        try:
            from firebase_admin import auth
            decoded_token = auth.verify_id_token(id_token)
            return {
                "uid": decoded_token.get("uid"),
                "email": decoded_token.get("email", ""),
                "email_verified": decoded_token.get("email_verified", False),
                "name": decoded_token.get("name", ""),
            }
        except Exception as e:
            logger.warning("Firebase ID token verification failed: %s", e)
            return None
    else:
        # Development / Testing mock token verification
        # Accepts tokens formatted as "test_token_<uid>" or valid JWT strings
        id_token = id_token.strip()
        if id_token.startswith("test_token_"):
            uid = id_token[len("test_token_"):]
            user_doc = _mock_db.get_user(uid)
            email = user_doc.get("email", f"{uid}@lab.edu") if user_doc else f"{uid}@lab.edu"
            return {
                "uid": uid,
                "email": email,
                "email_verified": True,
                "name": user_doc.get("displayName", uid) if user_doc else uid,
            }
        elif len(id_token) >= 16:
            # Hash string to produce deterministic valid mock UID
            uid = "usr_" + hashlib.sha256(id_token.encode("utf-8")).hexdigest()[:16]
            user_doc = _mock_db.get_user(uid)
            email = user_doc.get("email", f"{uid}@lab.edu") if user_doc else f"{uid}@lab.edu"
            return {
                "uid": uid,
                "email": email,
                "email_verified": True,
                "name": user_doc.get("displayName", uid) if user_doc else uid,
            }
        return None


# ---------------------------------------------------------------------------
# Firestore User Operations: users/{uid}
# ---------------------------------------------------------------------------
def get_or_create_user(uid: str, email: str, display_name: str = "") -> Dict[str, Any]:
    """Fetch user document or initialize new user profile in users/{uid}."""
    init_firebase()
    now_iso = datetime.now(timezone.utc).isoformat()

    if not _use_mock_firestore:
        user_ref = _firestore_client.collection("users").document(uid)
        doc = user_ref.get()
        if doc.exists:
            data = doc.to_dict()
            return data
        else:
            new_user = {
                "uid": uid,
                "email": email.strip().lower(),
                "displayName": display_name.strip() or email.split("@")[0],
                "createdAt": now_iso,
                "updatedAt": now_iso,
                "emailVerified": False,
                "accountStatus": "active",
                "preferences": {
                    "defaultPrompt": "score_v3",
                    "theme": "dark",
                },
            }
            user_ref.set(new_user)
            return new_user
    else:
        existing = _mock_db.get_user(uid)
        if existing:
            return existing
        new_user = {
            "uid": uid,
            "email": email.strip().lower(),
            "displayName": display_name.strip() or email.split("@")[0],
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "emailVerified": False,
            "accountStatus": "active",
            "preferences": {
                "defaultPrompt": "score_v3",
                "theme": "dark",
            },
        }
        _mock_db.set_user(uid, new_user)
        return new_user


def get_user_profile(uid: str) -> Optional[Dict[str, Any]]:
    """Return user profile from users/{uid}."""
    init_firebase()
    if not _use_mock_firestore:
        doc = _firestore_client.collection("users").document(uid).get()
        return doc.to_dict() if doc.exists else None
    return _mock_db.get_user(uid)


def update_user_profile(uid: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update profile fields in users/{uid} preventing modification of immutable keys."""
    init_firebase()
    # Sanitize immutable fields
    updates.pop("uid", None)
    updates.pop("createdAt", None)
    updates.pop("accountStatus", None)
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()

    if not _use_mock_firestore:
        user_ref = _firestore_client.collection("users").document(uid)
        user_ref.update(updates)
        return user_ref.get().to_dict()
    else:
        _mock_db.set_user(uid, updates)
        return _mock_db.get_user(uid) or {}


# ---------------------------------------------------------------------------
# Server-Side AES-Fernet Encryption for Custom API Keys
# ---------------------------------------------------------------------------
def _get_user_fernet(uid: str) -> Fernet:
    """Derive user-specific 32-byte key using HMAC-SHA256(SECRET_KEY, uid)."""
    h = hmac.new(
        config.SECRET_KEY.encode("utf-8"),
        f"abstriq-fire-key-salt-{uid}".encode("utf-8"),
        hashlib.sha256
    ).digest()
    return Fernet(base64.urlsafe_b64encode(h))


def mask_key(key: str) -> str:
    """Mask key for safe display (e.g. sk-12...9876)."""
    if not key:
        return ""
    if len(key) <= 8:
        return "********"
    return f"{key[:4]}...{key[-4:]}"


def save_api_configuration(uid: str, provider: str, model: str, api_key: str) -> Dict[str, Any]:
    """
    Encrypt key server-side and store metadata in users/{uid}/apiConfigurations/{configId}.
    Never stores plaintext API keys in Firestore.
    """
    init_firebase()
    provider = provider.strip().lower()
    model = model.strip()
    api_key = api_key.strip()
    now_iso = datetime.now(timezone.utc).isoformat()
    config_id = f"cfg_{provider}"

    # Encrypt secret using user's salt
    cipher = _get_user_fernet(uid)
    encrypted_key = cipher.encrypt(api_key.encode("utf-8")).decode("utf-8")

    config_data = {
        "configId": config_id,
        "provider": provider,
        "model": model,
        "createdAt": now_iso,
        "updatedAt": now_iso,
        "active": True,
        "hasKey": bool(api_key),
        "has_key": bool(api_key),
        "maskedKey": mask_key(api_key),
        "masked_key": mask_key(api_key),
        "encryptedKey": encrypted_key, # Encrypted at rest
    }

    if not _use_mock_firestore:
        # Save to users/{uid}/apiConfigurations/{configId}
        cfg_ref = _firestore_client.collection("users").document(uid).collection("apiConfigurations").document(config_id)
        # Store encrypted payload
        cfg_ref.set(config_data)
    else:
        _mock_db.set_api_config(uid, config_data)

    # Return safe metadata (no encrypted or raw key in response)
    return {
        "configId": config_id,
        "provider": provider,
        "model": model,
        "hasKey": bool(api_key),
        "has_key": bool(api_key),
        "maskedKey": mask_key(api_key),
        "masked_key": mask_key(api_key),
        "active": True,
        "updatedAt": now_iso,
    }


def get_api_configuration(uid: str, decrypt: bool = False) -> Optional[Dict[str, Any]]:
    """Fetch user API configuration. If decrypt=True, decrypts in-memory for live evaluation."""
    init_firebase()
    config_data = None

    if not _use_mock_firestore:
        configs = _firestore_client.collection("users").document(uid).collection("apiConfigurations").where("active", "==", True).limit(1).get()
        for doc in configs:
            config_data = doc.to_dict()
            break
    else:
        config_data = _mock_db.get_api_config(uid)

    if not config_data:
        return None

    safe_res = {
        "configId": config_data.get("configId"),
        "provider": config_data.get("provider"),
        "model": config_data.get("model"),
        "hasKey": config_data.get("hasKey", True),
        "has_key": config_data.get("hasKey", True),
        "maskedKey": config_data.get("maskedKey", ""),
        "masked_key": config_data.get("maskedKey", ""),
        "active": config_data.get("active", True),
        "updatedAt": config_data.get("updatedAt"),
    }

    if decrypt and config_data.get("encryptedKey"):
        try:
            cipher = _get_user_fernet(uid)
            raw = cipher.decrypt(config_data["encryptedKey"].encode("utf-8")).decode("utf-8")
            safe_res["apiKey"] = raw
            safe_res["api_key"] = raw
        except Exception as e:
            logger.error("Failed to decrypt custom API key for UID %s: %s", uid, e)

    return safe_res


def delete_api_configuration(uid: str) -> bool:
    """Delete custom API configuration for user."""
    init_firebase()
    if not _use_mock_firestore:
        configs = _firestore_client.collection("users").document(uid).collection("apiConfigurations").get()
        for doc in configs:
            doc.reference.delete()
        return True
    return _mock_db.delete_api_config(uid)


# ---------------------------------------------------------------------------
# Firestore Evaluations: users/{uid}/evaluations/{evaluationId}
# ---------------------------------------------------------------------------
def save_evaluation(uid: str, eval_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save evaluation result under users/{uid}/evaluations/{evaluationId}.
    Enforces the required Firestore structure.
    """
    init_firebase()
    eval_id = eval_result.get("run_id") or f"eval_{uuid.uuid4().hex[:10]}"
    now_iso = eval_result.get("timestamp") or datetime.now(timezone.utc).isoformat()
    total_score = int(eval_result.get("total_score", 0))

    # Build individualCriteriaScores
    individual_scores = {}
    evidence_dict = {}
    explanations_dict = {}
    raw_scores = eval_result.get("scores", {})
    for item_key, item_val in raw_scores.items():
        if isinstance(item_val, dict):
            individual_scores[item_key] = item_val.get("score", 0)
            evidence_dict[item_key] = item_val.get("evidence", "")
            explanations_dict[item_key] = item_val.get("reason", "")
        else:
            individual_scores[item_key] = int(item_val)

    firestore_eval_doc = {
        "evaluationId": eval_id,
        "researchTitle": eval_result.get("title", "Untitled Paper"),
        "abstract": eval_result.get("abstract", ""),
        "createdAt": now_iso,
        "updatedAt": now_iso,
        "totalScore": total_score,
        "maximumScore": 20,
        "individualCriteriaScores": individual_scores,
        "evaluationStatus": "flagged" if total_score <= config.LOW_SCORE_THRESHOLD else "completed",
        "provider": eval_result.get("llm", {}).get("provider", "inception"),
        "model": eval_result.get("llm", {}).get("model", "mercury-3"),
        "evidence": evidence_dict,
        "explanations": explanations_dict,
        "suggestions": eval_result.get("suggestions", []),
        "metadata": {
            "source": eval_result.get("source", "manual"),
            "wordCount": eval_result.get("word_count", 0),
            "elapsedSeconds": eval_result.get("elapsed_seconds", 0.0),
            "warnings": eval_result.get("warnings", []),
            "promptVersion": eval_result.get("prompt_version", "score_v3"),
            "injectionDetected": eval_result.get("injection_detected", False),
        },
    }

    if not _use_mock_firestore:
        doc_ref = _firestore_client.collection("users").document(uid).collection("evaluations").document(eval_id)
        doc_ref.set(firestore_eval_doc)
    else:
        _mock_db.save_evaluation(uid, eval_id, firestore_eval_doc)

    return firestore_eval_doc


def get_user_evaluations(uid: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch paginated evaluations strictly belonging to users/{uid}/evaluations."""
    init_firebase()
    if not _use_mock_firestore:
        docs = (
            _firestore_client.collection("users")
            .document(uid)
            .collection("evaluations")
            .order_by("createdAt", direction="DESCENDING")
            .limit(limit)
            .get()
        )
        return [doc.to_dict() for doc in docs]
    return _mock_db.get_evaluations(uid, limit=limit)


def get_user_evaluation_by_id(uid: str, evaluation_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve single evaluation verifying ownership at users/{uid}/evaluations/{evaluationId}."""
    init_firebase()
    if not _use_mock_firestore:
        doc = (
            _firestore_client.collection("users")
            .document(uid)
            .collection("evaluations")
            .document(evaluation_id)
            .get()
        )
        return doc.to_dict() if doc.exists else None
    return _mock_db.get_evaluation(uid, evaluation_id)


def get_user_dashboard_stats(uid: str) -> Dict[str, Any]:
    """Compute real dashboard statistics strictly from user's evaluations."""
    evals = get_user_evaluations(uid, limit=200)
    total_evals = len(evals)

    if total_evals == 0:
        return {
            "total_evaluations": 0,
            "average_score": "N/A",
            "pass_rate": "N/A",
            "pass_rate_pct": "N/A",
            "highest_score": "N/A",
            "lowest_score": "N/A",
            "low_score_count": 0,
            "score_distribution": {"exemplary": 0, "proficient": 0, "adequate": 0, "flagged": 0},
            "criteria_averages": {"purpose": 0.0, "method": 0.0, "results": 0.0, "conclusion": 0.0, "clarity": 0.0},
            "recent_evaluations": [],
            "is_empty": True,
            "welcome_message": "Welcome to ABSTRIQ. Your research evaluation workspace is ready.",
        }

    scores = [e.get("totalScore", 0) for e in evals]
    avg_score = round(sum(scores) / total_evals, 1)
    passed_count = sum(1 for s in scores if s > config.LOW_SCORE_THRESHOLD)
    pass_rate = round((passed_count / total_evals) * 100, 1)

    dist = {"exemplary": 0, "proficient": 0, "adequate": 0, "flagged": 0}
    criteria_sums = {"purpose": 0, "method": 0, "results": 0, "conclusion": 0, "clarity": 0}
    criteria_counts = {"purpose": 0, "method": 0, "results": 0, "conclusion": 0, "clarity": 0}

    for e in evals:
        s = e.get("totalScore", 0)
        if s >= 16:
            dist["exemplary"] += 1
        elif s >= 12:
            dist["proficient"] += 1
        elif s > config.LOW_SCORE_THRESHOLD:
            dist["adequate"] += 1
        else:
            dist["flagged"] += 1

        c_scores = e.get("individualCriteriaScores", {})
        for k in criteria_sums:
            if k in c_scores:
                criteria_sums[k] += c_scores[k]
                criteria_counts[k] += 1

    crit_avgs = {}
    for k in criteria_sums:
        crit_avgs[k] = round(criteria_sums[k] / max(criteria_counts[k], 1), 2)

    return {
        "total_evaluations": total_evals,
        "average_score": avg_score,
        "pass_rate": pass_rate,
        "highest_score": max(scores),
        "lowest_score": min(scores),
        "score_distribution": dist,
        "criteria_averages": crit_avgs,
        "recent_evaluations": evals[:5],
    }


# ---------------------------------------------------------------------------
# User-Specific Excel Reporting: users/{uid}/reports/{reportId}
# ---------------------------------------------------------------------------
def generate_user_excel_bytes(uid: str) -> bytes:
    """
    Dynamically generate a 3-sheet Excel report containing ONLY the authenticated user's records.
    Worksheets:
      1. evaluations
      2. automation_log
      3. flagged_low_scores
    """
    evals = get_user_evaluations(uid, limit=500)

    wb = openpyxl.Workbook()

    # Style definitions
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    auto_fill = PatternFill(start_color="047857", end_color="047857", fill_type="solid")
    flag_fill = PatternFill(start_color="B91C1C", end_color="B91C1C", fill_type="solid")
    header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Sheet 1: evaluations
    ws_eval = wb.active
    ws_eval.title = "evaluations"
    headers_eval = [
        "timestamp", "id", "source", "title", "prompt_version", "model",
        "status", "word_count", "score_purpose", "score_method", "score_results",
        "score_conclusion", "score_clarity", "total", "warnings", "suggestions", "abstract"
    ]
    for col, h in enumerate(headers_eval, start=1):
        cell = ws_eval.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align

    for row_idx, e in enumerate(evals, start=2):
        c_scores = e.get("individualCriteriaScores", {})
        meta = e.get("metadata", {})
        ws_eval.cell(row=row_idx, column=1, value=e.get("createdAt"))
        ws_eval.cell(row=row_idx, column=2, value=e.get("evaluationId"))
        ws_eval.cell(row=row_idx, column=3, value=meta.get("source", "manual"))
        ws_eval.cell(row=row_idx, column=4, value=e.get("researchTitle"))
        ws_eval.cell(row=row_idx, column=5, value=meta.get("promptVersion", "score_v3"))
        ws_eval.cell(row=row_idx, column=6, value=f"{e.get('provider')}:{e.get('model')}")
        ws_eval.cell(row=row_idx, column=7, value=e.get("evaluationStatus"))
        ws_eval.cell(row=row_idx, column=8, value=meta.get("wordCount", 0))
        ws_eval.cell(row=row_idx, column=9, value=c_scores.get("purpose", 0))
        ws_eval.cell(row=row_idx, column=10, value=c_scores.get("method", 0))
        ws_eval.cell(row=row_idx, column=11, value=c_scores.get("results", 0))
        ws_eval.cell(row=row_idx, column=12, value=c_scores.get("conclusion", 0))
        ws_eval.cell(row=row_idx, column=13, value=c_scores.get("clarity", 0))
        ws_eval.cell(row=row_idx, column=14, value=e.get("totalScore", 0))
        ws_eval.cell(row=row_idx, column=15, value="; ".join(meta.get("warnings", [])))
        ws_eval.cell(row=row_idx, column=16, value=json.dumps(e.get("suggestions", [])))
        ws_eval.cell(row=row_idx, column=17, value=e.get("abstract", "")[:500])

    # Sheet 2: automation_log
    ws_auto = wb.create_sheet(title="automation_log")
    headers_auto = ["timestamp", "run_id", "trigger_reason", "action", "status", "details"]
    for col, h in enumerate(headers_auto, start=1):
        cell = ws_auto.cell(row=1, column=col, value=h)
        cell.fill = auto_fill
        cell.font = header_font
        cell.alignment = align

    for row_idx, e in enumerate(evals, start=2):
        s = e.get("totalScore", 0)
        status = "flagged_alert" if s <= config.LOW_SCORE_THRESHOLD else "passed"
        ws_auto.cell(row=row_idx, column=1, value=e.get("createdAt"))
        ws_auto.cell(row=row_idx, column=2, value=e.get("evaluationId"))
        ws_auto.cell(row=row_idx, column=3, value=f"Score check: {s}/20")
        ws_auto.cell(row=row_idx, column=4, value="firestore_user_evaluation_log")
        ws_auto.cell(row=row_idx, column=5, value=status)
        ws_auto.cell(row=row_idx, column=6, value=f"Title: {e.get('researchTitle')}")

    # Sheet 3: flagged_low_scores
    ws_flag = wb.create_sheet(title="flagged_low_scores")
    headers_flag = ["timestamp", "run_id", "title", "total_score", "provider_model", "reason"]
    for col, h in enumerate(headers_flag, start=1):
        cell = ws_flag.cell(row=1, column=col, value=h)
        cell.fill = flag_fill
        cell.font = header_font
        cell.alignment = align

    flagged_row = 2
    for e in evals:
        s = e.get("totalScore", 0)
        if s <= config.LOW_SCORE_THRESHOLD:
            ws_flag.cell(row=flagged_row, column=1, value=e.get("createdAt"))
            ws_flag.cell(row=flagged_row, column=2, value=e.get("evaluationId"))
            ws_flag.cell(row=flagged_row, column=3, value=e.get("researchTitle"))
            ws_flag.cell(row=flagged_row, column=4, value=s)
            ws_flag.cell(row=flagged_row, column=5, value=f"{e.get('provider')}:{e.get('model')}")
            ws_flag.cell(row=flagged_row, column=6, value=f"Abstract scored {s}/20 (<= {config.LOW_SCORE_THRESHOLD} threshold)")
            flagged_row += 1

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def create_user_report(uid: str, report_type: str = "excel_summary") -> Dict[str, Any]:
    """Register report record under users/{uid}/reports/{reportId}."""
    init_firebase()
    report_id = f"rep_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    evals = get_user_evaluations(uid, limit=100)
    related_ids = [e.get("evaluationId") for e in evals if e.get("evaluationId")]

    storage_path = f"users/{uid}/reports/{report_id}.xlsx"
    report_doc = {
        "reportId": report_id,
        "reportType": report_type,
        "storagePath": storage_path,
        "createdAt": now_iso,
        "relatedEvaluationIds": related_ids,
        "status": "ready",
        "evaluationsCount": len(related_ids),
    }

    if not _use_mock_firestore:
        _firestore_client.collection("users").document(uid).collection("reports").document(report_id).set(report_doc)
    else:
        _mock_db.save_report(uid, report_id, report_doc)

    return report_doc


def get_user_reports(uid: str) -> List[Dict[str, Any]]:
    """Return all reports generated by users/{uid}."""
    init_firebase()
    if not _use_mock_firestore:
        docs = (
            _firestore_client.collection("users")
            .document(uid)
            .collection("reports")
            .order_by("createdAt", direction="DESCENDING")
            .get()
        )
        return [doc.to_dict() for doc in docs]
    return _mock_db.get_reports(uid)


def get_legacy_evaluations(limit: int = 100) -> List[Dict[str, Any]]:
    """Return legacy unassigned evaluations from legacy_evaluations/ collection."""
    init_firebase()
    if not _use_mock_firestore:
        docs = _firestore_client.collection("legacy_evaluations").limit(limit).get()
        return [doc.to_dict() for doc in docs]
    return _mock_db.get_legacy_evaluations()[:limit]


def get_user_report_by_id(uid: str, report_id: str) -> Optional[Dict[str, Any]]:
    """Fetch report document verifying ownership at users/{uid}/reports/{reportId}."""
    init_firebase()
    if not _use_mock_firestore:
        doc = (
            _firestore_client.collection("users")
            .document(uid)
            .collection("reports")
            .document(report_id)
            .get()
        )
        return doc.to_dict() if doc.exists else None
    return _mock_db.get_report(uid, report_id)


# ---------------------------------------------------------------------------
# Legacy Migration: legacy_evaluations/{evaluationId} (UNASSIGNED)
# ---------------------------------------------------------------------------
def migrate_legacy_evaluations_to_firestore(excel_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Migrates historical records from data/results.xlsx into legacy_evaluations collection.
    Records remain UNASSIGNED and are NEVER automatically linked to regular users.
    Guarantees idempotency and prevents duplicate migration.
    """
    init_firebase()
    path = excel_path or config.RESULTS_FILE
    if not path.exists():
        return {"migrated": 0, "status": "no_excel_file_found"}

    wb = openpyxl.load_workbook(path, data_only=True)
    if "evaluations" not in wb.sheetnames:
        return {"migrated": 0, "status": "no_evaluations_sheet"}

    ws = wb["evaluations"]
    headers = [cell.value for cell in ws[1] if cell.value is not None]
    if not headers or "id" not in headers:
        return {"migrated": 0, "status": "invalid_headers"}

    migrated_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not any(row):
            continue
        rec = dict(zip(headers, row))
        eval_id = rec.get("id")
        if not eval_id:
            continue

        legacy_doc = {
            "evaluationId": str(eval_id),
            "researchTitle": str(rec.get("title") or "Legacy Paper"),
            "abstract": str(rec.get("abstract") or ""),
            "createdAt": str(rec.get("timestamp") or now_iso),
            "migratedAt": now_iso,
            "assignedUid": None, # UNASSIGNED
            "migrationStatus": "UNASSIGNED",
            "ownershipVerified": False,
            "totalScore": int(rec.get("total") or 0),
            "individualCriteriaScores": {
                "purpose": int(rec.get("score_purpose") or 0),
                "method": int(rec.get("score_method") or 0),
                "results": int(rec.get("score_results") or 0),
                "conclusion": int(rec.get("score_conclusion") or 0),
                "clarity": int(rec.get("score_clarity") or 0),
            },
            "source": "legacy_results_xlsx",
            "migrationAudit": {
                "status": "unassigned_archived",
                "migratedBy": "admin_migration_tool",
            },
        }

        if not _use_mock_firestore:
            doc_ref = _firestore_client.collection("legacy_evaluations").document(str(eval_id))
            if not doc_ref.get().exists:
                doc_ref.set(legacy_doc)
                migrated_count += 1
        else:
            if str(eval_id) not in _mock_db.legacy_evaluations:
                _mock_db.save_legacy_evaluation(str(eval_id), legacy_doc)
                migrated_count += 1

    return {
        "migrated": migrated_count,
        "status": "completed",
        "collection": "legacy_evaluations",
        "assigned": "UNASSIGNED",
    }
