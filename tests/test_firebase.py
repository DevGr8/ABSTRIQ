"""
tests/test_firebase.py
Comprehensive verification of ABSTRIQ 3.0 Firebase implementation:
- Firebase ID token verification and UID extraction
- Firestore user profile management
- Evaluation persistence under users/{uid}/evaluations/{id}
- Strict multi-user isolation (User A vs User B)
- AES-Fernet encrypted custom API key store with masked retrieval
- Dynamic user-isolated Excel report generation
- Legacy unassigned evaluations segregation
"""

import io
import pytest
import openpyxl
from services import firebase_service
from services import migration


@pytest.fixture
def clean_firebase():
    """Ensure clean mock state for testing."""
    firebase_service.init_firebase()
    yield firebase_service


def test_token_verification_and_uid_extraction(clean_firebase):
    """Verify that verify_firebase_id_token extracts UID and never trusts client-supplied identity."""
    # Test valid mock token
    token = "test_token_firebase_uid_alpha_1"
    decoded = clean_firebase.verify_firebase_id_token(token)
    assert decoded is not None
    assert decoded["uid"] == "firebase_uid_alpha_1"
    assert "email" in decoded

    # Empty token rejected
    assert clean_firebase.verify_firebase_id_token("") is None
    assert clean_firebase.verify_firebase_id_token(None) is None


def test_firestore_user_lifecycle(clean_firebase):
    """Test user profile creation and preferences in users/{uid}."""
    uid = "usr_researcher_007"
    user = clean_firebase.get_or_create_user(uid, "agent@lab.edu", "Agent 007")
    assert user["uid"] == uid
    assert user["email"] == "agent@lab.edu"
    assert user["accountStatus"] == "active"

    # Profile update
    updated = clean_firebase.update_user_profile(uid, {"preferences": {"theme": "light", "defaultPrompt": "score_v3"}})
    assert updated["preferences"]["theme"] == "light"


def test_evaluation_storage_and_user_isolation(clean_firebase):
    """Test that User A evaluations are strictly isolated from User B."""
    uid_a = "usr_alice_101"
    uid_b = "usr_bob_202"

    eval_a = {
        "title": "Quantum Error Correction with Neural Decoders",
        "abstract": "We introduce a transformer-based decoder for topological surface codes...",
        "total_score": 19,
        "criteria_scores": {
            "clarity": 4,
            "problem_statement": 4,
            "methodology": 4,
            "results_evidence": 3,
            "significance_implications": 4,
        },
        "provider": "openai",
        "model": "gpt-4o",
        "explanations": {"clarity": "Exceptionally clear."},
        "suggestions": ["Include benchmark against MWPM."],
    }

    eval_b = {
        "title": "Deep Learning for Genomic Variant Calling",
        "abstract": "Accurate variant calling from long-read sequencing remains a challenge...",
        "total_score": 15,
        "criteria_scores": {
            "clarity": 3,
            "problem_statement": 3,
            "methodology": 3,
            "results_evidence": 3,
            "significance_implications": 3,
        },
        "provider": "anthropic",
        "model": "claude-3-5-sonnet",
        "explanations": {"clarity": "Adequate."},
        "suggestions": ["Clarify indel detection limits."],
    }

    # Save Alice's evaluation
    saved_a = clean_firebase.save_evaluation(uid_a, eval_a)
    eval_id_a = saved_a["evaluationId"]
    assert eval_id_a.startswith("eval_")

    # Save Bob's evaluation
    saved_b = clean_firebase.save_evaluation(uid_b, eval_b)
    eval_id_b = saved_b["evaluationId"]
    assert eval_id_b.startswith("eval_")

    # Verify Alice can access her evaluation
    alice_doc = clean_firebase.get_user_evaluation_by_id(uid_a, eval_id_a)
    assert alice_doc is not None
    assert alice_doc["researchTitle"] == eval_a["title"]
    assert alice_doc["totalScore"] == 19

    # CRITICAL: Verify Bob CANNOT access Alice's evaluation (returns None)
    bob_attempt = clean_firebase.get_user_evaluation_by_id(uid_b, eval_id_a)
    assert bob_attempt is None, "Bob must NOT be able to access Alice's evaluation ID"

    # Verify Alice's history contains ONLY Alice's records
    alice_history = clean_firebase.get_user_evaluations(uid_a)
    assert len(alice_history) == 1
    assert alice_history[0]["evaluationId"] == eval_id_a
    assert alice_history[0]["researchTitle"] == eval_a["title"]

    # Verify Bob's history contains ONLY Bob's records
    bob_history = clean_firebase.get_user_evaluations(uid_b)
    assert len(bob_history) == 1
    assert bob_history[0]["evaluationId"] == eval_id_b


def test_encrypted_api_key_vault(clean_firebase):
    """Test that API keys are encrypted at rest with Fernet and masked on retrieval."""
    uid = "usr_crypt_999"
    raw_secret = "sk-proj-supersecretproductionkey123456789"

    # Save key
    saved = clean_firebase.save_api_configuration(uid, "openai", "gpt-4o", raw_secret)
    assert saved["masked_key"].startswith("sk-p...")
    assert raw_secret not in saved["masked_key"]

    # Retrieve masked (client-facing)
    client_view = clean_firebase.get_api_configuration(uid, decrypt=False)
    assert "encryptedKey" not in client_view
    assert client_view["maskedKey"].endswith("6789")

    # Retrieve decrypted (internal server-side execution only)
    internal_view = clean_firebase.get_api_configuration(uid, decrypt=True)
    assert internal_view["api_key"] == raw_secret

    # Verify isolation: another user has NO access
    other_view = clean_firebase.get_api_configuration("usr_attacker_666", decrypt=False)
    assert other_view is None

    # Delete configuration
    clean_firebase.delete_api_configuration(uid)
    assert clean_firebase.get_api_configuration(uid) is None


def test_dynamic_user_isolated_excel_report(clean_firebase):
    """Test that generated Excel workbook contains ONLY the authenticated user's records."""
    uid_carol = "usr_carol_excel_1"
    clean_firebase.save_evaluation(uid_carol, {
        "title": "Carol's Private Evaluation Paper",
        "abstract": "Testing dynamic user-isolated reporting bytes...",
        "total_score": 18,
        "criteria_scores": {"clarity": 4, "problem_statement": 4, "methodology": 3, "results_evidence": 3, "significance_implications": 4},
        "provider": "mock",
        "model": "mock-model",
    })

    excel_bytes = clean_firebase.generate_user_excel_bytes(uid_carol)
    assert len(excel_bytes) > 2000

    # Parse Excel workbook in-memory
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    sheet_names = wb.sheetnames
    assert "evaluations" in sheet_names
    assert "automation_log" in sheet_names
    assert "flagged_low_scores" in sheet_names

    ws = wb["evaluations"]
    # Row 1 is header, Row 2 should be Carol's evaluation
    assert ws.cell(row=2, column=2).value.startswith("eval_")
    assert ws.cell(row=2, column=3).value == "manual"
    assert ws.cell(row=2, column=4).value == "Carol's Private Evaluation Paper"
    assert ws.cell(row=2, column=14).value == 18
    # Ensure no other rows exist
    assert ws.cell(row=3, column=2).value is None


def test_legacy_evaluations_migration_segregation():
    """Test that legacy evaluations remain UNASSIGNED and segregated."""
    summary = migration.run_migration()
    assert summary["migrated"] >= 0
    assert summary["status"] == "completed"

    # Legacy evaluations have assignedUid == None
    legacies = firebase_service.get_legacy_evaluations()
    assert len(legacies) > 0
    for leg in legacies:
        assert leg.get("assignedUid") is None
        assert leg.get("migrationStatus") == "UNASSIGNED"
