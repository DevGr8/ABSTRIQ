# ABSTRIQ 3.0 — Authentication Architecture

## 1. Overview

ABSTRIQ 3.0 enforces a strict multi-user cryptographic authentication model using **Firebase Authentication (Email/Password ONLY)** and **Firebase Admin SDK** token verification on the Python Flask backend.

```
+------------------+                    +---------------------+                    +----------------------+
|  React 19 SPA    |                    |  Firebase Auth API  |                    |  Flask Backend API   |
+------------------+                    +---------------------+                    +----------------------+
         |                                         |                                          |
         |  1. Login(email, password)              |                                          |
         |---------------------------------------->|                                          |
         |                                         |                                          |
         |  2. Returns Firebase ID Token (JWT)     |                                          |
         |<----------------------------------------|                                          |
         |                                                                                    |
         |  3. API Request: Header "Authorization: Bearer <ID_TOKEN>"                         |
         |----------------------------------------------------------------------------------->|
         |                                                                                    |
         |                                         |  4. verify_id_token(token) via Admin SDK |
         |                                         |<-----------------------------------------|
         |                                         |                                          |
         |                                         |  5. Returns Verified Claims {uid, ...}   |
         |                                         |----------------------------------------->|
         |                                                                                    |
         |                                                                6. Extracts UID &   |
         |                                                                   queries Firestore|
         |  7. Returns strictly User-Isolated Data                                            |
         |<-----------------------------------------------------------------------------------|
```

---

## 2. Core Security Invariants

1. **Zero Client Trust for UID**:
   - The backend NEVER accepts or trusts a `uid` provided in query parameters, request bodies, or custom headers.
   - The UID is extracted exclusively from the cryptographically verified signature via `firebase_admin.auth.verify_id_token(token)`.
2. **Email & Password Authentication Exclusively**:
   - Third-party social logins (Google, GitHub, etc.) are intentionally omitted to maintain academic isolation and prevent OAuth token leakage.
3. **Session Revocation & Expiration**:
   - ID tokens expire automatically after 60 minutes.
   - Frontend refreshes tokens silently via `auth.currentUser.getIdToken(true)` before high-security operations.
4. **Token Transmission**:
   - Sent strictly in the standard HTTP header:
     `Authorization: Bearer <Firebase_ID_Token>`

---

## 3. Dual-Environment Route & Endpoint Partition

### Public Environment (No Login Required)
- **Frontend Views:**
  - `/` or `Overview` (Cinematic hero, 3D generative scene, 5-criteria framework)
  - `/methodology` (5-Stage deterministic pipeline)
  - `/documentation` (Public rubric specifications modal)
  - `/demo` (Interactive sample evaluation preview using static demonstration data)
  - `/login`, `/signup`, `/forgot-password` (Authentication modals)
- **Backend Endpoints:**
  - `GET /` (SPA root)
  - `GET /api/config` (Rubric parameters and schema)
  - `GET /api/demo/sample` (Non-sensitive static benchmark evaluation)
  - `POST /api/demo/evaluate` (Rate-limited public demo evaluator, 350-word cap, mock heuristic, zero storage)
  - `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`

### Private Workspace (Authentication Required — HTTP 401 if missing)
- **Frontend Views:**
  - `/app/dashboard` (Executive KPI metrics, pass rate, personal evaluation records)
  - `/app/evaluation` (Evaluation Studio with paste, literature import, and PDF upload)
  - `/app/research` (OpenAlex and arXiv discovery query interface)
  - `/app/history` (Personal Firestore evaluations history)
  - `/app/analytics` (Personal score distribution and criteria analytics)
  - `/app/settings` (Personal rubric configuration)
  - `/app/profile` (Researcher profile and encrypted custom API credentials)
- **Backend Endpoints:**
  - `POST /api/evaluate` (Requires Bearer token, stores in `users/{uid}/evaluations`)
  - `GET /api/history` and `GET /api/history/<id>` (Strictly filtered by authenticated UID)
  - `GET /api/dashboard/stats` (Computed from user's evaluations; empty state for 0 records)
  - `GET /download` and `GET /api/download` (Dynamic multi-sheet Excel workbook for user UID)
  - `GET /api/search` and `POST /api/upload` (Protected workspace utilities)
  - `POST /api/test-key` (Credential testing)
  - `GET /api/reports` and `POST /api/reports/generate` (Persistent report generation)
  - `GET/POST/DELETE /api/user/custom-key` (AES-Fernet encrypted credential vault)
