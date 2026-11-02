"""
config.py
=========
Global configuration, rubric specifications, and environment setup
for the Research Abstract Evaluator.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# Directories & File Paths
# ---------------------------------------------------------------------------
PROMPTS_DIR = BASE_DIR / "prompts"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

RESULTS_FILE = Path(os.getenv("RESULTS_FILE", DATA_DIR / "results.xlsx"))
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", DATA_DIR / "abstriq.db"))
SECRET_KEY = os.getenv("SECRET_KEY", "abstriq-v2-super-secret-key-production-change-2026")
SESSION_EXPIRE_DAYS = int(os.getenv("SESSION_EXPIRE_DAYS", "14"))
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "60"))

# ---------------------------------------------------------------------------
# Firebase & Cloud Firestore Configuration
# ---------------------------------------------------------------------------
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "abstriq-academic").strip()
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", f"{FIREBASE_PROJECT_ID}.appspot.com").strip()
FIREBASE_CREDENTIALS_PATH = os.getenv(
    "FIREBASE_CREDENTIALS_PATH",
    str(BASE_DIR / "credentials" / "firebase_service_account.json")
).strip()
FIREBASE_USE_EMULATOR = os.getenv("FIREBASE_USE_EMULATOR", "false").lower() in ("true", "1", "yes")



# ---------------------------------------------------------------------------
# LLM Provider Configuration
# ---------------------------------------------------------------------------
# Supported: 'mock', 'gemini', 'openai', 'anthropic', 'nvidia', 'inception'
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mock").strip().lower()
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()

# Default models per provider if LLM_MODEL is not set
DEFAULT_MODELS = {
    "mock": "heuristic-rule-engine-v1",
    "gemini": "gemini-1.5-flash",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-20241022",
    "nvidia": "mistralai/mistral-large-2-instruct",
    "inception": "mercury-3",
}

# ---------------------------------------------------------------------------
# Thresholds and Validation Limits
# ---------------------------------------------------------------------------
LOW_SCORE_THRESHOLD = int(os.getenv("LOW_SCORE_THRESHOLD", "10"))
MAX_UPLOAD_SIZE_MB = 15
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

MIN_WORD_COUNT = 40
MAX_WORD_COUNT = 450
IDEAL_MIN_WORDS = 120
IDEAL_MAX_WORDS = 250

# ---------------------------------------------------------------------------
# Automation & Notification Settings
# ---------------------------------------------------------------------------
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "").strip()

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587")) if os.getenv("SMTP_PORT") else 587
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
ALERT_EMAIL_TO = os.getenv("ALERT_EMAIL_TO", "").strip()
ALERT_EMAIL_FROM = os.getenv("ALERT_EMAIL_FROM", SMTP_USER).strip()

# ---------------------------------------------------------------------------
# Rubric Definition (5 items x 0-4 = 20 marks total)
# ---------------------------------------------------------------------------
RUBRIC_ITEMS = ["purpose", "method", "results", "conclusion", "clarity"]

RUBRIC = {
    "purpose": {
        "title": "Purpose (Problem, Gap, Aim)",
        "weight": 4,
        "description": "Clear articulation of the research problem, specific gap in existing literature, and explicit objective.",
        "levels": {
            4: "Explicit research problem, clearly identified research gap, and stated objective.",
            3: "Problem and aim are clearly stated, but the research gap is implicit.",
            2: "General domain topic mentioned, but specific problem or research aim is vague.",
            1: "Generic background statements without a distinct objective.",
            0: "Missing, irrelevant, or not found.",
        },
    },
    "method": {
        "title": "Method (Approach, Data, Setup)",
        "weight": 4,
        "description": "Concrete description of algorithm, model architecture, dataset, and experimental setup.",
        "levels": {
            4: "Explicit algorithm/model, benchmark dataset(s), and experimental framework specified.",
            3: "Core approach and dataset mentioned, but setup/hyperparameters or validation scheme are sparse.",
            2: "High-level methodology mentioned (e.g., 'we use deep learning') without technical specifics.",
            1: "Vague allusion to an approach without actionable details.",
            0: "Methodology completely absent or not found.",
        },
    },
    "results": {
        "title": "Results (Findings, Numbers, Comparison)",
        "weight": 4,
        "description": "Concrete numerical findings reported with baseline comparisons and metrics.",
        "levels": {
            4: "Concrete quantitative findings reported with baseline comparisons (e.g. accuracy, speedup, p-value).",
            3: "Specific quantitative results reported, but direct comparison against prior art is lacking.",
            2: "Purely qualitative claims (e.g. 'outperforms baselines') without quantitative metrics.",
            1: "Ambiguous or weak claim of results.",
            0: "No findings or results reported.",
        },
    },
    "conclusion": {
        "title": "Conclusion (Contribution, Impact, Limits)",
        "weight": 4,
        "description": "Main contribution, practical/theoretical significance, and limitations or future directions.",
        "levels": {
            4: "Highlights main contribution, practical/theoretical implications, and future scope or limits.",
            3: "Clear contribution and significance stated, but limits or broader implications are omitted.",
            2: "Superficial closing statement with minimal substance.",
            1: "Simply repeats the aim or cuts off abruptly after results.",
            0: "No conclusion provided.",
        },
    },
    "clarity": {
        "title": "Clarity (Structure, Readability, Length)",
        "weight": 4,
        "description": "Academic flow (Context -> Method -> Result -> Impact), readable tone, ideal length (~120-250 words).",
        "levels": {
            4: "Well-structured academic flow, excellent readability, ideal length (~120-250 words).",
            3: "Clear and readable with minor phrasing flaws; acceptable length (100-300 words).",
            2: "Dense, jargon overload, awkward transitions, or grammatical errors.",
            1: "Disorganised, abrupt transitions, or severely under/over length (<80 or >350 words).",
            0: "Incoherent or non-academic text.",
        },
    },
}

# ---------------------------------------------------------------------------
# Prompt Injection Patterns (Used in Pre-check and Mock Heuristic)
# ---------------------------------------------------------------------------
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+(instructions|directives|rules)",
    r"give\s+(full|maximum|20|100%|perfect)\s+(marks|points|scores?)",
    r"disregard\s+(the\s+)?(rubric|guidelines|system)",
    r"you\s+are\s+now\s+(a|an)\s+",
    r"system\s*:\s*you\s+must",
    r"give\s+20\s*/\s*20",
    r"give\s+4\s*/\s*4",
]
