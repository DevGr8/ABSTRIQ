"""
app.py
======
Flask backend for the Research Abstract Evaluator web application.

Routes:
  GET  /              - Main single-page web UI
  GET  /api/config    - Active provider, model, MOCK flag, prompt versions, rubric info
  POST /api/evaluate  - Evaluate abstract through 5-stage pipeline
  GET  /api/search    - Search OpenAlex or arXiv for papers and abstracts
  POST /api/upload    - Upload PDF or TXT to extract abstract
  GET  /api/history   - Fetch past evaluations from Excel
  GET  /download      - Download results.xlsx workbook
"""

import io
import logging
import os
from functools import wraps
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_file, send_from_directory, g
from werkzeug.exceptions import RequestEntityTooLarge

import config
import llm
from services import evaluator
from services import extractor
from services import search
from services import storage
from services import db
from services import firebase_service
from services import demo_data

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# 15 MB file upload limit
app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD_SIZE_BYTES
app.config["SECRET_KEY"] = config.SECRET_KEY

# Initialize database tables, Firebase SDK, and legacy migrations
db.init_db()
firebase_service.init_firebase()


# ---------------------------------------------------------------------------
# Global CORS Support (for decoupled Vercel Frontend <-> Backend deployment)
# ---------------------------------------------------------------------------
@app.before_request
def handle_options_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, X-Requested-With"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, X-Requested-With"
    return response


# ---------------------------------------------------------------------------
# Authentication Middleware
# ---------------------------------------------------------------------------
def get_current_user():
    """Extract authenticated user from Authorization Bearer token or cookie."""
    token = ""
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "token" in request.args:
        token = request.args.get("token", "").strip()
    elif "abstriq_session" in request.cookies:
        token = request.cookies.get("abstriq_session", "").strip()

    if not token:
        return None

    # 1. Primary: If token is a JWT (2 dots) or test/firebase token, verify via Firebase Admin
    if token.count(".") == 2 or token.startswith("test_token_") or token.startswith("fb_"):
        verified = firebase_service.verify_firebase_id_token(token)
        if verified:
            uid = verified["uid"]
            user_doc = firebase_service.get_or_create_user(
                uid=uid,
                email=verified.get("email", ""),
                display_name=verified.get("name", ""),
            )
            if "id" not in user_doc:
                user_doc["id"] = user_doc["uid"]
            if "username" not in user_doc:
                user_doc["username"] = user_doc.get("displayName") or uid
            return user_doc

    # 2. Local database session tokens
    legacy_user = db.get_session_user(token)
    if legacy_user:
        legacy_user["uid"] = f"usr_{legacy_user['id']}"
        return legacy_user

    return None



def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({
                "success": False,
                "error": "Authentication required. Please sign in or register to access this resource.",
            }), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        g.current_user = get_current_user()
        return f(*args, **kwargs)
    return decorated


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    return jsonify({
        "success": False,
        "error": f"Uploaded file exceeds the maximum allowed size of {config.MAX_UPLOAD_SIZE_MB} MB.",
    }), 413


@app.errorhandler(Exception)
def handle_unexpected_error(e):
    logger.error(f"Unhandled server error: {e}", exc_info=True)
    return jsonify({
        "success": False,
        "error": f"Internal server error: {str(e)}",
    }), 500


# ---------------------------------------------------------------------------
# Frontend Route (Serves React 19 SPA from frontend/dist if built, else template)
# ---------------------------------------------------------------------------
FRONTEND_DIST = Path(__file__).resolve().parent / "frontend" / "dist"


@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def index(path):
    """Serve the single-page application."""
    if path.startswith("api/") or path == "download":
        return jsonify({"error": "Endpoint not found"}), 404

    if FRONTEND_DIST.exists():
        target_file = FRONTEND_DIST / path
        if path and target_file.exists() and not target_file.is_dir():
            return send_from_directory(FRONTEND_DIST, path)
        return send_from_directory(FRONTEND_DIST, "index.html")

    return render_template("index.html")


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
@app.route("/api/config", methods=["GET"])
def get_config():
    """Return runtime configuration for frontend status and settings."""
    is_mock = config.LLM_PROVIDER == "mock" or not config.LLM_API_KEY
    active_model = config.LLM_MODEL or config.DEFAULT_MODELS.get(config.LLM_PROVIDER, "unknown")

    return jsonify({
        "provider": config.LLM_PROVIDER,
        "model": active_model,
        "is_mock": is_mock,
        "prompt_versions": ["score_v3", "score_v2", "score_v1"],
        "default_prompt": "score_v3",
        "low_score_threshold": config.LOW_SCORE_THRESHOLD,
        "max_upload_mb": config.MAX_UPLOAD_SIZE_MB,
        "rubric": config.RUBRIC,
    })


# ---------------------------------------------------------------------------
# Authentication Endpoints
# ---------------------------------------------------------------------------
@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    """
    POST /api/auth/signup
    Body: {email, username, password, full_name, institution}
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    username = data.get("username", "")
    password = data.get("password", "")
    full_name = data.get("full_name", "")
    institution = data.get("institution", "")

    ok, user, msg = db.create_user(email, username, password, full_name, institution)
    if not ok:
        return jsonify({"success": False, "error": msg}), 400

    user_agent = request.headers.get("User-Agent", "")
    ip_addr = request.remote_addr or ""
    token = db.create_session(user["id"], user_agent=user_agent, ip_address=ip_addr)

    resp = jsonify({
        "success": True,
        "message": msg,
        "user": user,
        "token": token,
    })
    resp.set_cookie("abstriq_session", token, httponly=True, samesite="Lax", max_age=config.SESSION_EXPIRE_DAYS * 86400)
    return resp, 201


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """
    POST /api/auth/login
    Body: {identifier, password} (identifier = email or username)
    """
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier") or data.get("email") or data.get("username") or ""
    password = data.get("password", "")

    ok, user, msg = db.authenticate_user(identifier, password)
    if not ok:
        return jsonify({"success": False, "error": msg}), 401

    user_agent = request.headers.get("User-Agent", "")
    ip_addr = request.remote_addr or ""
    token = db.create_session(user["id"], user_agent=user_agent, ip_address=ip_addr)

    resp = jsonify({
        "success": True,
        "message": msg,
        "user": user,
        "token": token,
    })
    resp.set_cookie("abstriq_session", token, httponly=True, samesite="Lax", max_age=config.SESSION_EXPIRE_DAYS * 86400)
    return resp, 200


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    """
    POST /api/auth/logout
    Revokes the current session token.
    """
    auth_header = request.headers.get("Authorization", "").strip()
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "abstriq_session" in request.cookies:
        token = request.cookies.get("abstriq_session", "").strip()

    if token:
        db.revoke_session(token)

    resp = jsonify({"success": True, "message": "Successfully logged out."})
    resp.delete_cookie("abstriq_session")
    return resp, 200


@app.route("/api/auth/me", methods=["GET"])
@auth_required
def auth_me():
    """
    GET /api/auth/me
    Returns current authenticated user profile.
    """
    return jsonify({
        "success": True,
        "user": g.current_user,
    }), 200


@app.route("/api/auth/profile", methods=["PUT"])
@auth_required
def auth_update_profile():
    """
    PUT /api/auth/profile
    Body: {full_name, institution}
    """
    data = request.get_json(silent=True) or {}
    full_name = data.get("full_name")
    institution = data.get("institution")

    ok, user, msg = db.update_user_profile(g.current_user["id"], full_name=full_name, institution=institution)
    if not ok:
        return jsonify({"success": False, "error": msg}), 400

    return jsonify({"success": True, "message": msg, "user": user}), 200


@app.route("/api/auth/password", methods=["PUT"])
@auth_required
def auth_update_password():
    """
    PUT /api/auth/password
    Body: {current_password, new_password}
    """
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    ok, msg = db.change_user_password(g.current_user["id"], current_password, new_password)
    if not ok:
        return jsonify({"success": False, "error": msg}), 400

    return jsonify({"success": True, "message": msg}), 200


@app.route("/api/auth/forgot-password", methods=["POST"])
def auth_forgot_password():
    """
    POST /api/auth/forgot-password
    Body: {email}
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    if not email:
        return jsonify({"success": False, "error": "Email address is required."}), 400

    ok, token, msg = db.create_password_reset_token(email)
    return jsonify({
        "success": True,
        "message": msg,
        "reset_token": token,
    }), 200


@app.route("/api/auth/reset-password", methods=["POST"])
def auth_reset_password():
    """
    POST /api/auth/reset-password
    Body: {token, new_password}
    """
    data = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()
    new_password = data.get("new_password", "")

    ok, msg = db.reset_password_with_token(token, new_password)
    if not ok:
        return jsonify({"success": False, "error": msg}), 400

    return jsonify({"success": True, "message": msg}), 200


# ---------------------------------------------------------------------------
# Encrypted Custom API Key Management (User-Isolated)
# ---------------------------------------------------------------------------
@app.route("/api/user/custom-key", methods=["GET"])
@auth_required
def get_user_custom_key():
    """
    GET /api/user/custom-key
    Returns masked credentials for the authenticated user.
    """
    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    key_info = firebase_service.get_api_configuration(uid, decrypt=False)
    if not key_info:
        key_info = db.get_user_api_key(user["id"], decrypt=False)

    if not key_info:
        return jsonify({
            "success": True,
            "has_custom_key": False,
            "custom_key": None,
        }), 200

    return jsonify({
        "success": True,
        "has_custom_key": True,
        "custom_key": key_info,
    }), 200


@app.route("/api/user/custom-key", methods=["POST"])
@auth_required
def set_user_custom_key():
    """
    POST /api/user/custom-key
    Body: {provider, model, api_key}
    Securely encrypts and stores the key in Firestore users/{uid}/apiConfigurations/.
    """
    data = request.get_json(silent=True) or {}
    provider = (data.get("provider") or "").strip().lower()
    model = (data.get("model") or "").strip()
    api_key = (data.get("api_key") or "").strip()

    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    try:
        firebase_service.save_api_configuration(uid, provider, model, api_key)
    except Exception as e:
        logger.warning(f"Firestore API key save note: {e}")

    ok, msg = db.save_user_api_key(user["id"], provider, model, api_key)
    if not ok:
        return jsonify({"success": False, "error": msg}), 400

    key_info = firebase_service.get_api_configuration(uid, decrypt=False)
    if not key_info:
        key_info = db.get_user_api_key(user["id"], decrypt=False)

    return jsonify({
        "success": True,
        "message": msg,
        "custom_key": key_info,
    }), 200


@app.route("/api/user/custom-key", methods=["DELETE"])
@auth_required
def delete_user_custom_key():
    """
    DELETE /api/user/custom-key
    Deletes the encrypted key for authenticated user from Firestore and SQLite.
    """
    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    firebase_service.delete_api_configuration(uid)
    db.delete_user_api_key(user["id"])
    return jsonify({
        "success": True,
        "message": "Custom credentials removed. Reverted to server defaults.",
    }), 200


@app.route("/api/evaluate", methods=["POST"])
@auth_required
def evaluate():
    """
    POST /api/evaluate
    Body JSON:
      {
        "abstract": str,
        "title": Optional[str],
        "source": Optional[str],
        "prompt_version": Optional[str],
        "provider": Optional[str],
        "model": Optional[str],
        "api_key": Optional[str]
      }
    Evaluates abstract and stores result in Firestore users/{uid}/evaluations/.
    Protected endpoint: Requires valid Firebase Bearer token.
    """
    data = request.get_json(silent=True) or {}
    abstract = data.get("abstract", "").strip()
    title = data.get("title", "").strip()
    source = data.get("source", "paste").strip()
    prompt_version = data.get("prompt_version", "score_v3").strip()
    provider_override = (data.get("provider") or "").strip().lower() or None
    model_override = (data.get("model") or "").strip() or None
    api_key_override = (data.get("api_key") or "").strip() or None

    user = g.current_user
    user_id = user.get("id")
    uid = user.get("uid") or str(user_id)
    # If user has an encrypted API key saved and did not supply per-request key override,
    # decrypt and apply their saved key
    if not api_key_override and not provider_override:
        saved_key = firebase_service.get_api_configuration(uid, decrypt=True)
        if not saved_key and user_id:
            saved_key = db.get_user_api_key(user_id, decrypt=True)
        if saved_key:
            provider_override = saved_key.get("provider")
            model_override = saved_key.get("model")
            api_key_override = saved_key.get("api_key")

    if not abstract:
        return jsonify({
            "success": False,
            "error": "The abstract text cannot be empty.",
        }), 400

    result = evaluator.evaluate_abstract(
        abstract=abstract,
        title=title,
        source=source,
        prompt_version=prompt_version,
        provider_override=provider_override,
        model_override=model_override,
        api_key_override=api_key_override,
        user_id=user_id,
    )

    if not result.get("success"):
        return jsonify(result), 400

    # Store in Firestore under users/{uid}/evaluations/{evaluationId}
    if uid:
        try:
            firestore_record = firebase_service.save_evaluation(uid, result)
            result["firestore_id"] = firestore_record.get("evaluationId")
        except Exception as e:
            logger.warning(f"Firestore evaluation persistence note: {e}")

    return jsonify(result), 200


@app.route("/api/test-key", methods=["POST"])
@auth_required
def test_key():
    """
    POST /api/test-key
    Body JSON:
      {
        "provider": str,
        "api_key": Optional[str],
        "model": Optional[str],
        "use_saved": Optional[bool]
      }
    Validates user credentials against live LLM endpoint.
    """
    data = request.get_json(silent=True) or {}
    provider = (data.get("provider") or "").strip().lower()
    api_key = (data.get("api_key") or "").strip()
    model = (data.get("model") or "").strip() or None
    use_saved = bool(data.get("use_saved", False))

    if use_saved and getattr(g, "current_user", None):
        saved = db.get_user_api_key(g.current_user["id"], decrypt=True)
        if saved:
            provider = saved.get("provider", provider)
            model = model or saved.get("model")
            api_key = saved.get("api_key", "")

    if not provider:
        return jsonify({"success": False, "error": "Provider must be specified."}), 400

    if provider != "mock" and not api_key:
        return jsonify({"success": False, "error": "API key cannot be empty for live providers."}), 400

    try:
        res = llm.call_llm(
            system="You are an API connection tester.",
            user="Connection test. Reply with 'OK'.",
            provider=provider,
            model=model,
            api_key=api_key,
        )
        if res.get("is_mock") and provider != "mock":
            return jsonify({
                "success": False,
                "error": res.get("fallback_error") or f"Credentials for '{provider}' failed authentication.",
            }), 400

        return jsonify({
            "success": True,
            "provider": res.get("provider"),
            "model": res.get("model"),
            "latency_s": res.get("latency_s"),
            "message": f"Connection verified! {res.get('provider').upper()} ({res.get('model')}) responded in {res.get('latency_s')}s.",
        }), 200
    except Exception as e:
        logger.warning(f"Key test error for {provider}: {e}")
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/search", methods=["GET"])
@auth_required
def search_papers():
    """
    GET /api/search?query=...&source=openalex|arxiv
    Protected endpoint: Requires valid Firebase Bearer token.
    """
    query = request.args.get("query", "").strip()
    source_name = request.args.get("source", "openalex").strip().lower()

    if not query:
        return jsonify({"results": []}), 200

    if source_name == "arxiv":
        results = search.search_arxiv(query, limit=10)
    else:
        results = search.search_openalex(query, limit=10)

    return jsonify({"results": results}), 200


@app.route("/api/upload", methods=["POST"])
@auth_required
def upload_file():
    """
    POST /api/upload
    Form-data: file (PDF or TXT)
    Protected endpoint: Requires valid Firebase Bearer token.
    """
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file attached in upload request.",
        }), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({
            "success": False,
            "error": "Empty filename provided.",
        }), 400

    filename = uploaded.filename.lower()
    content_bytes = uploaded.read()

    if len(content_bytes) == 0:
        return jsonify({
            "success": False,
            "error": "The uploaded file is empty.",
        }), 400

    if filename.endswith(".pdf"):
        title, abstract = extractor.extract_from_pdf(content_bytes)
    elif filename.endswith((".txt", ".md")):
        try:
            text = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = content_bytes.decode("latin-1", errors="replace")
        title, abstract = extractor.extract_from_txt(text)
    else:
        return jsonify({
            "success": False,
            "error": "Unsupported file format. Please upload a .pdf or .txt file.",
        }), 400

    if not abstract:
        return jsonify({
            "success": False,
            "error": (
                "Could not locate an 'Abstract' section within the first 2 pages of the document. "
                "Please verify that the document contains an 'Abstract' heading or paste the text directly."
            ),
        }), 422

    return jsonify({
        "success": True,
        "title": title or "",
        "abstract": abstract,
        "word_count": len(abstract.split()),
        "filename": uploaded.filename,
    }), 200


@app.route("/api/demo/sample", methods=["GET"])
def get_demo_sample():
    """
    GET /api/demo/sample
    Public demonstration endpoint: returns non-sensitive static sample abstract,
    rubric evaluation result, verbatim evidence quotes, and suggestions.
    No authentication required. Never writes to user accounts or Firestore.
    """
    return jsonify({
        "success": True,
        "title": demo_data.SAMPLE_DEMO_TITLE,
        "abstract": demo_data.SAMPLE_DEMO_ABSTRACT,
        "evaluation": demo_data.SAMPLE_DEMO_RESULT,
    }), 200


@app.route("/api/demo/evaluate", methods=["POST"])
def demo_evaluate():
    """
    POST /api/demo/evaluate
    Public demonstration evaluator:
    Rate-limited, restricted to 350 words. Evaluates using mock heuristic for visitors.
    NEVER writes to database or Firestore.
    """
    data = request.get_json(silent=True) or {}
    abstract = (data.get("abstract") or "").strip()
    title = (data.get("title") or "Public Demo Abstract").strip()

    if not abstract:
        return jsonify({"success": False, "error": "Abstract text cannot be empty."}), 400

    words = abstract.split()
    if len(words) > 350:
        return jsonify({
            "success": False,
            "error": "Demo mode is limited to 350 words. Please create a free account for unrestricted evaluations."
        }), 400

    result = evaluator.evaluate_abstract(
        abstract=abstract,
        title=title,
        source="demo",
        provider_override="mock",
        model_override="demo-heuristic",
        user_id=None,
    )
    result["is_demo"] = True
    result["disclaimer"] = "Public demo mode. No records were saved to any user workspace."
    return jsonify(result), 200


@app.route("/api/history", methods=["GET"])
@auth_required
def get_history():
    """
    GET /api/history
    Return list of evaluations.
    Strictly user-isolated when authenticated via Firestore users/{uid}/evaluations/.
    Protected endpoint: Requires valid Firebase Bearer token.
    """
    limit = int(request.args.get("limit", 50))
    user = g.current_user
    uid = user.get("uid") or str(user.get("id"))

    records = firebase_service.get_user_evaluations(uid, limit=limit)
    if records:
        formatted = []
        for r in records:
            scores = r.get("individualCriteriaScores") or {}
            formatted.append({
                "id": r.get("evaluationId"),
                "title": r.get("researchTitle") or "Untitled Abstract",
                "total": r.get("totalScore", 0),
                "created_at": r.get("createdAt") or "",
                "provider": r.get("provider") or "",
                "model": r.get("model") or "",
                "source": (r.get("metadata") or {}).get("source", "paste"),
                "c1_clarity": scores.get("clarity", 0),
                "c2_problem": scores.get("problem_statement", 0),
                "c3_methodology": scores.get("methodology", 0),
                "c4_results": scores.get("results_evidence", 0),
                "c5_implications": scores.get("significance_implications", 0),
                "status": r.get("evaluationStatus", "completed"),
            })
        return jsonify({"history": formatted}), 200

    # Fallback to local DB for this user
    if user.get("id"):
        db_history = db.get_evaluations_history(user_id=user["id"], include_legacy=False, limit=limit)
        if db_history:
            return jsonify({"history": db_history}), 200

    return jsonify({"history": []}), 200


@app.route("/api/history/<evaluation_id>", methods=["GET"])
@auth_required
def get_history_detail(evaluation_id):
    """
    GET /api/history/<evaluation_id>
    Retrieve single evaluation with strict UID ownership check in Firestore.
    """
    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    record = firebase_service.get_user_evaluation_by_id(uid, evaluation_id)
    if not record:
        return jsonify({
            "success": False,
            "error": "Evaluation record not found or access denied.",
        }), 404
    return jsonify({"success": True, "evaluation": record}), 200


@app.route("/api/dashboard/stats", methods=["GET"])
@auth_required
def get_dashboard_stats():
    """
    GET /api/dashboard/stats
    Returns live statistics computed strictly from user's Firestore evaluations.
    Protected endpoint: Requires valid Firebase Bearer token.
    """
    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    stats = firebase_service.get_user_dashboard_stats(uid)
    return jsonify({"success": True, "stats": stats}), 200


@app.route("/download", methods=["GET"])
@app.route("/api/download", methods=["GET"])
@auth_required
def download_results():
    """
    GET /download or /api/download
    Generates a dynamic 3-sheet Excel report filtered strictly by authenticated UID.
    Protected endpoint: Requires valid Firebase Bearer token.
    Unauthenticated downloads are strictly prohibited.
    """
    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    data = firebase_service.generate_user_excel_bytes(uid)
    filename = f"abstriq_report_{uid[:8]}.xlsx"
    return send_file(
        io.BytesIO(data),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


@app.route("/api/reports", methods=["GET"])
@auth_required
def list_reports():
    """List persistent reports created for the authenticated user."""
    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    reports = firebase_service.get_user_reports(uid)
    return jsonify({"success": True, "reports": reports}), 200


@app.route("/api/reports/generate", methods=["POST"])
@auth_required
def generate_report():
    """Generate and record a report in users/{uid}/reports/{reportId}."""
    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    data = request.get_json(silent=True) or {}
    report_type = data.get("report_type", "excel")
    record = firebase_service.create_report_record(uid, report_type=report_type)
    return jsonify({"success": True, "report": record}), 201


@app.route("/api/reports/<report_id>", methods=["GET"])
@auth_required
def get_report(report_id):
    """Retrieve details of a report record."""
    user = g.current_user
    uid = user.get("uid") or str(user["id"])
    record = firebase_service.get_user_report_by_id(uid, report_id)
    if not record:
        return jsonify({"success": False, "error": "Report not found or access denied."}), 404
    return jsonify({"success": True, "report": record}), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    logger.info(f"Starting Research Abstract Evaluator on http://localhost:{port}")
    logger.info(f"Active LLM Provider: {config.LLM_PROVIDER} (Mock: {config.LLM_PROVIDER == 'mock'})")
    app.run(host="0.0.0.0", port=port, debug=False)
