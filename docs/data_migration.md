# ABSTRIQ 3.0 — Legacy Evaluation Migration Protocol

## 1. Migration Directive & Rules

Prior to ABSTRIQ 3.0, evaluations were stored in a single shared file: `data/results.xlsx` (containing 46 historical benchmark records).

Under the ABSTRIQ 3.0 multi-user architecture:
- Shared evaluation storage is **strictly prohibited**.
- Legacy records must **NEVER** be automatically assigned to newly registered users.
- Legacy records are segregated into a dedicated top-level collection: `legacy_evaluations/{evaluationId}`.
- Every legacy document has:
  ```json
  {
    "assignedUid": null,
    "migrationStatus": "UNASSIGNED",
    "ownershipVerified": false,
    "source": "legacy_results_xlsx"
  }
  ```

---

## 2. Executing the Migration

The migration utility can be executed programmatically or via CLI:

```bash
# Run migration CLI
python3 services/migration.py --file data/results.xlsx
```

Sample CLI output:
```json
{
  "migrated": 46,
  "skipped": 0,
  "status": "completed",
  "excel_path": "data/results.xlsx",
  "target_collection": "legacy_evaluations"
}
```

---

## 3. Idempotency & Conflict Prevention

`services/migration.py` is fully idempotent:
- It checks existing document IDs in `legacy_evaluations/` prior to writing.
- Running the tool multiple times skips already migrated evaluation IDs, preventing record duplication or timestamp corruption.
