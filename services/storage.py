"""
services/storage.py
===================
Thread-safe Excel storage engine using openpyxl.

Maintains three sheets:
  1. evaluations: Full record of every evaluated abstract.
  2. automation_log: Detailed log of automated actions (success/fail/skip).
  3. flagged_low_scores: Abstracts scoring <= LOW_SCORE_THRESHOLD.
"""

import io
import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

import config

logger = logging.getLogger(__name__)

# Global thread lock to prevent race conditions during concurrent requests
STORAGE_LOCK = threading.Lock()

# Sheet Schemas
EVALUATION_HEADERS = [
    "timestamp",
    "id",
    "source",
    "title",
    "prompt_version",
    "model",
    "status",
    "word_count",
    "score_purpose",
    "score_method",
    "score_results",
    "score_conclusion",
    "score_clarity",
    "total",
    "warnings",
    "suggestions_json",
    "seconds",
    "abstract",
]

AUTOMATION_HEADERS = [
    "timestamp",
    "run_id",
    "trigger_reason",
    "action",
    "status",
    "details",
]

FLAGGED_HEADERS = [
    "timestamp",
    "run_id",
    "title",
    "total_score",
    "lowest_item",
    "provider_model",
    "reason",
]


def _style_header(sheet, headers: List[str], fill_hex: str = "1E3A8A"):
    """Format the header row with clean colors and bold text."""
    fill = PatternFill(start_color=fill_hex, end_color=fill_hex, fill_type="solid")
    font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for col_idx, header in enumerate(headers, start=1):
        cell = sheet.cell(row=1, column=col_idx, value=header)
        cell.fill = fill
        cell.font = font
        cell.alignment = align
    sheet.row_dimensions[1].height = 26


def _init_workbook(path: Path) -> openpyxl.Workbook:
    """Initialize a new Excel workbook with the three required sheets."""
    path.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()

    # Sheet 1: evaluations
    ws_eval = wb.active
    ws_eval.title = "evaluations"
    _style_header(ws_eval, EVALUATION_HEADERS, fill_hex="1E3A8A")

    # Sheet 2: automation_log
    ws_auto = wb.create_sheet(title="automation_log")
    _style_header(ws_auto, AUTOMATION_HEADERS, fill_hex="047857")

    # Sheet 3: flagged_low_scores
    ws_flag = wb.create_sheet(title="flagged_low_scores")
    _style_header(ws_flag, FLAGGED_HEADERS, fill_hex="B91C1C")

    wb.save(path)
    return wb


def _get_or_create_workbook(path: Path) -> openpyxl.Workbook:
    """Open existing workbook or initialize a new one with correct sheets."""
    if not path.exists():
        return _init_workbook(path)

    try:
        wb = openpyxl.load_workbook(path)
    except Exception as e:
        logger.warning(f"Could not load workbook at {path} ({e}). Re-initializing.")
        return _init_workbook(path)

    # Ensure all required sheets exist
    if "evaluations" not in wb.sheetnames:
        ws = wb.create_sheet(title="evaluations", index=0)
        _style_header(ws, EVALUATION_HEADERS, fill_hex="1E3A8A")
    if "automation_log" not in wb.sheetnames:
        ws = wb.create_sheet(title="automation_log")
        _style_header(ws, AUTOMATION_HEADERS, fill_hex="047857")
    if "flagged_low_scores" not in wb.sheetnames:
        ws = wb.create_sheet(title="flagged_low_scores")
        _style_header(ws, FLAGGED_HEADERS, fill_hex="B91C1C")

    return wb


def save_evaluation(row: Dict[str, Any], excel_path: Optional[Path] = None) -> None:
    """Append a completed evaluation record to the 'evaluations' sheet."""
    target_path = excel_path or config.RESULTS_FILE
    with STORAGE_LOCK:
        wb = _get_or_create_workbook(target_path)
        ws = wb["evaluations"]

        values = [
            str(row.get("timestamp", datetime.now(timezone.utc).isoformat())),
            str(row.get("id", "")),
            str(row.get("source", "paste")),
            str(row.get("title", "")),
            str(row.get("prompt_version", "score_v3")),
            str(row.get("model", "")),
            str(row.get("status", "completed")),
            int(row.get("word_count", 0)),
            int(row.get("score_purpose", 0)),
            int(row.get("score_method", 0)),
            int(row.get("score_results", 0)),
            int(row.get("score_conclusion", 0)),
            int(row.get("score_clarity", 0)),
            int(row.get("total", 0)),
            str(row.get("warnings", "none")),
            json.dumps(row.get("suggestions", [])) if isinstance(row.get("suggestions"), (list, dict)) else str(row.get("suggestions", "")),
            float(row.get("seconds", 0.0)),
            str(row.get("abstract", "")),
        ]
        ws.append(values)
        wb.save(target_path)
        logger.info(f"Evaluation '{row.get('id')}' written to {target_path}")


def log_automation(log_entry: Dict[str, Any], excel_path: Optional[Path] = None) -> None:
    """Record an automation event in the 'automation_log' sheet."""
    target_path = excel_path or config.RESULTS_FILE
    with STORAGE_LOCK:
        wb = _get_or_create_workbook(target_path)
        ws = wb["automation_log"]

        values = [
            str(log_entry.get("timestamp", datetime.now(timezone.utc).isoformat())),
            str(log_entry.get("run_id", "")),
            str(log_entry.get("trigger_reason", "")),
            str(log_entry.get("action", "")),
            str(log_entry.get("status", "")),
            str(log_entry.get("details", "")),
        ]
        ws.append(values)
        wb.save(target_path)


def flag_low_score(flag_entry: Dict[str, Any], excel_path: Optional[Path] = None) -> None:
    """Record a low-scoring abstract in the 'flagged_low_scores' sheet."""
    target_path = excel_path or config.RESULTS_FILE
    with STORAGE_LOCK:
        wb = _get_or_create_workbook(target_path)
        ws = wb["flagged_low_scores"]

        values = [
            str(flag_entry.get("timestamp", datetime.now(timezone.utc).isoformat())),
            str(flag_entry.get("run_id", "")),
            str(flag_entry.get("title", "Untitled")),
            int(flag_entry.get("total_score", 0)),
            str(flag_entry.get("lowest_item", "")),
            str(flag_entry.get("provider_model", "")),
            str(flag_entry.get("reason", "")),
        ]
        ws.append(values)
        wb.save(target_path)


def get_history(limit: int = 50, excel_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Retrieve recent evaluation records from the Excel spreadsheet."""
    target_path = excel_path or config.RESULTS_FILE
    if not target_path.exists():
        return []

    with STORAGE_LOCK:
        try:
            wb = openpyxl.load_workbook(target_path, data_only=True)
            if "evaluations" not in wb.sheetnames:
                return []
            ws = wb["evaluations"]
            rows = list(ws.iter_rows(values_only=True))
            if len(rows) <= 1:
                return []

            headers = [str(h) for h in rows[0]]
            data_rows = rows[1:]

            results = []
            # Return newest entries first
            for r in reversed(data_rows):
                if not any(r):
                    continue
                row_dict = {}
                for idx, h in enumerate(headers):
                    val = r[idx] if idx < len(r) else ""
                    row_dict[h] = val
                results.append(row_dict)
                if len(results) >= limit:
                    break

            return results
        except Exception as e:
            logger.error(f"Error reading history from {target_path}: {e}")
            return []


def get_workbook_bytes(excel_path: Optional[Path] = None) -> bytes:
    """Read the full Excel workbook into bytes for downloading."""
    target_path = excel_path or config.RESULTS_FILE
    with STORAGE_LOCK:
        wb = _get_or_create_workbook(target_path)
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        return stream.getvalue()
