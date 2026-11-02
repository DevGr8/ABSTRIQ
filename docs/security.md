# ABSTRIQ 3.0 — Security & Credential Isolation Architecture

## 1. Threat Model & Protections

| Threat | Attack Vector | ABSTRIQ 3.0 Mitigation |
| :--- | :--- | :--- |
| **Cross-User Data Leakage** | User A crafts requests to fetch User B's evaluations | Enforced at two independent layers: Firestore Security Rules (`request.auth.uid == uid`) and Flask backend verification (`g.current_user["uid"]`). |
| **API Key Plaintext Exposure** | Database compromise or inspect network calls | AES-128-CBC (Fernet) per-user derived key encryption at rest; masked responses (`sk-p...9999`); raw keys never returned to frontend. |
| **Legacy Data Contamination** | Prior unassigned evaluations auto-assigned to new users | Stored in dedicated `legacy_evaluations` collection with `assignedUid: null`. Never returned in user queries. |
| **Credential Hijacking** | Spoofed UID in request payload | Backend extracts UID exclusively from verified cryptographic JWT claim. Client payload UIDs are rejected. |
| **Report Interception** | Downloading another user's Excel audit logs | Excel workbooks generated dynamically in-memory filtered strictly by authenticated UID; Storage paths partitioned under `users/{uid}/reports/`. |

---

## 2. API Key Encryption Vault (`Fernet`)

User custom API credentials (OpenAI, Gemini, Groq, Inception, Anthropic, DeepSeek) are stored using an envelope encryption model:
1. A server master secret (`SECRET_KEY`) combined with the user's permanent `uid` generates a deterministic 256-bit PBKDF2/SHA256 key:
   $$\text{DerivedKey} = \text{PBKDF2HMAC}(\text{MasterKey}, \text{Salt}=\text{SHA256}(\text{uid}))$$
2. The raw API key is encrypted using AES-128 in CBC mode with PKCS7 padding and HMAC-SHA256 authentication (`Fernet`).
3. Only the ciphertext string is persisted in Firestore under `users/{uid}/apiConfigurations/{configId}`.
4. When retrieved by the frontend, the response provides ONLY:
   ```json
   {
     "configId": "cfg_openai_1a2b3c",
     "provider": "openai",
     "model": "gpt-4o",
     "maskedKey": "sk-p...1234",
     "hasKey": true,
     "active": true
   }
   ```
5. Decryption occurs strictly in-memory inside backend workers during an active `/api/evaluate` request and is immediately discarded from memory.
