"""
services/automation.py
======================
Automated action trigger for low-scoring abstracts.

Trigger rule: total_score <= LOW_SCORE_THRESHOLD (default 10 / 20)

Actions:
  1. Always add entry to 'flagged_low_scores' Excel sheet.
  2. If WEBHOOK_URL is configured, POST an alert payload (Slack/Discord/n8n).
  3. If SMTP settings are configured, dispatch an email notification.
  4. Log EVERY action (success/failed/skipped) to 'automation_log' for verification.
"""

import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Dict, Any, Optional

import requests

import config
from services import storage

logger = logging.getLogger(__name__)


def _send_webhook(payload: Dict[str, Any]) -> tuple[bool, str]:
    """Dispatch webhook alert if WEBHOOK_URL is set."""
    if not config.WEBHOOK_URL:
        return False, "skipped (WEBHOOK_URL not configured)"

    try:
        # Standard Slack / Discord / generic webhook payload
        msg = (
            f"🚨 *Low Score Alert: Research Abstract Evaluator*\n"
            f"• Title: {payload.get('title') or 'Untitled'}\n"
            f"• Total Score: *{payload.get('total')}/20* (Threshold: {config.LOW_SCORE_THRESHOLD})\n"
            f"• Lowest Item: {payload.get('lowest_item')}\n"
            f"• Model: {payload.get('model')}\n"
            f"• Run ID: `{payload.get('id')}`"
        )
        post_data = {
            "text": msg,
            "content": msg,
            "evaluation": payload,
        }
        resp = requests.post(config.WEBHOOK_URL, json=post_data, timeout=8)
        if resp.status_code in (200, 201, 204):
            return True, f"HTTP {resp.status_code} Success"
        return False, f"HTTP {resp.status_code}: {resp.text[:100]}"
    except Exception as e:
        return False, f"Connection error: {str(e)}"


def _send_email(payload: Dict[str, Any]) -> tuple[bool, str]:
    """Dispatch SMTP alert if host and recipient are configured."""
    if not (config.SMTP_HOST and config.ALERT_EMAIL_TO):
        return False, "skipped (SMTP settings not configured)"

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[Alert] Low Scoring Abstract ({payload.get('total')}/20) - {payload.get('title') or 'Untitled'}"
        msg["From"] = config.ALERT_EMAIL_FROM or "evaluator@university.edu"
        msg["To"] = config.ALERT_EMAIL_TO

        body = f"""Hello,

An evaluated research abstract received a low overall score:

Title: {payload.get('title') or 'Untitled'}
Run ID: {payload.get('id')}
Total Score: {payload.get('total')} / 20 (Trigger Threshold: <= {config.LOW_SCORE_THRESHOLD})
Lowest Scoring Item: {payload.get('lowest_item')}
Model: {payload.get('model')}

Abstract Excerpt:
\"\"\"{payload.get('abstract', '')[:300]}...\"\"\"

Please review the evaluation in results.xlsx.
"""
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as server:
            server.starttls()
            if config.SMTP_USER and config.SMTP_PASSWORD:
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)

        return True, f"Sent email to {config.ALERT_EMAIL_TO}"
    except Exception as e:
        return False, f"SMTP Error: {str(e)}"


def run_automation(eval_row: Dict[str, Any], excel_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Evaluate trigger condition and execute automated actions.
    Logs every action to the Excel automation_log sheet.
    """
    total = int(eval_row.get("total", 0))
    run_id = eval_row.get("id", "unknown")
    title = eval_row.get("title", "Untitled")
    now_iso = datetime.now(timezone.utc).isoformat()

    # Determine lowest scoring item
    scores = {
        "purpose": eval_row.get("score_purpose", 0),
        "method": eval_row.get("score_method", 0),
        "results": eval_row.get("score_results", 0),
        "conclusion": eval_row.get("score_conclusion", 0),
        "clarity": eval_row.get("score_clarity", 0),
    }
    lowest_item = min(scores.items(), key=lambda x: x[1])[0]

    actions_taken = []
    is_triggered = total <= config.LOW_SCORE_THRESHOLD

    if not is_triggered:
        # Log trigger check as passing without need for alert
        status_msg = f"Score {total}/20 exceeds threshold {config.LOW_SCORE_THRESHOLD}; alert trigger not activated."
        storage.log_automation({
            "timestamp": now_iso,
            "run_id": run_id,
            "trigger_reason": f"total_score ({total}) > threshold ({config.LOW_SCORE_THRESHOLD})",
            "action": "check_threshold",
            "status": "passed",
            "details": status_msg,
        }, excel_path=excel_path)

        return {
            "triggered": False,
            "threshold": config.LOW_SCORE_THRESHOLD,
            "total_score": total,
            "summary": "Score above threshold. No automated alert required.",
            "actions": [{"action": "threshold_check", "status": "passed", "details": status_msg}],
        }

    # --- Condition Met: Trigger Active ---
    trigger_reason = f"total_score ({total}/20) <= threshold ({config.LOW_SCORE_THRESHOLD})"

    # 1. Action: Flag in Excel
    try:
        storage.flag_low_score({
            "timestamp": now_iso,
            "run_id": run_id,
            "title": title,
            "total_score": total,
            "lowest_item": f"{lowest_item} ({scores[lowest_item]}/4)",
            "provider_model": eval_row.get("model", ""),
            "reason": trigger_reason,
        }, excel_path=excel_path)

        flag_status = "success"
        flag_details = f"Appended row to flagged_low_scores sheet (Lowest item: {lowest_item})"
    except Exception as e:
        flag_status = "failed"
        flag_details = f"Failed to append to flagged_low_scores: {e}"

    storage.log_automation({
        "timestamp": now_iso,
        "run_id": run_id,
        "trigger_reason": trigger_reason,
        "action": "excel_flag_sheet",
        "status": flag_status,
        "details": flag_details,
    }, excel_path=excel_path)
    actions_taken.append({"action": "flag_sheet", "status": flag_status, "details": flag_details})

    # 2. Action: Webhook
    payload = dict(eval_row)
    payload["lowest_item"] = lowest_item
    wh_ok, wh_details = _send_webhook(payload)
    wh_status = "success" if wh_ok else ("skipped" if "skipped" in wh_details else "failed")

    storage.log_automation({
        "timestamp": now_iso,
        "run_id": run_id,
        "trigger_reason": trigger_reason,
        "action": "webhook_post",
        "status": wh_status,
        "details": wh_details,
    }, excel_path=excel_path)
    actions_taken.append({"action": "webhook", "status": wh_status, "details": wh_details})

    # 3. Action: Email
    email_ok, email_details = _send_email(payload)
    email_status = "success" if email_ok else ("skipped" if "skipped" in email_details else "failed")

    storage.log_automation({
        "timestamp": now_iso,
        "run_id": run_id,
        "trigger_reason": trigger_reason,
        "action": "email_notification",
        "status": email_status,
        "details": email_details,
    }, excel_path=excel_path)
    actions_taken.append({"action": "email", "status": email_status, "details": email_details})

    return {
        "triggered": True,
        "threshold": config.LOW_SCORE_THRESHOLD,
        "total_score": total,
        "summary": f"Low score alert triggered ({total}/20 <= {config.LOW_SCORE_THRESHOLD}). Actions logged.",
        "actions": actions_taken,
    }
