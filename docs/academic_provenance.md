# ABSTRIQ 3.2 Academic Source Provenance Specification

## 1. Overview & Purpose
Academic credibility, reproducibility, and computational integrity require that research abstracts evaluated by ABSTRIQ are never treated as isolated or untraceable blocks of text.

ABSTRIQ 3.2 introduces **Academic Source Provenance**, a cryptographically verifiable provenance subsystem attached to every evaluated paper—whether retrieved via OpenAlex, discovered on arXiv, extracted from an uploaded PDF/TXT, or pasted manually.

---

## 2. Provenance Record Schema (v3.2.0)

Each provenance record is constructed immutably upon import or document extraction:

| Field | Type | Description |
|---|---|---|
| `provenanceVersion` | `string` | Version identifier (`"3.2.0"`). |
| `importOperationId` | `string` | Unique tracking identifier for the import or extraction transaction (`imp_...`). |
| `sourceType` | `string` | Category (`"openalex"`, `"arxiv"`, `"pdf_upload"`, `"txt_upload"`, `"paste"`). |
| `sourceProvider` | `string` | Canonical human-readable provider name (`"OpenAlex"`, `"arXiv"`, `"Uploaded Document"`). |
| `sourceUrl` | `string \| null` | Verified canonical source URL or paper landing page. |
| `doi` | `string \| null` | Verified canonical DOI (`https://doi.org/10.xxxx/...`). Validated against standard regex; never fabricated. |
| `externalId` | `string \| null` | External record identifier (e.g. OpenAlex Work ID `W312...`, arXiv ID `2402.12345v1`). |
| `paperTitle` | `string` | Canonical title of the paper. |
| `authors` | `string \| null` | Formatted author string. |
| `publicationYear` | `string \| null` | Clean 4-digit publication year. |
| `publicationVenue` | `string \| null` | Journal, conference, or repository venue name. |
| `retrievedAt` | `string` | ISO 8601 UTC timestamp of retrieval. |
| `retrievalTimestamp` | `integer` | Epoch millisecond timestamp of retrieval. |
| `retrievalMethod` | `string` | Pipeline method (`"api_search"`, `"file_upload"`, `"manual_entry"`). |
| `sourceApi` | `string \| null` | Name of upstream REST endpoint or service. |
| `originalApiRecordId` | `string \| null` | Identifier assigned by source provider API. |
| `extractionMethod` | `string` | Exact extraction technique used (see below). |
| `extractionSource` | `string` | Text field or section parsed. |
| `originalAbstractText` | `string` | Verbatim text as originally retrieved or uploaded. |
| `normalizedAbstractText`| `string` | Canonical normalized text used for evaluation. |
| `extractionTimestamp` | `string` | ISO 8601 UTC extraction timestamp. |
| `extractionStatus` | `string` | Status: `"success"`, `"fallback"`, or `"warning"`. |
| `extractionWarnings` | `string[]` | Non-fatal extraction caveats or warnings. |
| `originalTextHash` | `string` | SHA-256 hex digest of the original extracted abstract text. |
| `normalizedTextHash` | `string` | SHA-256 hex digest of the normalized abstract text. |
| `documentHash` | `string \| null` | SHA-256 hex digest of uploaded binary or document bytes (PDF / TXT). |
| `pageRange` | `string \| null` | Extracted page interval (e.g. `"Pages 1-2 of 12"` for PDFs). |
| `manuallyEdited` | `boolean` | `true` if text was modified in the Evaluation Studio after import. |
| `modificationTimestamp` | `string \| null`| ISO 8601 UTC timestamp of manual modification. |

---

## 3. Cryptographic Text Integrity & Edit Tracking

### Deterministic Text Normalization
Abstract text is canonically normalized before hash generation:
1. Carriage returns (`\r\n`, `\r`) are converted to `\n`.
2. Sequences of inline whitespace (spaces, tabs) are collapsed into a single space.
3. Excessive line breaks are collapsed into standard paragraph separators (`\n\n`).
4. Leading and trailing whitespace is stripped.

### SHA-256 Hashing
```python
hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()
```

### Manual Edit Detection
If a researcher edits the abstract in the Evaluation Studio after importing:
1. `manuallyEdited` is flagged `true`.
2. `modificationTimestamp` is recorded in UTC.
3. A new `normalizedTextHash` is calculated for the edited text.
4. The original text (`originalAbstractText`) and `originalTextHash` are **permanently preserved**.
5. The UI surfaces a prominent advisory badge and provides a side-by-side text drawer for comparison.

---

## 4. Anti-Fabrication Safeguards
- **DOIs:** Validated strictly with `^10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$`. If missing or malformed, stored as `null`. No placeholder strings or internal IDs are masqueraded as DOIs.
- **Source URLs:** Must start with `http://` or `https://`.
- **Publication Years:** Must match valid 4-digit years `(19\d\d|20\d\d)`.
