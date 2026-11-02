"""
services/db.py
==============
SQLite database service providing:
  1. User authentication & account management (with scrypt password hashing).
  2. Cryptographically secure stateful session management.
  3. Password reset token lifecycle.
  4. Encrypted at-rest storage for user custom API keys (per-user Fernet derivation).
  5. User-isolated evaluation history persistence.
"""

import base64
import hashlib
import hmac
import json
import logging
import re
import secrets
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from cryptography.fernet import Fernet
from werkzeug.security import generate_password_hash, check_password_hash

import config

logger = logging.getLogger(__name__)


def get_db_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Return a configured sqlite3 connection with Row factory."""
    path = db_path or config.DATABASE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Optional[Path] = None):
    """Initialize database tables, indexes, and migrate legacy Excel evaluations if needed."""
    conn = get_db_connection(db_path)
    with conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT DEFAULT '',
                institution TEXT DEFAULT '',
                role TEXT DEFAULT 'researcher',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                reset_token TEXT,
                reset_token_expires_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                user_agent TEXT DEFAULT '',
                ip_address TEXT DEFAULT '',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

            CREATE TABLE IF NOT EXISTS user_api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evaluations (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                timestamp TEXT NOT NULL,
                source TEXT DEFAULT 'manual',
                title TEXT DEFAULT 'Untitled Paper',
                prompt_version TEXT DEFAULT 'score_v3',
                model TEXT DEFAULT '',
                status TEXT DEFAULT 'completed',
                word_count INTEGER DEFAULT 0,
                score_purpose INTEGER DEFAULT 0,
                score_method INTEGER DEFAULT 0,
                score_results INTEGER DEFAULT 0,
                score_conclusion INTEGER DEFAULT 0,
                score_clarity INTEGER DEFAULT 0,
                total INTEGER DEFAULT 0,
                warnings TEXT DEFAULT 'none',
                suggestions_json TEXT DEFAULT '[]',
                seconds REAL DEFAULT 0.0,
                abstract TEXT DEFAULT '',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON evaluations(user_id);
            CREATE INDEX IF NOT EXISTS idx_evaluations_timestamp ON evaluations(timestamp DESC);
        """)

    # Check if we should backfill legacy records from results.xlsx
    _backfill_legacy_excel(conn)
    conn.close()
    logger.info("Database initialized successfully at %s", config.DATABASE_PATH)


def _backfill_legacy_excel(conn: sqlite3.Connection):
    """If evaluations table is empty and results.xlsx exists, import legacy records."""
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM evaluations;")
        count = cur.fetchone()[0]
        if count > 0:
            return

        excel_path = config.RESULTS_FILE
        if not excel_path.exists():
            return

        import openpyxl
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        if "evaluations" not in wb.sheetnames:
            return

        ws = wb["evaluations"]
        headers = [cell.value for cell in ws[1] if cell.value is not None]
        if not headers or "id" not in headers:
            return

        rows_to_insert = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not any(row):
                continue
            rec = dict(zip(headers, row))
            run_id = rec.get("id")
            if not run_id:
                continue

            suggestions = rec.get("suggestions_json") or "[]"
            if not isinstance(suggestions, str):
                try:
                    suggestions = json.dumps(suggestions)
                except Exception:
                    suggestions = "[]"

            rows_to_insert.append((
                str(run_id),
                None,  # legacy runs have no user_id
                str(rec.get("timestamp") or datetime.now(timezone.utc).isoformat()),
                str(rec.get("source") or "legacy"),
                str(rec.get("title") or "Untitled Paper"),
                str(rec.get("prompt_version") or "score_v3"),
                str(rec.get("model") or ""),
                str(rec.get("status") or "completed"),
                int(rec.get("word_count") or 0),
                int(rec.get("score_purpose") or 0),
                int(rec.get("score_method") or 0),
                int(rec.get("score_results") or 0),
                int(rec.get("score_conclusion") or 0),
                int(rec.get("score_clarity") or 0),
                int(rec.get("total") or 0),
                str(rec.get("warnings") or "none"),
                suggestions,
                float(rec.get("seconds") or 0.0),
                str(rec.get("abstract") or ""),
            ))

        if rows_to_insert:
            cur.executemany("""
                INSERT OR IGNORE INTO evaluations (
                    id, user_id, timestamp, source, title, prompt_version, model,
                    status, word_count, score_purpose, score_method, score_results,
                    score_conclusion, score_clarity, total, warnings, suggestions_json,
                    seconds, abstract
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, rows_to_insert)
            conn.commit()
            logger.info("Migrated %d legacy evaluations from Excel to SQLite.", len(rows_to_insert))
    except Exception as e:
        logger.warning("Could not backfill legacy records from Excel: %s", e)


# ---------------------------------------------------------------------------
# Encryption Helper for User Custom API Keys
# ---------------------------------------------------------------------------
def _get_fernet_cipher(user_id: int) -> Fernet:
    """
    Derive a user-specific 32-byte encryption key using HMAC-SHA256
    over config.SECRET_KEY and user_id.
    """
    h = hmac.new(
        config.SECRET_KEY.encode("utf-8"),
        f"abstriq-user-key-salt-{user_id}".encode("utf-8"),
        hashlib.sha256
    ).digest()
    url_safe_key = base64.urlsafe_b64encode(h)
    return Fernet(url_safe_key)


def mask_api_key(key: str) -> str:
    """Mask an API key for safe display (e.g. sk-1234...9876). Never exposes full key."""
    if not key:
        return ""
    if len(key) <= 8:
        return "********"
    return f"{key[:4]}...{key[-4:]}"


# ---------------------------------------------------------------------------
# User Authentication & Management
# ---------------------------------------------------------------------------
def create_user(
    email: str,
    username: str,
    password: str,
    full_name: str = "",
    institution: str = "",
    db_path: Optional[Path] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """
    Register a new user account with scrypt password hashing.
    Returns (success, user_dict, message).
    """
    email = email.strip().lower()
    username = username.strip().lower()
    full_name = full_name.strip()
    institution = institution.strip()

    if not email or "@" not in email or "." not in email:
        return False, None, "A valid email address is required."

    if not username or len(username) < 3 or not re.match(r"^[a-zA-Z0-9_\-\.]+$", username):
        return False, None, "Username must be at least 3 characters and alphanumeric (letters, numbers, ., _, -)."

    if not password or len(password) < 6:
        return False, None, "Password must be at least 6 characters long."

    now_iso = datetime.now(timezone.utc).isoformat()
    pwd_hash = generate_password_hash(password, method="pbkdf2:sha256")

    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO users (email, username, password_hash, full_name, institution, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'researcher', ?, ?)
            """,
            (email, username, pwd_hash, full_name, institution, now_iso, now_iso),
        )
        conn.commit()
        user_id = cur.lastrowid
        user = {
            "id": user_id,
            "email": email,
            "username": username,
            "full_name": full_name,
            "institution": institution,
            "role": "researcher",
            "created_at": now_iso,
        }
        return True, user, "Account created successfully."
    except sqlite3.IntegrityError as e:
        msg = str(e).lower()
        if "email" in msg:
            return False, None, "An account with this email address already exists."
        elif "username" in msg:
            return False, None, "This username is already taken."
        return False, None, "User with this email or username already exists."
    finally:
        conn.close()


def authenticate_user(
    identifier: str,
    password: str,
    db_path: Optional[Path] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """
    Authenticate user by username or email and password.
    Returns (success, user_dict, message).
    """
    ident = identifier.strip().lower()
    if not ident or not password:
        return False, None, "Username/email and password are required."

    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, email, username, password_hash, full_name, institution, role, created_at
            FROM users
            WHERE email = ? OR username = ?
            """,
            (ident, ident),
        )
        row = cur.fetchone()
        if not row:
            return False, None, "Invalid email/username or password."

        if not check_password_hash(row["password_hash"], password):
            return False, None, "Invalid email/username or password."

        user = {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"],
            "full_name": row["full_name"],
            "institution": row["institution"],
            "role": row["role"],
            "created_at": row["created_at"],
        }
        return True, user, "Authentication successful."
    finally:
        conn.close()


def get_user_by_id(user_id: int, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Fetch user profile by user_id."""
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, email, username, full_name, institution, role, created_at
            FROM users WHERE id = ?
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def update_user_profile(
    user_id: int,
    full_name: Optional[str] = None,
    institution: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """Update user's profile details."""
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        now_iso = datetime.now(timezone.utc).isoformat()
        updates = ["updated_at = ?"]
        params = [now_iso]

        if full_name is not None:
            updates.append("full_name = ?")
            params.append(full_name.strip())
        if institution is not None:
            updates.append("institution = ?")
            params.append(institution.strip())

        params.append(user_id)
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

        user = get_user_by_id(user_id, db_path)
        return True, user, "Profile updated successfully."
    except Exception as e:
        return False, None, f"Failed to update profile: {e}"
    finally:
        conn.close()


def change_user_password(
    user_id: int,
    current_password: str,
    new_password: str,
    db_path: Optional[Path] = None,
) -> Tuple[bool, str]:
    """Change user password after verifying current password."""
    if not new_password or len(new_password) < 6:
        return False, "New password must be at least 6 characters long."

    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        if not row or not check_password_hash(row["password_hash"], current_password):
            return False, "Current password is incorrect."

        new_hash = generate_password_hash(new_password, method="pbkdf2:sha256")
        now_iso = datetime.now(timezone.utc).isoformat()
        cur.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", (new_hash, now_iso, user_id))
        conn.commit()
        return True, "Password updated successfully."
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Password Reset Lifecycle
# ---------------------------------------------------------------------------
def create_password_reset_token(
    email: str,
    db_path: Optional[Path] = None,
) -> Tuple[bool, Optional[str], str]:
    """
    Generate and store a secure single-use password reset token.
    Token expires in config.RESET_TOKEN_EXPIRE_MINUTES.
    """
    email = email.strip().lower()
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, username FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        if not row:
            # For security, avoid leaking whether the email exists
            return False, None, "If this email is registered, a password reset token has been generated."

        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=config.RESET_TOKEN_EXPIRE_MINUTES)).isoformat()

        cur.execute(
            "UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?",
            (token, expires_at, row["id"]),
        )
        conn.commit()
        logger.info("Password reset token generated for user %s (%s)", row["username"], email)
        return True, token, "Password reset token generated successfully."
    finally:
        conn.close()


def reset_password_with_token(
    token: str,
    new_password: str,
    db_path: Optional[Path] = None,
) -> Tuple[bool, str]:
    """Reset password using a valid, non-expired reset token."""
    if not token:
        return False, "Reset token is required."
    if not new_password or len(new_password) < 6:
        return False, "New password must be at least 6 characters long."

    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, email, reset_token_expires_at
            FROM users
            WHERE reset_token = ?
            """,
            (token.strip(),),
        )
        row = cur.fetchone()
        if not row:
            return False, "Invalid or expired reset token."

        expires_at_str = row["reset_token_expires_at"]
        if not expires_at_str:
            return False, "Invalid or expired reset token."

        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at < datetime.now(timezone.utc):
            return False, "Reset token has expired. Please request a new one."

        new_hash = generate_password_hash(new_password, method="pbkdf2:sha256")
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update password, clear token, and revoke active sessions
        cur.execute(
            """
            UPDATE users
            SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, updated_at = ?
            WHERE id = ?
            """,
            (new_hash, now_iso, row["id"]),
        )
        cur.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
        conn.commit()
        return True, "Password reset successful. You may now log in with your new password."
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Session Token Management
# ---------------------------------------------------------------------------
def create_session(
    user_id: int,
    user_agent: str = "",
    ip_address: str = "",
    db_path: Optional[Path] = None,
) -> str:
    """Create a persistent session token for user."""
    token = secrets.token_hex(32)
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=config.SESSION_EXPIRE_DAYS)).isoformat()
    now_iso = now.isoformat()

    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO sessions (user_id, token, created_at, expires_at, user_agent, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, token, now_iso, expires_at, user_agent[:255], ip_address[:64]),
        )
        conn.commit()
        return token
    finally:
        conn.close()


def get_session_user(
    token: str,
    db_path: Optional[Path] = None,
) -> Optional[Dict[str, Any]]:
    """Validate session token and return user profile if active and non-expired."""
    if not token:
        return None

    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id as session_id, s.token, s.expires_at,
                   u.id, u.email, u.username, u.full_name, u.institution, u.role, u.created_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
            """,
            (token.strip(),),
        )
        row = cur.fetchone()
        if not row:
            return None

        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at < datetime.now(timezone.utc):
            # Session expired, cleanup
            cur.execute("DELETE FROM sessions WHERE id = ?", (row["session_id"],))
            conn.commit()
            return None

        return {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"],
            "full_name": row["full_name"],
            "institution": row["institution"],
            "role": row["role"],
            "created_at": row["created_at"],
            "session_token": row["token"],
        }
    finally:
        conn.close()


def revoke_session(token: str, db_path: Optional[Path] = None) -> bool:
    """Revoke a session on logout."""
    if not token:
        return False
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE token = ?", (token.strip(),))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def revoke_all_user_sessions(user_id: int, db_path: Optional[Path] = None) -> int:
    """Revoke all active sessions for a user."""
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Encrypted User Custom API Keys
# ---------------------------------------------------------------------------
def save_user_api_key(
    user_id: int,
    provider: str,
    model: str,
    api_key: str,
    db_path: Optional[Path] = None,
) -> Tuple[bool, str]:
    """
    Encrypt the API key using a user-specific Fernet cipher and store in user_api_keys.
    Never stores plaintext API keys in the database.
    """
    provider = provider.strip().lower()
    model = model.strip()
    api_key = api_key.strip()

    if not provider:
        return False, "Provider must be specified."
    if provider != "mock" and not api_key:
        return False, "API key cannot be empty for live providers."

    cipher = _get_fernet_cipher(user_id)
    encrypted_key = cipher.encrypt(api_key.encode("utf-8")).decode("utf-8")
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO user_api_keys (user_id, provider, model, encrypted_key, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                provider = excluded.provider,
                model = excluded.model,
                encrypted_key = excluded.encrypted_key,
                updated_at = excluded.updated_at
            """,
            (user_id, provider, model, encrypted_key, now_iso, now_iso),
        )
        conn.commit()
        return True, "Custom API key securely encrypted and saved."
    except Exception as e:
        logger.error("Failed to save encrypted API key for user %s: %s", user_id, e)
        return False, f"Failed to save API key: {e}"
    finally:
        conn.close()


def get_user_api_key(
    user_id: int,
    decrypt: bool = False,
    db_path: Optional[Path] = None,
) -> Optional[Dict[str, Any]]:
    """
    Retrieve user's custom API key configuration.
    If decrypt is False, returns masked key only.
    If decrypt is True, decrypts with user-specific cipher.
    """
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT provider, model, encrypted_key, updated_at
            FROM user_api_keys
            WHERE user_id = ?
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None

        cipher = _get_fernet_cipher(user_id)
        raw_key = ""
        try:
            raw_key = cipher.decrypt(row["encrypted_key"].encode("utf-8")).decode("utf-8")
        except Exception as e:
            logger.error("Failed to decrypt API key for user %s: %s", user_id, e)
            return None

        result = {
            "provider": row["provider"],
            "model": row["model"],
            "has_key": True,
            "masked_key": mask_api_key(raw_key),
            "updated_at": row["updated_at"],
        }
        if decrypt:
            result["api_key"] = raw_key

        return result
    finally:
        conn.close()


def delete_user_api_key(user_id: int, db_path: Optional[Path] = None) -> bool:
    """Remove user custom API key and reset to system defaults."""
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM user_api_keys WHERE user_id = ?", (user_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Evaluation Persistence & History
# ---------------------------------------------------------------------------
def save_db_evaluation(
    record: Dict[str, Any],
    user_id: Optional[int] = None,
    db_path: Optional[Path] = None,
) -> bool:
    """Persist an evaluation record into SQLite with optional user_id link."""
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        suggestions_raw = record.get("suggestions") or []
        if isinstance(suggestions_raw, (list, dict)):
            suggestions_json = json.dumps(suggestions_raw)
        else:
            suggestions_json = str(suggestions_raw)

        cur.execute(
            """
            INSERT OR REPLACE INTO evaluations (
                id, user_id, timestamp, source, title, prompt_version, model,
                status, word_count, score_purpose, score_method, score_results,
                score_conclusion, score_clarity, total, warnings, suggestions_json,
                seconds, abstract
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(record.get("id")),
                user_id,
                str(record.get("timestamp")),
                str(record.get("source", "manual")),
                str(record.get("title", "Untitled Paper")),
                str(record.get("prompt_version", "score_v3")),
                str(record.get("model", "")),
                str(record.get("status", "completed")),
                int(record.get("word_count", 0)),
                int(record.get("score_purpose", 0)),
                int(record.get("score_method", 0)),
                int(record.get("score_results", 0)),
                int(record.get("score_conclusion", 0)),
                int(record.get("score_clarity", 0)),
                int(record.get("total", 0)),
                str(record.get("warnings", "none")),
                suggestions_json,
                float(record.get("seconds", 0.0)),
                str(record.get("abstract", "")),
            ),
        )
        conn.commit()
        return True
    except Exception as e:
        logger.error("Failed to save evaluation to SQLite: %s", e)
        return False
    finally:
        conn.close()


def get_evaluations_history(
    user_id: Optional[int] = None,
    include_legacy: bool = True,
    limit: int = 100,
    db_path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieve evaluation records.
    - If user_id is provided: returns user's evaluations (+ optional legacy/guest evaluations).
    - If user_id is None: returns guest/legacy evaluations or all.
    """
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        if user_id is not None:
            if include_legacy:
                cur.execute(
                    """
                    SELECT * FROM evaluations
                    WHERE user_id = ? OR user_id IS NULL
                    ORDER BY timestamp DESC
                    LIMIT ?
                    """,
                    (user_id, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT * FROM evaluations
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                    """,
                    (user_id, limit),
                )
        else:
            cur.execute(
                """
                SELECT * FROM evaluations
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (limit,),
            )

        rows = cur.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["suggestions"] = json.loads(d.get("suggestions_json") or "[]")
            except Exception:
                d["suggestions"] = []
            results.append(d)
        return results
    finally:
        conn.close()
