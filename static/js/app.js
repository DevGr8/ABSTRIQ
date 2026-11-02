/**
 * Research Abstract Evaluator - Vanilla Frontend Controller
 * Handles tabs, search, file uploads, live evaluation, and history.
 */

// ---------------------------------------------------------------------------
// Utility: Safe HTML Escaping (XSS Prevention)
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Theme Management (Light / Dark Mode)
// ---------------------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem("abstract_eval_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  const toggleBtn = document.getElementById("themeToggleBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("abstract_eval_theme", next);
      updateThemeIcon(next);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById("themeIcon");
  if (icon) {
    icon.textContent = theme === "dark" ? "☀️" : "🌙";
  }
}

// ---------------------------------------------------------------------------
// Word Count Monitor
// ---------------------------------------------------------------------------
function updateWordCount() {
  const textarea = document.getElementById("abstractInput");
  const countTag = document.getElementById("wordCountTag");
  if (!textarea || !countTag) return;

  const text = textarea.value.trim();
  const words = text ? text.split(/\s+/).length : 0;

  countTag.textContent = `${words} words`;
  countTag.className = "word-count-tag";

  if (words === 0) {
    countTag.classList.remove("valid", "warn", "invalid");
  } else if (words >= 120 && words <= 250) {
    countTag.classList.add("valid");
    countTag.title = "Ideal length (120-250 words)";
  } else if (words >= 40 && words <= 450) {
    countTag.classList.add("warn");
    countTag.title = "Acceptable, but target 120-250 words";
  } else {
    countTag.classList.add("invalid");
    countTag.title = words < 40 ? "Too short (< 40 words)" : "Too long (> 450 words)";
  }
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      // Set active button
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      // Show active content
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");
    });
  });
}

function switchToTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

// ---------------------------------------------------------------------------
// Configuration & Provider Badge
// ---------------------------------------------------------------------------
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();

    const badgeContainer = document.getElementById("providerBadgeContainer");
    if (badgeContainer) {
      if (data.is_mock) {
        badgeContainer.innerHTML = `
          <span class="badge badge-mock" title="Offline keyword heuristic - zero API keys required">
            ⚠️ MOCK MODE (${escapeHtml(data.model)})
          </span>
        `;
      } else {
        badgeContainer.innerHTML = `
          <span class="badge badge-live" title="Live LLM Active">
            🟢 LIVE: ${escapeHtml(data.provider.toUpperCase())} (${escapeHtml(data.model)})
          </span>
        `;
      }
    }

    // Populate prompt versions
    const promptSelect = document.getElementById("promptVersionSelect");
    if (promptSelect && data.prompt_versions) {
      promptSelect.innerHTML = "";
      data.prompt_versions.forEach((ver) => {
        const opt = document.createElement("option");
        opt.value = ver;
        opt.textContent = ver === "score_v3" ? "v3 (Default: Constraints + Injection Guard)" : ver === "score_v2" ? "v2 (Rubric + JSON Schema)" : "v1 (Minimal Prompt)";
        if (ver === data.default_prompt) opt.selected = true;
        promptSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Failed to load server configuration:", err);
  }
}

// ---------------------------------------------------------------------------
// Search & Import (OpenAlex & arXiv)
// ---------------------------------------------------------------------------
function initSearch() {
  const searchBtn = document.getElementById("searchBtn");
  const queryInput = document.getElementById("searchQueryInput");
  const sourceSelect = document.getElementById("searchSourceSelect");
  const resultsContainer = document.getElementById("searchResultsContainer");

  async function performSearch() {
    const query = queryInput.value.trim();
    if (!query) return;

    const source = sourceSelect.value;
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div class="spinner" style="width: 28px; height: 28px;"></div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Querying ${escapeHtml(source)}...</p>
      </div>
    `;

    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}`);
      const data = await res.json();
      const results = data.results || [];

      if (results.length === 0) {
        resultsContainer.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
            No papers found with abstracts for "${escapeHtml(query)}". Try another query or switch source.
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = "";
      results.forEach((paper, idx) => {
        const item = document.createElement("div");
        item.className = "search-item";
        item.innerHTML = `
          <div class="search-item-title">${escapeHtml(paper.title)}</div>
          <div class="search-item-meta">
            ${escapeHtml(paper.authors || "Unknown")} • ${escapeHtml(paper.year || "N/A")} • 
            <strong>${escapeHtml(paper.source)}</strong> (${paper.word_count} words)
          </div>
          <div class="search-item-snippet">${escapeHtml(paper.abstract)}</div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem;">
            ${paper.url ? `<a href="${escapeHtml(paper.url)}" target="_blank" rel="noopener" class="btn btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.6rem;">View Original ↗</a>` : ""}
            <button class="btn btn-primary import-btn" data-index="${idx}" style="font-size: 0.78rem; padding: 0.3rem 0.75rem;">
              📥 Import Abstract
            </button>
          </div>
        `;

        item.querySelector(".import-btn").addEventListener("click", () => {
          document.getElementById("paperTitleInput").value = paper.title || "";
          document.getElementById("abstractInput").value = paper.abstract || "";
          document.getElementById("inputSourceHidden").value = `search:${paper.source.toLowerCase()}`;
          updateWordCount();
          switchToTab("tab-paste");
          window.scrollTo({ top: 0, behavior: "smooth" });
        });

        resultsContainer.appendChild(item);
      });
    } catch (err) {
      resultsContainer.innerHTML = `
        <div class="alert-banner danger">
          <span>Failed to search papers: ${escapeHtml(err.message)}</span>
        </div>
      `;
    }
  }

  if (searchBtn) searchBtn.addEventListener("click", performSearch);
  if (queryInput) {
    queryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        performSearch();
      }
    });
  }
}

// ---------------------------------------------------------------------------
// File Upload (PDF / TXT)
// ---------------------------------------------------------------------------
function initUpload() {
  const dropzone = document.getElementById("fileDropzone");
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener("click", () => fileInput.click());

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileUpload(files[0]);
  });

  fileInput.addEventListener("change", (e) => {
    if (fileInput.files.length > 0) handleFileUpload(fileInput.files[0]);
  });

  async function handleFileUpload(file) {
    const validExts = [".pdf", ".txt", ".md"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!validExts.includes(ext)) {
      uploadStatus.innerHTML = `
        <div class="alert-banner danger">
          Please upload a valid PDF or TXT document (.pdf, .txt, .md).
        </div>
      `;
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      uploadStatus.innerHTML = `
        <div class="alert-banner danger">
          File exceeds the maximum 15 MB limit.
        </div>
      `;
      return;
    }

    uploadStatus.innerHTML = `
      <div style="padding: 1rem; text-align: center;">
        <div class="spinner" style="width: 24px; height: 24px;"></div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Extracting abstract from ${escapeHtml(file.name)}...</p>
      </div>
    `;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        uploadStatus.innerHTML = `
          <div class="alert-banner danger">
            ${escapeHtml(data.error || "Failed to extract abstract from document.")}
          </div>
        `;
        return;
      }

      // Populate form
      document.getElementById("paperTitleInput").value = data.title || "";
      document.getElementById("abstractInput").value = data.abstract || "";
      document.getElementById("inputSourceHidden").value = `upload:${ext.replace(".", "")}`;
      updateWordCount();

      uploadStatus.innerHTML = `
        <div class="alert-banner info">
          ✅ Abstract successfully extracted from <strong>${escapeHtml(file.name)}</strong> (${data.word_count} words). Redirecting to editor...
        </div>
      `;

      setTimeout(() => {
        uploadStatus.innerHTML = "";
        switchToTab("tab-paste");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 1000);
    } catch (err) {
      uploadStatus.innerHTML = `
        <div class="alert-banner danger">
          Upload failed: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

// ---------------------------------------------------------------------------
// Abstract Evaluation Workflow
// ---------------------------------------------------------------------------
function initEvaluate() {
  const evaluateBtn = document.getElementById("evaluateBtn");
  const abstractInput = document.getElementById("abstractInput");
  const titleInput = document.getElementById("paperTitleInput");
  const promptSelect = document.getElementById("promptVersionSelect");
  const sourceHidden = document.getElementById("inputSourceHidden");

  const loadingBox = document.getElementById("evalLoadingBox");
  const resultsCard = document.getElementById("resultsCard");
  const errorBox = document.getElementById("evalErrorBox");

  if (!evaluateBtn) return;

  evaluateBtn.addEventListener("click", async () => {
    const abstract = abstractInput.value.trim();
    const title = titleInput.value.trim();
    const promptVersion = promptSelect.value;
    const source = sourceHidden.value || "paste";

    errorBox.style.display = "none";
    errorBox.innerHTML = "";

    if (!abstract) {
      errorBox.style.display = "block";
      errorBox.innerHTML = `
        <div class="alert-banner danger">
          Please enter or import an abstract before evaluating.
        </div>
      `;
      return;
    }

    // Enter loading state
    evaluateBtn.disabled = true;
    loadingBox.classList.add("active");
    resultsCard.classList.remove("active");

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abstract: abstract,
          title: title,
          source: source,
          prompt_version: promptVersion,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        errorBox.style.display = "block";
        errorBox.innerHTML = `
          <div class="alert-banner danger">
            ⛔ <strong>Evaluation Rejected:</strong> ${escapeHtml(data.error || "Unknown error occurred.")}
          </div>
        `;
        return;
      }

      renderResults(data);
      loadHistory(); // Refresh history table
    } catch (err) {
      errorBox.style.display = "block";
      errorBox.innerHTML = `
        <div class="alert-banner danger">
          Server connection error: ${escapeHtml(err.message)}
        </div>
      `;
    } finally {
      evaluateBtn.disabled = false;
      loadingBox.classList.remove("active");
    }
  });
}

// ---------------------------------------------------------------------------
// Render Evaluation Results
// ---------------------------------------------------------------------------
function renderResults(data) {
  const resultsCard = document.getElementById("resultsCard");
  resultsCard.classList.add("active");

  // 1. Total Score & Grade
  const total = data.total_score;
  const scoreNum = document.getElementById("resTotalScore");
  const scoreGrade = document.getElementById("resScoreGrade");
  scoreNum.textContent = total;

  let gradeLabel = "Excellent";
  let gradeBg = "var(--success-bg)";
  let gradeColor = "var(--success)";

  if (total >= 16) {
    gradeLabel = "Excellent 🌟";
    gradeBg = "var(--success-bg)";
    gradeColor = "var(--success)";
  } else if (total >= 12) {
    gradeLabel = "Good 👍";
    gradeBg = "var(--primary-light)";
    gradeColor = "var(--primary)";
  } else if (total >= 8) {
    gradeLabel = "Needs Work ⚠️";
    gradeBg = "var(--warning-bg)";
    gradeColor = "var(--warning)";
  } else {
    gradeLabel = "Weak / Incomplete ❌";
    gradeBg = "var(--danger-bg)";
    gradeColor = "var(--danger)";
  }

  scoreGrade.textContent = gradeLabel;
  scoreGrade.style.backgroundColor = gradeBg;
  scoreGrade.style.color = gradeColor;

  // Metadata badge
  const metaSpan = document.getElementById("resMetaInfo");
  metaSpan.innerHTML = `
    <span><strong>Model:</strong> <code>${escapeHtml(data.llm.model || data.llm.provider)}</code></span>
    <span>• <strong>Prompt:</strong> <code>${escapeHtml(data.prompt_version)}</code></span>
    <span>• <strong>Latency:</strong> ${data.elapsed_seconds}s</span>
    <span>• <strong>Words:</strong> ${data.word_count}</span>
  `;

  // 2. Prompt Injection Warning Banner
  const injectionBanner = document.getElementById("resInjectionBanner");
  if (data.injection_detected) {
    injectionBanner.style.display = "flex";
    injectionBanner.innerHTML = `
      <span>🛡️ <strong>Security Alert: Prompt Injection Attempt Detected!</strong> The abstract contained instructions attempting to manipulate scoring. Instructions were ignored and the abstract was scored strictly on genuine academic content.</span>
    `;
  } else {
    injectionBanner.style.display = "none";
  }

  // 3. Rubric Items Breakdown
  const itemsContainer = document.getElementById("resItemsContainer");
  itemsContainer.innerHTML = "";

  const items = data.scores || {};
  Object.keys(items).forEach((key) => {
    const item = items[key];
    const score = item.score;
    const barClass = `bar-${score}`;

    const row = document.createElement("div");
    row.className = "score-item-row";

    const isEvFound = item.evidence_found !== false;
    const evStatusHtml = isEvFound
      ? `<span class="evidence-status found">✓ Found in abstract</span>`
      : `<span class="evidence-status missing" title="The LLM quote does not match the abstract text verbatim">⚠️ Possible Hallucination</span>`;

    row.innerHTML = `
      <div class="item-header">
        <span class="item-name">${escapeHtml(item.title || key)}</span>
        <span class="item-score-badge">${score} / 4</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${barClass}"></div>
      </div>
      <div class="item-reason">${escapeHtml(item.reason || "")}</div>
      <div class="item-evidence">
        <span class="evidence-text">“${escapeHtml(item.evidence)}”</span>
        ${evStatusHtml}
      </div>
    `;

    itemsContainer.appendChild(row);
  });

  // 4. Suggestions Section (for items <= 2)
  const sugBox = document.getElementById("resSuggestionsBox");
  const sugList = document.getElementById("resSuggestionsList");
  const suggestions = data.suggestions || [];

  if (suggestions.length > 0) {
    sugBox.style.display = "block";
    sugList.innerHTML = "";
    suggestions.forEach((sug) => {
      const card = document.createElement("div");
      card.className = "suggestion-card";
      card.innerHTML = `
        <div class="suggestion-item-title">🔧 Criterion: ${escapeHtml(sug.item)}</div>
        <div class="suggestion-issue"><strong>Issue:</strong> ${escapeHtml(sug.issue)}</div>
        <div class="suggestion-fix"><strong>Recommended Fix:</strong> ${escapeHtml(sug.fix)}</div>
      `;
      sugList.appendChild(card);
    });
  } else {
    sugBox.style.display = "none";
  }

  // 5. Validation Warnings
  const valBox = document.getElementById("resValidationBox");
  const valList = document.getElementById("resValidationList");
  const warnings = data.warnings || [];

  if (warnings.length > 0 && warnings[0] !== "none") {
    valBox.style.display = "block";
    valList.innerHTML = warnings.map((w) => `<li>• ${escapeHtml(w)}</li>`).join("");
  } else {
    valBox.style.display = "none";
  }

  // 6. Automation Status
  const autoBox = document.getElementById("resAutomationBox");
  const autoStatusText = document.getElementById("resAutoStatusText");
  const autoActionsList = document.getElementById("resAutoActionsList");

  if (data.automation) {
    autoBox.style.display = "block";
    const isTrig = data.automation.triggered;
    autoStatusText.innerHTML = isTrig
      ? `<span style="color: var(--danger); font-weight: 700;">🚨 Triggered (Score ${total} &le; ${data.automation.threshold})</span>`
      : `<span style="color: var(--success); font-weight: 700;">✅ Not Triggered (Score ${total} &gt; ${data.automation.threshold})</span>`;

    const acts = data.automation.actions || [];
    autoActionsList.innerHTML = acts
      .map(
        (a) => `
        <li>
          <strong>[${escapeHtml(a.action)}]</strong>: ${escapeHtml(a.status)} 
          <span style="color: var(--text-muted);">(${escapeHtml(a.details)})</span>
        </li>
      `
      )
      .join("");
  } else {
    autoBox.style.display = "none";
  }

  // Scroll smoothly to results
  resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------------
// History Table
// ---------------------------------------------------------------------------
async function loadHistory() {
  const tableBody = document.getElementById("historyTableBody");
  if (!tableBody) return;

  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    const rows = data.history || [];

    if (rows.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No evaluations recorded in results.xlsx yet. Evaluate your first abstract above!
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const ts = r.timestamp ? r.timestamp.replace("T", " ").substring(0, 19) : "";
      const total = parseInt(r.total || 0, 10);
      const isLow = total <= 10;

      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-size: 0.78rem;">${escapeHtml(ts)}</td>
        <td style="font-weight: 600;">${escapeHtml(r.title || "Untitled")}</td>
        <td><code>${escapeHtml(r.source || "paste")}</code></td>
        <td>${r.word_count || 0} w</td>
        <td>
          <span class="badge ${isLow ? "badge-mock" : "badge-live"}">
            ${total} / 20
          </span>
        </td>
        <td><small>${escapeHtml(r.model || "")}</small></td>
        <td><code>${escapeHtml(r.prompt_version || "")}</code></td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}

// ---------------------------------------------------------------------------
// Sample Abstract Loader (Helper for Demo / Testing)
// ---------------------------------------------------------------------------
function initSampleLoader() {
  const sampleBtn = document.getElementById("loadSampleBtn");
  if (!sampleBtn) return;

  const sampleAbstract =
    "Transformer models suffer from quadratic computational and memory complexity with respect to sequence length, creating a major bottleneck for long-document tasks. In this paper, we propose SparseFlash, an attention mechanism using adaptive block sparsification that dynamically selects salient key-value blocks during inference. We evaluated SparseFlash across 16 tasks in the LongBench benchmark on sequence lengths up to 64k tokens using Llama-3-8B. Our experiments demonstrate that SparseFlash achieves a 4.2x speedup in attention throughput and reduces peak memory consumption by 68% compared to standard FlashAttention-2, while retaining 98.4% of full-attention task accuracy. These results show that adaptive sparsification provides a scalable and practical solution for deploying 64k-context language models on commodity enterprise hardware without retraining.";

  sampleBtn.addEventListener("click", () => {
    document.getElementById("paperTitleInput").value = "SparseFlash: Adaptive Block-Sparse Attention for Long-Context LLMs";
    document.getElementById("abstractInput").value = sampleAbstract;
    document.getElementById("inputSourceHidden").value = "paste:sample";
    updateWordCount();
  });
}

// ---------------------------------------------------------------------------
// Document Ready Init
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  loadConfig();
  initSearch();
  initUpload();
  initEvaluate();
  initSampleLoader();
  loadHistory();

  const textarea = document.getElementById("abstractInput");
  if (textarea) {
    textarea.addEventListener("input", updateWordCount);
    updateWordCount();
  }
});
