# System Architecture & 5-Stage Evaluation Workflow

This document details the complete 5-stage evaluation workflow and authentication security architecture implemented in **ABSTRIQ 3.1**.

---

## 1. System Architecture & Dual-Environment SaaS Flow

```mermaid
flowchart TD
    User([User / Researcher]) --> AuthChoice{Authenticated?}
    
    AuthChoice -->|No: Public Visitor| PublicSite[Public Website Environment]
    PublicSite --> PubPages[Overview / Hero / 3D Visualization<br/>5-Criteria Rubric Framework<br/>Interactive Demo with Static Data<br/>Public Documentation Modal]
    PubPages --> AuthModal[Sign In / Create Free Account]
    
    AuthChoice -->|Yes: Verified UID| PrivApp[Private Workspace Environment]
    PrivApp --> SlideNav[Sliding Sidebar: Studio, Dashboard, Research, History, Analytics]
    
    SlideNav --> InputChoice{Studio Input Method}
    InputChoice -->|Paste| In1[Raw Textarea]
    InputChoice -->|Search & Import| In2[OpenAlex / arXiv Query<br/>Inverted Index & Atom XML]
    InputChoice -->|Upload File| In3[PDF / TXT Document<br/>Abstract Boundary Regex]
    
    In1 & In2 & In3 --> S1[Stage 1: Rule-Based Pre-Check<br/>Zero LLM Cost]
    
    S1 --> CheckCond{Pre-Check Valid?}
    CheckCond -->|Empty / <40 w / >450 w / Non-Prose| Reject([❌ 400 Bad Request<br/>Clear Rejection Error])
    CheckCond -->|Prompt Manipulation Detected| FlagInj[🚩 Set injection_detected: true]
    CheckCond -->|Valid| S2
    FlagInj --> S2
    
    S2[Stage 2: LLM Rubric Scoring<br/>Prompt v3 Delimited XML<br/>Temperature 0, Direct HTTP] --> KeyLookup{Custom Key Configured?}
    
    KeyLookup -->|User Encrypted Key in Firestore| DecryptKey[AES-Fernet Decrypt User Key]
    KeyLookup -->|No Custom Key| ServerDefault[Use Server Inception Mercury-3 Key]
    
    DecryptKey & ServerDefault --> ExecLLM[Execute Provider Call]
    
    ExecLLM --> S4[Stage 4: Python Safeguards & Validation]
    
    S4 --> ValidCheck{Valid JSON & Descriptors?}
    ValidCheck -->|Invalid JSON / Missing Items| RetryCheck{Retry Attempt < 2?}
    RetryCheck -->|Yes| S2
    RetryCheck -->|No| FallbackScore[Assign Fallback 0]
    
    ValidCheck -->|Valid| MathRecomp[Python Recomputes Sum 0-20<br/>Ignore LLM Arithmetic]
    FallbackScore --> MathRecomp
    
    MathRecomp --> EvCheck[Check Verbatim Evidence Substring in Abstract<br/>Flag 'Possible Hallucination' if Missing]
    
    EvCheck --> S3[Stage 3: Targeted Suggestions<br/>Triggered only for Items &le; 2 / 4<br/>Concrete Remediation without Invented Numbers]
    
    S3 --> S5[Stage 5: Encrypted Firestore Persistence & Reporting<br/>Stored in users/{uid}/evaluations/{id}<br/>Dynamic User-Isolated Excel Export]
    
    S3 --> S5[Stage 5: Dual Storage & Automation]
    
    S5 --> SQLite[(SQLite: data/abstriq.db<br/>Linked to user_id for Isolation)]
    S5 --> Excel[(Excel: data/results.xlsx<br/>Thread-Safe openpyxl)]
    
    S5 --> AutoCheck{Total Score &le; 10?}
    AutoCheck -->|No: Passed| AutoLog[results.xlsx: automation_log<br/>status: passed]
    AutoCheck -->|Yes: Flagged| FlagLog[results.xlsx: flagged_low_scores]
```

---

## 2. Authentication & Session Lifecycle

### User Registration & Password Hashing
- **Endpoint:** `POST /api/auth/signup`
- Passwords are validated for a minimum length of 6 characters and hashed using `pbkdf2:sha256` with 1,000,000 iterations and cryptographic salting. Plaintext passwords never touch persistence.

### Session Token Generation & Expiration
- **Endpoint:** `POST /api/auth/login`
- Generates a 64-character hexadecimal cryptographically secure random token (`secrets.token_hex(32)`).
- Session record stored in the `sessions` table with an expiration timestamp (`now + 14 days`).
- Delivered to client both in the JSON payload and via an `HttpOnly`, `SameSite=Lax` cookie (`abstriq_session`).
- Verified via `get_current_user()` middleware on protected endpoints.
- Revocation via `POST /api/auth/logout` immediately purges the session row from SQLite.

### Password Reset Flow
1. User requests password reset via `POST /api/auth/forgot-password` providing their email.
2. Server generates a single-use URL-safe token with a 60-minute expiration window stored in `users.reset_token`.
3. User submits new password via `POST /api/auth/reset-password`.
4. Server hashes the new password, clears the reset token, and revokes all active sessions for that user for security.

---

## 3. Encrypted Custom API Key Lifecycle

1. **Storage:**
   - Authenticated users save credentials via `POST /api/user/custom-key`.
   - The key is symmetrically encrypted using `cryptography.fernet.Fernet` with a user-specific derived key:
     $$\text{Key} = \text{base64url}(\text{HMAC-SHA256}(\text{SECRET\_KEY}, \text{"abstriq-user-key-salt-" } + \text{user\_id}))$$
   - The encrypted ciphertext is stored in `user_api_keys.encrypted_key`.
2. **Inspection:**
   - `GET /api/user/custom-key` returns only `masked_key` (e.g. `sk-p...9999`).
   - The raw key is never returned across the network after the initial save.
3. **Execution:**
   - When the user runs an abstract evaluation, the backend retrieves and decrypts the key in-memory solely for the HTTP duration.
   - Credentials are never logged or exposed in stack traces.
