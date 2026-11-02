# Test Results — ABSTRIQ 3.1

Generated: 2026-11-02 12:44:00 UTC  
Test Framework: pytest 8.4.2 (Python 3.9.6, Darwin arm64)  
Overall Result: ✅ 32 PASSED | 0 FAILED | 0 SKIPPED (100% Success Rate)

---

## 1. Automated Test Suite Summary

| # | Test Identifier | Module | Description | Status |
|---|---|---|---|---|
| 1 | `test_openalex_rebuilder` | `tests/test_app.py` | Reconstructs abstract from OpenAlex inverted index tokens | ✅ PASS |
| 2 | `test_document_extractor` | `tests/test_app.py` | Extracts abstract bounded by Abstract and Keywords | ✅ PASS |
| 3 | `test_pre_check_empty` | `tests/test_app.py` | Stage 1 pre-check rejects empty input with zero LLM calls | ✅ PASS |
| 4 | `test_pre_check_underlength` | `tests/test_app.py` | Stage 1 pre-check rejects text < 40 words | ✅ PASS |
| 5 | `test_pre_check_prompt_injection` | `tests/test_app.py` | Flags adversarial prompt injection phrases | ✅ PASS |
| 6 | `test_api_config` | `tests/test_app.py` | `/api/config` returns runtime settings and rubric schema | ✅ PASS |
| 7 | `test_api_evaluate` | `tests/test_app.py` | `/api/evaluate` executes 5-stage pipeline and returns report | ✅ PASS |
| 8 | `test_api_download` | `tests/test_app.py` | `/download` streams valid multi-sheet Excel attachment | ✅ PASS |
| 9 | `test_api_test_key_mock` | `tests/test_app.py` | `/api/test-key` successfully verifies mock engine | ✅ PASS |
| 10 | `test_api_test_key_missing_key` | `tests/test_app.py` | `/api/test-key` rejects live provider when key is missing (400) | ✅ PASS |
| 11 | `test_api_evaluate_with_custom_provider` | `tests/test_app.py` | `/api/evaluate` respects custom model & provider overrides | ✅ PASS |
| 12 | `test_unauthenticated_requests_strictly_blocked` | `tests/test_app.py` | Unauthenticated calls to evaluate, history, download, stats return 401 | ✅ PASS |
| 13 | `test_public_demo_endpoints_accessible_without_auth` | `tests/test_app.py` | Demo sample & demo evaluator accessible to visitors without auth | ✅ PASS |
| 14 | `test_signup_success` | `tests/test_auth.py` | User signup with PBKDF2:SHA256 password hash and session token | ✅ PASS |
| 15 | `test_signup_duplicate_email` | `tests/test_auth.py` | Rejects duplicate registration with clean 400 error message | ✅ PASS |
| 16 | `test_signup_short_password` | `tests/test_auth.py` | Enforces minimum 6-character password constraint | ✅ PASS |
| 17 | `test_login_success_and_invalid` | `tests/test_auth.py` | Verifies login with email & username; rejects incorrect passwords | ✅ PASS |
| 18 | `test_protected_routes_and_logout` | `tests/test_auth.py` | Protects routes without token, verifies Bearer header, revokes on logout | ✅ PASS |
| 19 | `test_password_reset_flow` | `tests/test_auth.py` | Single-use token generation -> password update -> old password rejection | ✅ PASS |
| 20 | `test_custom_api_key_encryption_and_cross_user_isolation` | `tests/test_auth.py` | Encrypts API keys at rest (Fernet); verifies cross-user isolation | ✅ PASS |
| 21 | `test_evaluate_with_authenticated_user` | `tests/test_auth.py` | Links abstract evaluation to user_id and isolates user history | ✅ PASS |
| 22 | `test_token_verification_and_uid_extraction` | `tests/test_firebase.py` | Firebase Admin SDK extracts UID from token without trusting client input | ✅ PASS |
| 23 | `test_firestore_user_lifecycle` | `tests/test_firebase.py` | Initializes and updates users/{uid} profile and preferences | ✅ PASS |
| 24 | `test_evaluation_storage_and_user_isolation` | `tests/test_firebase.py` | Verifies User A evaluation in users/{uid}/evaluations is completely blocked from User B | ✅ PASS |
| 25 | `test_encrypted_api_key_vault` | `tests/test_firebase.py` | AES-Fernet encryption at rest; masked responses; strict UID partition | ✅ PASS |
| 26 | `test_dynamic_user_isolated_excel_report` | `tests/test_firebase.py` | Generates 3-sheet Excel report containing strictly User A evaluations | ✅ PASS |
| 27 | `test_legacy_evaluations_migration_segregation` | `tests/test_firebase.py` | Segregates legacy records with assignedUid: None in legacy_evaluations | ✅ PASS |
| 28 | `test_public_endpoints_accessible_without_authentication` | `tests/test_saas_architecture.py` | Root, config, demo sample, and demo evaluate accessible publicly | ✅ PASS |
| 29 | `test_private_endpoints_strictly_blocked_without_authentication` | `tests/test_saas_architecture.py` | 13 private endpoints strictly return 401 when accessed without token | ✅ PASS |
| 30 | `test_new_user_clean_workspace_and_empty_state` | `tests/test_saas_architecture.py` | New user receives 0 evaluations, N/A scores, welcoming workspace prompt | ✅ PASS |
| 31 | `test_authenticated_evaluation_and_excel_download` | `tests/test_saas_architecture.py` | Authenticated user evaluates paper and downloads dynamic Excel workbook | ✅ PASS |
| 32 | `test_strict_cross_user_data_isolation` | `tests/test_saas_architecture.py` | User B cannot view or query User A evaluation records (404/blocked) | ✅ PASS |

---

## 2. Stability & Security Verification

- **Firebase Admin SDK Verification:** Extracts cryptographically verified UID from Bearer JWT. Zero client UID spoofing possible.
- **Strict Data Isolation:** Dual-layer enforcement (Firestore Security Rules + Flask backend). User A cannot query, read, or download User B evaluations.
- **Envelope Credential Encryption:** Custom LLM API keys are encrypted with AES-Fernet PBKDF2 keys derived per UID. Masked retrieval only (`sk-p...9999`).
- **Dynamic Excel Generation:** User downloads produce dynamic workbooks in-memory populated only with their authenticated evaluations.
- **Legacy Migration:** 46 historical evaluations segregated into `legacy_evaluations/` with `assignedUid: null`. Never auto-assigned to users.
