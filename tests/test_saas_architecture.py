"""
tests/test_saas_architecture.py
================================
Comprehensive verification of ABSTRIQ 3.1 Authentication-First SaaS Architecture:
1. Public website endpoints accessible without login (Config, Demo sample, Demo evaluate).
2. Private workspace endpoints strictly blocked without login (401 Unauthorized).
3. Authenticated researchers access their isolated workspace, evaluations, and reports.
4. Clean empty state for new accounts (0 evaluations, N/A scores, welcoming message).
5. Cross-user isolation: User A cannot read or download User B evaluations.
6. Downloads restricted strictly to authenticated users with user-specific data.
"""

import io
import pytest
import openpyxl
from app import app
from services import db, firebase_service
import config


@pytest.fixture
def saas_client(tmp_path):
    """Create test client with fresh database and mock Firebase."""
    test_db = tmp_path / "test_saas_abstriq.db"
    orig_db = config.DATABASE_PATH
    config.DATABASE_PATH = test_db
    db.init_db(test_db)
    firebase_service.init_firebase()
    firebase_service.reset_mock_state()

    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

    config.DATABASE_PATH = orig_db


def test_public_endpoints_accessible_without_authentication(saas_client):
    """Criterion 1: Public visitors have access to landing, config, and static demonstration data."""
    # 1. Landing page / Root SPA
    r_root = saas_client.get("/")
    assert r_root.status_code == 200

    # 2. Public runtime config
    r_cfg = saas_client.get("/api/config")
    assert r_cfg.status_code == 200
    cfg_data = r_cfg.get_json()
    assert "rubric" in cfg_data
    assert "prompt_versions" in cfg_data

    # 3. Public static demonstration sample
    r_demo = saas_client.get("/api/demo/sample")
    assert r_demo.status_code == 200
    demo_data = r_demo.get_json()
    assert demo_data["success"] is True
    assert demo_data["evaluation"]["total_score"] == 18
    assert "explanations" in demo_data["evaluation"]

    # 4. Public demo evaluation (mock heuristic, never stored)
    abstract = (
        "We investigate reinforcement learning algorithms for autonomous multi-rotor stabilization "
        "under turbulent aerodynamic conditions with 50 flight trials. "
        "Our neural flight controller incorporates an adaptive temporal convolution network to process "
        "proprioceptive sensor telemetry at 200 Hz. "
        "Empirical benchmarks demonstrate a 34% reduction in root-mean-square tracking error and a 2.1x "
        "speedup in gust recovery latency relative to conventional proportional-integral-derivative baselines. "
        "These results confirm that deep reinforcement learning can be successfully deployed for real-time "
        "micro-aerial vehicle navigation without external optical tracking infrastructure."
    )
    r_demo_eval = saas_client.post("/api/demo/evaluate", json={
        "abstract": abstract,
        "title": "Public Demonstration Evaluation",
    })
    assert r_demo_eval.status_code == 200
    eval_res = r_demo_eval.get_json()
    assert eval_res["success"] is True
    assert eval_res["is_demo"] is True
    assert "disclaimer" in eval_res


def test_private_endpoints_strictly_blocked_without_authentication(saas_client):
    """Criterion 2-6: Unauthenticated visitors cannot access private workspace features."""
    endpoints = [
        ("POST", "/api/evaluate", {"abstract": "Some abstract text."}),
        ("GET", "/api/history", None),
        ("GET", "/api/history/eval_fake_id_123", None),
        ("GET", "/api/dashboard/stats", None),
        ("GET", "/download", None),
        ("GET", "/api/download", None),
        ("GET", "/api/search?query=neural", None),
        ("POST", "/api/upload", None),
        ("POST", "/api/test-key", {"provider": "mock"}),
        ("GET", "/api/reports", None),
        ("GET", "/api/user/custom-key", None),
        ("POST", "/api/user/custom-key", {"provider": "openai", "api_key": "sk-123"}),
        ("DELETE", "/api/user/custom-key", None),
    ]

    for method, path, body in endpoints:
        if method == "POST":
            resp = saas_client.post(path, json=body or {})
        elif method == "DELETE":
            resp = saas_client.delete(path)
        else:
            resp = saas_client.get(path)

        assert resp.status_code == 401, f"Expected 401 for unauthenticated {method} {path}, got {resp.status_code}"


def test_new_user_clean_workspace_and_empty_state(saas_client):
    """Criterion 10: New accounts receive clean personal workspace with N/A scores and 0 evaluations."""
    # Register new user
    signup_res = saas_client.post("/api/auth/signup", json={
        "email": "dr_newton@oxford.ac.uk",
        "username": "newton",
        "password": "SecurePassword99!",
        "full_name": "Isaac Newton",
        "institution": "Cambridge",
    }).get_json()
    token = signup_res["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch dashboard stats for new account
    stats_resp = saas_client.get("/api/dashboard/stats", headers=headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.get_json()["stats"]

    # Verify clean empty state values
    assert stats["total_evaluations"] == 0
    assert stats["average_score"] == "N/A"
    assert stats["pass_rate"] == "N/A"
    assert stats["is_empty"] is True
    assert "welcome_message" in stats
    assert len(stats["recent_evaluations"]) == 0

    # Verify evaluation history is empty for new user (does not leak legacy records)
    hist_resp = saas_client.get("/api/history", headers=headers)
    assert hist_resp.status_code == 200
    assert len(hist_resp.get_json()["history"]) == 0


def test_authenticated_evaluation_and_excel_download(saas_client, monkeypatch):
    """Criterion 8 & 9: Authenticated user can run evaluations and download private Excel report."""
    monkeypatch.setattr(config, "LLM_PROVIDER", "mock")

    # Register user
    signup_res = saas_client.post("/api/auth/signup", json={
        "email": "ada@babbage.org",
        "username": "ada",
        "password": "AnalyticalEngine1843!",
    }).get_json()
    token = signup_res["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Run private evaluation
    abstract = (
        "Transformer language models suffer from high latency during autoregressive sequence decoding. "
        "In this paper, we propose SparseFlash, an efficient attention mechanism that leverages dynamic block "
        "sparsification to retain salient key-value states while discarding redundant tokens. "
        "We evaluate SparseFlash across 16 tasks in LongBench benchmark on sequence lengths up to 64k tokens. "
        "Our experiments demonstrate that SparseFlash achieves a 4.2x speedup and reduces peak memory by 68% "
        "compared to FlashAttention-2 baseline, retaining 98.4% of full-attention task accuracy."
    )
    eval_resp = saas_client.post("/api/evaluate", headers=headers, json={
        "abstract": abstract,
        "title": "Notes on the Analytical Engine",
        "source": "paste",
    })
    assert eval_resp.status_code == 200
    eval_data = eval_resp.get_json()
    assert eval_data["success"] is True
    assert eval_data["total_score"] >= 10
    eval_id = eval_data.get("firestore_id") or eval_data.get("run_id")

    # History now includes Ada's evaluation
    hist_resp = saas_client.get("/api/history", headers=headers)
    assert hist_resp.status_code == 200
    hist = hist_resp.get_json()["history"]
    assert len(hist) == 1
    assert hist[0]["title"] == "Notes on the Analytical Engine"

    # Download user's private Excel report
    down_resp = saas_client.get("/download", headers=headers)
    assert down_resp.status_code == 200
    assert down_resp.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    # Verify workbook content
    wb = openpyxl.load_workbook(io.BytesIO(down_resp.data))
    assert "evaluations" in wb.sheetnames
    ws = wb["evaluations"]
    assert ws.cell(row=2, column=4).value == "Notes on the Analytical Engine"


def test_strict_cross_user_data_isolation(saas_client, monkeypatch):
    """Criterion 9: User A and User B cannot access each other's evaluations or reports."""
    monkeypatch.setattr(config, "LLM_PROVIDER", "mock")

    # Register User A
    user_a = saas_client.post("/api/auth/signup", json={
        "email": "user_a@lab.edu", "username": "user_a", "password": "Password123!",
    }).get_json()
    token_a = user_a["token"]

    # Register User B
    user_b = saas_client.post("/api/auth/signup", json={
        "email": "user_b@lab.edu", "username": "user_b", "password": "Password123!",
    }).get_json()
    token_b = user_b["token"]

    # User A runs evaluation
    abstract = (
        "This study measures quantum superposition decoherence in superconducting transmon qubits. "
        "We implement dynamic decoupling pulse sequences across 1000 cryostat experiments. "
        "The coherence lifetime increases by 4.2x from 45 microseconds to 189 microseconds. "
        "These results demonstrate practical fidelity enhancements for fault-tolerant quantum logic."
    )
    eval_a = saas_client.post("/api/evaluate", headers={"Authorization": f"Bearer {token_a}"}, json={
        "abstract": abstract,
        "title": "User A Private Quantum Paper",
    }).get_json()
    eval_id_a = eval_a.get("firestore_id")

    # User B attempts to access User A's evaluation ID directly
    unauth_attempt = saas_client.get(f"/api/history/{eval_id_a}", headers={"Authorization": f"Bearer {token_b}"})
    assert unauth_attempt.status_code == 404, "User B must NOT be able to view User A evaluation"

    # User B's history must NOT contain User A's evaluation
    hist_b = saas_client.get("/api/history", headers={"Authorization": f"Bearer {token_b}"}).get_json()["history"]
    assert len(hist_b) == 0
