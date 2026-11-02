# ABSTRIQ 3.0 — Firestore Database Schema & Index Specification

## 1. Document Architecture & Hierarchy

```
users/
└── {uid}/
    ├── (fields: uid, email, displayName, createdAt, updatedAt, emailVerified, accountStatus, preferences)
    ├── evaluations/
    │   └── {evaluationId}/
    │       (fields: evaluationId, researchTitle, abstract, createdAt, updatedAt, totalScore,
    │        maximumScore, individualCriteriaScores, evaluationStatus, provider, model, evidence,
    │        explanations, suggestions, metadata)
    ├── apiConfigurations/
    │   └── {configId}/
    │       (fields: configId, provider, model, encryptedKey, maskedKey, createdAt, updatedAt, active)
    └── reports/
        └── {reportId}/
            (fields: reportId, reportType, storagePath, createdAt, relatedEvaluationIds, status)

legacy_evaluations/
└── {evaluationId}/
    (fields: evaluationId, researchTitle, abstract, createdAt, migratedAt, assignedUid: null,
     migrationStatus: 'UNASSIGNED', ownershipVerified: false, totalScore, individualCriteriaScores, source)
```

---

## 2. Collection Detailed Specifications

### `users/{uid}`
- `uid`: `string` (Primary cryptographic UID from Firebase Auth)
- `email`: `string`
- `displayName`: `string`
- `createdAt`: `ISO 8601 string / Timestamp`
- `updatedAt`: `ISO 8601 string / Timestamp`
- `emailVerified`: `boolean`
- `accountStatus`: `'active' | 'suspended'`
- `preferences`: `map` (`defaultPrompt`: string, `theme`: string)

### `users/{uid}/evaluations/{evaluationId}`
- `evaluationId`: `string` (Format: `eval_<hex10>`)
- `researchTitle`: `string`
- `abstract`: `string`
- `createdAt`: `ISO 8601 string / Timestamp`
- `updatedAt`: `ISO 8601 string / Timestamp`
- `totalScore`: `number` (0 to 20)
- `maximumScore`: `number` (20)
- `individualCriteriaScores`: `map`
  - `purpose`: `number` (0-4)
  - `method`: `number` (0-4)
  - `results`: `number` (0-4)
  - `conclusion`: `number` (0-4)
  - `clarity`: `number` (0-4)
- `evaluationStatus`: `'completed' | 'flagged' | 'failed'`
- `provider`: `string` (e.g. `openai`, `gemini`, `inception`, `anthropic`)
- `model`: `string`
- `evidence`: `map`
- `explanations`: `map`
- `suggestions`: `array of string`
- `metadata`: `map` (`wordCount`, `source`, `promptVersion`, `warnings`, `clientIpHash`)

### `users/{uid}/apiConfigurations/{configId}`
- `configId`: `string` (Format: `cfg_<provider>_<hex6>`)
- `provider`: `string`
- `model`: `string`
- `encryptedKey`: `string` (AES-128-CBC / Fernet ciphertext, NEVER plaintext)
- `maskedKey`: `string` (e.g. `sk-p...9999`)
- `createdAt`: `ISO 8601 string / Timestamp`
- `updatedAt`: `ISO 8601 string / Timestamp`
- `active`: `boolean`

### `users/{uid}/reports/{reportId}`
- `reportId`: `string` (Format: `rep_<hex10>`)
- `reportType`: `'excel' | 'pdf' | 'json'`
- `storagePath`: `string` (e.g. `users/{uid}/reports/{reportId}.xlsx`)
- `createdAt`: `ISO 8601 string / Timestamp`
- `relatedEvaluationIds`: `array of string`
- `status`: `'ready' | 'generating' | 'failed'`

### `legacy_evaluations/{evaluationId}`
- **Isolation Guarantee**: Blocked from client SDK reads. Accessible ONLY by backend admin SDK.
- `assignedUid`: `null` (Explicitly unassigned)
- `migrationStatus`: `'UNASSIGNED'`
- `ownershipVerified`: `false`

---

## 3. Firestore Indexes (`firestore.indexes.json`)

```json
{
  "indexes": [
    {
      "collectionGroup": "evaluations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "evaluationStatus", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "evaluations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "totalScore", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```
