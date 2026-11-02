# Test Evidence & Verification Report — ABSTRIQ 3.1

**Generated:** 2026-11-02 12:44:00 UTC  
**Environment:** macOS (Apple Silicon arm64), Python 3.9.6, SQLite 3.39.5, Vite 6.4.5, React 19  
**Overall Status:** ✅ ALL 32 TESTS PASSED (100% Passing Rate)  

---

## 1. Test Execution Evidence

```
============================= test session starts ==============================
platform darwin -- Python 3.9.6, pytest-8.4.2, pluggy-1.6.0
rootdir: /Users/stargaze/Documents/MiniProject/Sem3/ai_and_prompt
plugins: anyio-4.12.1
collecting ... collected 32 items                                                             

tests/test_app.py .............                                          [ 40%]
tests/test_auth.py ........                                              [ 65%]
tests/test_firebase.py ......                                            [ 84%]
tests/test_saas_architecture.py .....                                    [100%]

======================== 32 passed, 1 warning in 11.64s ========================
```

---

## 2. Authentication-First SaaS Architecture Verification

| Case | Category | Verification Method | Outcome | Status |
|---|---|---|---|---|
| `test_public_endpoints_accessible_without_authentication` | Public Web | Queried `/`, `/api/config`, `/api/demo/sample`, and `/api/demo/evaluate` | All public endpoints return 200 without token; static demo data returned | ✅ PASS |
| `test_private_endpoints_strictly_blocked_without_authentication` | API Security | Sent requests without token to 13 private endpoints (`/api/evaluate`, `/api/history`, `/download`, `/api/dashboard/stats`, `/api/search`, `/api/upload`, `/api/test-key`, `/api/user/custom-key`, etc.) | Every private endpoint strictly returns HTTP 401 Unauthorized | ✅ PASS |
| `test_new_user_clean_workspace_and_empty_state` | SaaS Onboarding | Registered new account; queried `/api/dashboard/stats` and `/api/history` | `total_evaluations: 0`, `average_score: 'N/A'`, `pass_rate: 'N/A'`, clean welcoming prompt | ✅ PASS |
| `test_authenticated_evaluation_and_excel_download` | Private Studio | Authenticated user runs private evaluation and downloads report | Evaluation links to UID in Firestore; Excel workbook contains only user's records | ✅ PASS |
| `test_strict_cross_user_data_isolation` | Multi-User Security | User A saves evaluation; User B queries `/api/history/{eval_id_a}` | User B receives 404 (non-disclosing access denied); User B history is empty | ✅ PASS |

---

## 2. Firebase Multi-User & Data Isolation Breakdown

| Case | Category | Verification Method | Outcome | Status |
|---|---|---|---|---|
| `test_token_verification_and_uid_extraction` | Security | Decoded token via Firebase Admin SDK; verified zero trust for client UID | Valid token returns UID; empty/malformed tokens rejected (401) | ✅ PASS |
| `test_firestore_user_lifecycle` | Profile | Managed profile and preferences in `users/{uid}` | Profile initialized; preferences updated cleanly | ✅ PASS |
| `test_evaluation_storage_and_user_isolation` | Multi-User | User A saves evaluation in `users/{uid_a}/evaluations`; User B queries ID | User A accesses record; User B query returns `None` (blocked) | ✅ PASS |
| `test_encrypted_api_key_vault` | Credentials | User saves OpenAI key; retrieved client view vs decrypted server view | Client gets masked `sk-p...6789`; internal decrypt matches raw secret; other user blocked | ✅ PASS |
| `test_dynamic_user_isolated_excel_report` | Reporting | Generated dynamic Excel report for User A | Workbook contains 3 sheets; populated strictly with User A evaluations | ✅ PASS |
| `test_legacy_evaluations_migration_segregation` | Migration | Ran legacy migration on `data/results.xlsx` | 46 records migrated to `legacy_evaluations` with `assignedUid: None` and `migrationStatus: 'UNASSIGNED'` | ✅ PASS |

---

## 2. Authentication & Security Test Breakdown

| Case | Category | Verification Method | Outcome | Status |
|---|---|---|---|---|
| `test_signup_success` | User Lifecycle | Created user `alice@lab.edu` with full metadata | 201 Created, returned 64-char token, user row in SQLite | ✅ PASS |
| `test_signup_duplicate_email` | Validation | Re-registered with existing email | 400 Bad Request: "already exists" | ✅ PASS |
| `test_signup_short_password` | Security | Attempted password `< 6` characters | 400 Bad Request: "at least 6 characters" | ✅ PASS |
| `test_login_success_and_invalid` | Auth Verification | Tested login with email, username, and invalid password | Valid credentials: 200 OK; invalid: 401 Unauthorized | ✅ PASS |
| `test_protected_routes_and_logout` | Session Control | Queried `/api/auth/me` without token, with token, then called logout | Unauthenticated: 401; Authenticated: 200; Post-logout: 401 | ✅ PASS |
| `test_password_reset_flow` | Recovery | Generated single-use reset token, reset password, verified old password fails | Old password fails with 401; new password succeeds | ✅ PASS |
| `test_custom_api_key_encryption_and_cross_user_isolation` | Credential Security | User A saves `sk-proj-...` key; inspected raw DB; checked User B access | Key encrypted with AES-Fernet (raw key absent from DB); User B sees no key | ✅ PASS |
| `test_evaluate_with_authenticated_user` | User Isolation | User runs evaluation via `/api/evaluate`; checked `/api/history` | Evaluation links to `user_id`; history includes run | ✅ PASS |

---

## 3. Core Engine & Literature Test Breakdown

| Case | Category | Verification Method | Outcome | Status |
|---|---|---|---|---|
| `test_openalex_rebuilder` | Extraction | Reconstructed prose from word-position dictionary | Exact sequential sentence reconstruction | ✅ PASS |
| `test_document_extractor` | Extraction | Extracted text between `Abstract` and `Keywords` | Cleanly extracted 40 words | ✅ PASS |
| `test_pre_check_empty` | Edge Case | Sent blank whitespace string | 400 Bad Request: "cannot be empty" (0 LLM tokens) | ✅ PASS |
| `test_pre_check_underlength` | Edge Case | Sent 7-word fragment | 400 Bad Request: "too short" (0 LLM tokens) | ✅ PASS |
| `test_pre_check_prompt_injection` | Security | Sent adversarial "ignore instructions" attack | `injection_detected: true`, attack neutralised | ✅ PASS |
| `test_api_config` | API | Queried `/api/config` | Returned active provider, model, rubric schema | ✅ PASS |
| `test_api_evaluate` | Evaluation | Ran full 5-stage evaluation pipeline | Total score computed in Python, 5 criterion items verified | ✅ PASS |
| `test_api_download` | Storage | Requested `/download` | Valid Excel spreadsheet streamed with 3 worksheets | ✅ PASS |
| `test_api_test_key_mock` | LLM Key | Pinged `/api/test-key` with mock | 200 OK: "Connection verified" | ✅ PASS |
| `test_api_test_key_missing_key` | LLM Key | Pinged live provider without key | 400 Bad Request: "API key cannot be empty" | ✅ PASS |
| `test_api_evaluate_with_custom_provider` | Overrides | Passed custom model override in payload | Evaluated and confirmed override applied | ✅ PASS |

---

## 4. Frontend Production Build Verification

```
> abstriq-frontend@1.0.0 build
> tsc -b && vite build

vite v6.4.5 building for production...
✓ 2026 modules transformed.
dist/index.html                     1.29 kB │ gzip:   0.73 kB
dist/assets/index-DMI3wlro.css     39.22 kB │ gzip:   7.50 kB
dist/assets/index-CUFyNufN.js   1,386.20 kB │ gzip: 383.76 kB
✓ built in 3.55s
```
- **TypeScript:** Strict type checking passed with 0 errors.
- **Rollup/Vite:** Static assets bundled cleanly into `dist/`.
