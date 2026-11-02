"""
tests/test_auth.py
==================
Complete test suite for:
  - User signup, duplicate checks, input validation
  - User login, invalid password handling
  - Session creation, validation, and logout revocation
  - Protected route access control
  - Password reset flow (forgot password -> token -> reset -> new login)
  - Encrypted custom API key management (at rest, masked, decrypted only internally)
  - Cross-user data and custom key isolation
  - User-linked abstract evaluation
"""

import os
import pytest
import sqlite3
from pathlib import Path
from app import app
from services import db
import config


@pytest.fixture
def auth_client(tmp_path):
    """Create test client with isolated SQLite database."""
    test_db = tmp_path / "test_abstriq.db"
    orig_db = config.DATABASE_PATH
    config.DATABASE_PATH = test_db
    db.init_db(test_db)

    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

    config.DATABASE_PATH = orig_db


def test_signup_success(auth_client):
    """Test successful user registration."""
    resp = auth_client.post("/api/auth/signup", json={
        "email": "alice@lab.edu",
        "username": "alice",
        "password": "Password123!",
        "full_name": "Alice Researcher",
        "institution": "MIT",
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["success"] is True
    assert data["user"]["email"] == "alice@lab.edu"
    assert data["user"]["username"] == "alice"
    assert "token" in data
    assert len(data["token"]) == 64


def test_signup_duplicate_email(auth_client):
    """Test that signup rejects duplicate email."""
    auth_client.post("/api/auth/signup", json={
        "email": "duplicate@lab.edu",
        "username": "userone",
        "password": "Password123!",
    })
    resp = auth_client.post("/api/auth/signup", json={
        "email": "duplicate@lab.edu",
        "username": "usertwo",
        "password": "Password123!",
    })
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["success"] is False
    assert "already exists" in data["error"]


def test_signup_short_password(auth_client):
    """Test that signup rejects passwords under 6 characters."""
    resp = auth_client.post("/api/auth/signup", json={
        "email": "short@lab.edu",
        "username": "shortpwd",
        "password": "123",
    })
    assert resp.status_code == 400
    assert "at least 6 characters" in resp.get_json()["error"]


def test_login_success_and_invalid(auth_client):
    """Test login with valid and invalid credentials."""
    auth_client.post("/api/auth/signup", json={
        "email": "bob@lab.edu",
        "username": "bob_phd",
        "password": "CorrectPassword123!",
    })

    # Valid login with email
    resp = auth_client.post("/api/auth/login", json={
        "identifier": "bob@lab.edu",
        "password": "CorrectPassword123!",
    })
    assert resp.status_code == 200
    assert resp.get_json()["success"] is True
    assert "token" in resp.get_json()

    # Valid login with username
    resp = auth_client.post("/api/auth/login", json={
        "identifier": "bob_phd",
        "password": "CorrectPassword123!",
    })
    assert resp.status_code == 200

    # Invalid password
    resp = auth_client.post("/api/auth/login", json={
        "identifier": "bob_phd",
        "password": "WrongPassword!",
    })
    assert resp.status_code == 401
    assert "Invalid email/username or password" in resp.get_json()["error"]


def test_protected_routes_and_logout(auth_client):
    """Test route protection, bearer token validation, and session revocation."""
    # Attempt access without token
    resp = auth_client.get("/api/auth/me")
    assert resp.status_code == 401

    # Register and get token
    res = auth_client.post("/api/auth/signup", json={
        "email": "carol@lab.edu",
        "username": "carol",
        "password": "Password123!",
    }).get_json()
    token = res["token"]

    # Access protected route with Bearer header
    resp = auth_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.get_json()["user"]["username"] == "carol"

    # Logout
    logout_resp = auth_client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200

    # Token should now be revoked
    resp_after = auth_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp_after.status_code == 401


def test_password_reset_flow(auth_client):
    """Test forgot-password token generation and password reset."""
    auth_client.post("/api/auth/signup", json={
        "email": "david@lab.edu",
        "username": "david",
        "password": "OldPassword123!",
    })

    # Request reset token
    forgot_res = auth_client.post("/api/auth/forgot-password", json={
        "email": "david@lab.edu",
    }).get_json()
    assert forgot_res["success"] is True
    reset_token = forgot_res["reset_token"]
    assert reset_token is not None

    # Reset password with token
    reset_res = auth_client.post("/api/auth/reset-password", json={
        "token": reset_token,
        "new_password": "NewSecurePassword456!",
    }).get_json()
    assert reset_res["success"] is True

    # Old password must fail
    fail_login = auth_client.post("/api/auth/login", json={
        "identifier": "david",
        "password": "OldPassword123!",
    })
    assert fail_login.status_code == 401

    # New password must succeed
    succ_login = auth_client.post("/api/auth/login", json={
        "identifier": "david",
        "password": "NewSecurePassword456!",
    })
    assert succ_login.status_code == 200


def test_custom_api_key_encryption_and_cross_user_isolation(auth_client):
    """Test that custom API keys are encrypted at rest and isolated per user."""
    # Register User A
    user_a = auth_client.post("/api/auth/signup", json={
        "email": "usera@lab.edu",
        "username": "usera",
        "password": "Password123!",
    }).get_json()
    token_a = user_a["token"]

    # Register User B
    user_b = auth_client.post("/api/auth/signup", json={
        "email": "userb@lab.edu",
        "username": "userb",
        "password": "Password123!",
    }).get_json()
    token_b = user_b["token"]

    # User A stores custom OpenAI key
    raw_key = "sk-proj-supersecretkey1234567890"
    set_resp = auth_client.post(
        "/api/user/custom-key",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"provider": "openai", "model": "gpt-4o", "api_key": raw_key},
    )
    assert set_resp.status_code == 200
    assert set_resp.get_json()["custom_key"]["masked_key"] == "sk-p...7890"

    # Verify that in database, the key is NOT plaintext
    conn = db.get_db_connection()
    row = conn.execute("SELECT encrypted_key FROM user_api_keys WHERE user_id = ?", (user_a["user"]["id"],)).fetchone()
    conn.close()
    assert row is not None
    assert raw_key not in row["encrypted_key"]
    assert "sk-proj" not in row["encrypted_key"]

    # User B queries their custom key -> should have none!
    get_b = auth_client.get(
        "/api/user/custom-key",
        headers={"Authorization": f"Bearer {token_b}"},
    ).get_json()
    assert get_b["has_custom_key"] is False
    assert get_b["custom_key"] is None

    # User A removes key
    del_resp = auth_client.delete(
        "/api/user/custom-key",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert del_resp.status_code == 200
    get_a_after = auth_client.get(
        "/api/user/custom-key",
        headers={"Authorization": f"Bearer {token_a}"},
    ).get_json()
    assert get_a_after["has_custom_key"] is False


def test_evaluate_with_authenticated_user(auth_client, monkeypatch):
    """Test evaluation when authenticated links record to user and isolates history."""
    monkeypatch.setattr(config, "LLM_PROVIDER", "mock")

    user_res = auth_client.post("/api/auth/signup", json={
        "email": "evaluser@lab.edu",
        "username": "evaluser",
        "password": "Password123!",
    }).get_json()
    token = user_res["token"]
    user_id = user_res["user"]["id"]

    sample_abstract = (
        "We present a novel graph neural network architecture for molecule property prediction. "
        "Standard message-passing networks suffer from over-smoothing in deep topologies, "
        "limiting their expressive power on complex polycyclic biochemical structures. "
        "Our method introduces adaptive multi-hop skip-attention to retain localized atomic features. "
        "We evaluate on MoleculeNet benchmarks across 42,000 compounds and demonstrate a 14.2% ROC-AUC improvement. "
        "These results confirm that adaptive skip-attention prevents feature collapse in deep molecular representations."
    )

    eval_resp = auth_client.post(
        "/api/evaluate",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "abstract": sample_abstract,
            "title": "GNN Molecule Paper",
            "source": "auth-test",
            "prompt_version": "score_v3",
        },
    )
    assert eval_resp.status_code == 200
    eval_data = eval_resp.get_json()
    assert eval_data["success"] is True

    # Verify history returned for this user contains the evaluation
    hist_resp = auth_client.get(
        "/api/history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hist_resp.status_code == 200
    history = hist_resp.get_json()["history"]
    assert any(h["id"] == eval_data["run_id"] for h in history)
