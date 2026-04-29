#!/usr/bin/python3
"""Postfix pipe-transport target.

Reads a raw RFC822 message from stdin and POSTs it to the FastAPI
inbound-email webhook. Stdlib only — no pip install in the postfix image.

Exit codes obey Postfix's pipe(8) conventions:

    0   delivered (we got 200/202, OR the webhook said 4xx — drop, do not retry)
    75  EX_TEMPFAIL — Postfix will queue and retry (network error / 5xx)
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request

DEFAULT_URL = "http://api:8000/webhooks/inbound-email"
TIMEOUT = 30


def _log(msg: str) -> None:
    # Postfix captures stderr from pipe deliveries and routes it to the mail
    # log, which is what `docker compose logs postfix` shows.
    sys.stderr.write(f"inbound.py: {msg}\n")
    sys.stderr.flush()


def main() -> int:
    url = os.environ.get("INBOUND_WEBHOOK_URL", DEFAULT_URL)
    secret = os.environ.get("INBOUND_EMAIL_SECRET", "")
    if not secret:
        _log("INBOUND_EMAIL_SECRET is empty; refusing to forward (TEMPFAIL)")
        return 75

    body = sys.stdin.buffer.read()
    if not body:
        _log("empty stdin; nothing to forward — dropping")
        return 0

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "message/rfc822",
            "X-Inbound-Secret": secret,
            "Content-Length": str(len(body)),
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            status = resp.status
            _log(f"webhook accepted message: HTTP {status}")
            return 0
    except urllib.error.HTTPError as exc:
        if 400 <= exc.code < 500:
            # Permanent — the webhook rejected the message (bad secret,
            # bad MIME, etc). Retrying won't help; drop and log.
            _log(f"webhook returned HTTP {exc.code}; dropping message")
            return 0
        _log(f"webhook returned HTTP {exc.code}; tempfail")
        return 75
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
        _log(f"network error talking to webhook: {exc}; tempfail")
        return 75


if __name__ == "__main__":
    sys.exit(main())
