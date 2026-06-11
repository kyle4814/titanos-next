"""
Flask route handler for the /scan-request form on titanos.tech.

DEPLOYMENT STATUS — 2026-06-11 — NOT DEPLOYED
─────────────────────────────────────────────
api.titanos.tech is currently NXDOMAIN (the apex hosting was unplugged
2026-06-02 — see memory/project_titanos_phone_independent_2026-06-01.md).
Until the Cloudflare CNAME for api.titanos.tech is restored and the
dashboard.py app is back up, this route does not resolve and form
submissions on titanos.tech fall back to the mailto error link.

WHERE THIS GOES
───────────────
Bolt the handler onto /home/userland/clawd/products/vuln_scanner/dashboard.py
beside the existing /scan/request route (which is the legacy form
endpoint from before the static-site flip). Import path stays the same,
the route just gets registered through Flask's @app.route decorator.

WHAT IT DOES
────────────
1. Reads JSON body  → domain, name, email, optional notes, source.
2. Re-validates server-side — never trust client validation alone.
3. Rate-limits by IP (10/hour, in-memory deque; sufficient for current
   volume — replace with Redis if traffic grows).
4. Appends to the existing scan-request lead store
   (leads/scan_requests.jsonl in the vuln_scanner runtime).
5. Fires a notification email to kyle@titanos.tech via the existing
   send_titanos helper so Kyle sees the request without opening the
   server.
6. Returns 202 Accepted on success, 4xx with a JSON message on
   validation failure, 5xx on internal failure (the client form falls
   back to mailto on any non-2xx).

CORS
────
The static site lives on titanos.tech and the API on
api.titanos.tech — different origins. The route must respond with
Access-Control-Allow-Origin: https://titanos.tech (NOT *) and Allow
the standard preflight headers, OR the form will be blocked by the
browser before it ever reaches Flask.

CSP (on the static site) is already set to allow connect-src to
api.titanos.tech (see app/layout.tsx).
"""

from __future__ import annotations

import json
import os
import re
import smtplib
import time
from collections import deque
from email.message import EmailMessage
from pathlib import Path
from threading import Lock

from flask import Blueprint, jsonify, request

scan_request_bp = Blueprint("scan_request", __name__)

# --- Configuration (read from env at import time) ------------------------------

LEAD_STORE = Path(
    os.environ.get(
        "TITANOS_SCAN_REQUEST_STORE",
        "/home/userland/clawd/products/vuln_scanner/leads/scan_requests.jsonl",
    )
)
NOTIFY_EMAIL = os.environ.get("TITANOS_OUTREACH_USER", "kyle@titanos.tech")
SMTP_HOST = os.environ.get("TITANOS_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("TITANOS_SMTP_PORT", "587"))
SMTP_PASSWORD = os.environ.get("TITANOS_OUTREACH_PASSWORD", "")
ALLOWED_ORIGIN = os.environ.get(
    "TITANOS_FORM_ALLOWED_ORIGIN", "https://titanos.tech"
)

HOSTNAME_RE = re.compile(
    r"^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?$",
    re.IGNORECASE,
)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# --- Rate limit (in-memory) ----------------------------------------------------

_RATE_WINDOW_S = 3600
_RATE_LIMIT_PER_WINDOW = 10
_buckets: dict[str, deque[float]] = {}
_buckets_lock = Lock()


def _rate_limit_ok(ip: str) -> bool:
    now = time.time()
    with _buckets_lock:
        q = _buckets.setdefault(ip, deque())
        while q and q[0] < now - _RATE_WINDOW_S:
            q.popleft()
        if len(q) >= _RATE_LIMIT_PER_WINDOW:
            return False
        q.append(now)
    return True


# --- Helpers -------------------------------------------------------------------

def _normalise_domain(raw: str) -> str:
    cleaned = raw.strip().lower()
    cleaned = re.sub(r"^https?://", "", cleaned)
    cleaned = re.sub(r"/.*$", "", cleaned)
    cleaned = re.sub(r"^www\.", "", cleaned)
    return cleaned


def _append_lead(payload: dict) -> None:
    LEAD_STORE.parent.mkdir(parents=True, exist_ok=True)
    with LEAD_STORE.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(payload, separators=(",", ":")) + "\n")


def _notify(payload: dict) -> None:
    if not SMTP_PASSWORD:
        # No SMTP wired — skip notification rather than fail the request.
        return
    body = (
        f"New scan request from {payload['name']}\n"
        f"Domain : {payload['domain']}\n"
        f"Email  : {payload['email']}\n"
        f"Notes  : {payload.get('notes') or '(none)'}\n"
        f"Source : {payload.get('source') or '(unknown)'}\n"
        f"At     : {payload['submitted_at']}\n"
    )
    msg = EmailMessage()
    msg["Subject"] = f"[scan-request] {payload['domain']}"
    msg["From"] = NOTIFY_EMAIL
    msg["To"] = NOTIFY_EMAIL
    msg.set_content(body)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.starttls()
        s.login(NOTIFY_EMAIL, SMTP_PASSWORD)
        s.send_message(msg)


def _cors_headers() -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin",
    }


# --- Route ---------------------------------------------------------------------

@scan_request_bp.route("/scan-request", methods=["POST", "OPTIONS"])
def scan_request():
    if request.method == "OPTIONS":
        return ("", 204, _cors_headers())

    ip = request.headers.get("CF-Connecting-IP") or request.remote_addr or "0.0.0.0"
    if not _rate_limit_ok(ip):
        return jsonify({"error": "rate_limited"}), 429, _cors_headers()

    try:
        data = request.get_json(force=True, silent=False) or {}
    except Exception:
        return jsonify({"error": "invalid_json"}), 400, _cors_headers()

    domain = _normalise_domain(str(data.get("domain", "")))
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    notes = str(data.get("notes", "")).strip()[:2000]
    source = str(data.get("source", "")).strip()[:200]
    submitted_at = str(data.get("submitted_at", "")).strip()[:64] or _iso_now()

    errors: dict[str, str] = {}
    if not domain or not HOSTNAME_RE.match(domain):
        errors["domain"] = "domain_invalid"
    if not name:
        errors["name"] = "name_required"
    if not email or not EMAIL_RE.match(email):
        errors["email"] = "email_invalid"
    if errors:
        return jsonify({"error": "validation", "fields": errors}), 422, _cors_headers()

    payload = {
        "domain": domain,
        "name": name,
        "email": email,
        "notes": notes,
        "source": source,
        "ip": ip,
        "submitted_at": submitted_at,
    }
    try:
        _append_lead(payload)
    except Exception as exc:
        return jsonify({"error": "store_failed", "detail": str(exc)}), 500, _cors_headers()

    try:
        _notify(payload)
    except Exception:
        # Notification failure must not fail the request — the lead is
        # already persisted and Kyle will see it on the next inbox sweep.
        pass

    return jsonify({"ok": True}), 202, _cors_headers()


def _iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# Registration hint:
#   from ops.flask_scan_request_route import scan_request_bp
#   app.register_blueprint(scan_request_bp)
