# Source Extraction Methods & Retrieval Architecture

## 1. OpenAlex Corpus Extraction
OpenAlex delivers abstract text structured as an **abstract inverted index** (`abstract_inverted_index`), where each unique word token maps to a list of integer 0-indexed positions:
```json
{
  "dynamic": [0, 18],
  "block": [1],
  "sparsification": [2],
  "for": [3],
  ...
}
```

### Reconstruction Algorithm
1. The backend (`services/search.py`) parses the inverted index dictionary.
2. Finds the maximum index position $M$.
3. Allocates a linear array of size $M + 1$.
4. Populates each position with its respective token.
5. Joins tokens with standard whitespace: `" ".join(linear_array)`.
6. Attaches extraction method: `"openalex_inverted_index_reconstruction"`.
7. Captures work ID as `original_record_id` and canonical OpenAlex URL.

---

## 2. arXiv Export API Extraction
Preprints queried from arXiv are fetched using the arXiv Export API over Atom XML.

### Algorithm
1. An HTTP GET query is sent to `https://export.arxiv.org/api/query`.
2. The Atom XML namespace (`http://www.w3.org/2005/Atom`) is parsed using `xml.etree.ElementTree`.
3. Abstract text is extracted from the `<atom:summary>` element.
4. Extraneous internal newlines are flattened.
5. Metadata extracted:
   - `external_id`: arXiv entry ID (e.g. `2402.12345v1`).
   - `authors`: Collected from `<atom:author><atom:name>` tags.
   - `doi`: Extracted from `<arxiv:doi>` if present; otherwise `null`.
   - `source_url`: `https://arxiv.org/abs/{arxiv_id}`.
   - `extraction_method`: `"arxiv_atom_xml"`.

### Graceful Fallback
If the arXiv API returns a transient 503 error, rate limit, or network error:
1. ABSTRIQ queries OpenAlex filtered to `locations.source.display_name:arXiv`.
2. The abstract is reconstructed from OpenAlex.
3. Provenance explicitly records `extraction_method: "arxiv_fallback_openalex"` and `source_provider: "OpenAlex (arXiv fallback)"` to maintain academic transparency.

---

## 3. PDF Document Extraction
For research papers uploaded as PDF files:
1. `pypdf.PdfReader` parses the initial 2 pages.
2. The document binary SHA-256 hash is computed over all file bytes and stored in `documentHash`.
3. The page count is recorded (e.g. `"Pages 1-2 of 14"`).
4. `find_abstract_in_text()` locates the `"Abstract"` section heading and truncates at boundary headers (`"Keywords"`, `"Index Terms"`, `"1. Introduction"`).
5. Line-break hyphenations are reassembled (e.g., `"trans- \nformer"` $\to$ `"transformer"`).
6. Provenance attaches `extraction_method: "pdf_text_extraction"`.

---

## 4. TXT / Markdown Extraction
For plain text files:
1. UTF-8 and Latin-1 encodings are decoded.
2. The document SHA-256 hash is computed over file bytes.
3. The document is scanned for `"Abstract"` headings and boundary tags.
4. Provenance attaches `extraction_method: "txt_text_extraction"`.
