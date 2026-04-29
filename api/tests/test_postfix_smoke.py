"""Opt-in end-to-end smoke test for the deploy/postfix container.

Builds the postfix Docker image, runs it on an ephemeral SMTP port, sends
a synthesised RFC822 message via smtplib, and asserts that the pipe
script forwarded the body to a tiny stdlib HTTP server with the right
headers and matching body bytes.

Skipped by default. Set RUN_INTEGRATION=1 to opt in. Requires:

    - docker (and the calling user can run `docker build` / `docker run`)
    - free TCP ports on localhost (the test picks them dynamically)

The smoke test deliberately uses no extra Python deps — it simulates
the FastAPI webhook with `http.server` and the broker MTA with
`smtplib`. This keeps it usable from a developer laptop where port 25
is firewalled at the ISP.
"""

from __future__ import annotations

import http.server
import os
import smtplib
import socket
import subprocess
import threading
import time
import uuid
from email.message import EmailMessage
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
POSTFIX_DIR = REPO_ROOT / "deploy" / "postfix"

SECRET = "smoke-secret-" + uuid.uuid4().hex[:8]
IMAGE_TAG = "boliganalyse-postfix-smoke:" + uuid.uuid4().hex[:8]


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class _CaptureHandler(http.server.BaseHTTPRequestHandler):
    received: list[dict[str, object]] = []

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b""
        self.received.append(
            {
                "path": self.path,
                "secret": self.headers.get("X-Inbound-Secret"),
                "content_type": self.headers.get("Content-Type"),
                "body": body,
            }
        )
        self.send_response(202)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *_args: object, **_kwargs: object) -> None:
        # Quiet — pytest captures stderr by default but we don't want the noise.
        return


@pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION") != "1",
    reason="set RUN_INTEGRATION=1 to build + run the postfix container",
)
def test_postfix_pipes_inbound_message_to_webhook() -> None:
    # ---------------------------------------------------------------- build
    build = subprocess.run(
        ["docker", "build", "-t", IMAGE_TAG, str(POSTFIX_DIR)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert build.returncode == 0, (
        f"docker build failed:\nstdout:\n{build.stdout}\nstderr:\n{build.stderr}"
    )

    # ---------------------------------------------------- fake webhook server
    _CaptureHandler.received.clear()
    http_port = _free_port()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", http_port), _CaptureHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    smtp_port = _free_port()
    container_name = "boliganalyse-postfix-smoke-" + uuid.uuid4().hex[:8]

    try:
        # `host.docker.internal` resolves to the host on Docker Desktop and
        # via --add-host on Linux. We add it explicitly for portability.
        run = subprocess.run(
            [
                "docker", "run", "-d",
                "--name", container_name,
                "--add-host=host.docker.internal:host-gateway",
                "-p", f"{smtp_port}:25",
                "-e", f"INBOUND_EMAIL_SECRET={SECRET}",
                "-e", f"INBOUND_WEBHOOK_URL=http://host.docker.internal:{http_port}/webhooks/inbound-email",
                IMAGE_TAG,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        assert run.returncode == 0, f"docker run failed: {run.stderr}"

        # Wait for postfix to bind port 25 inside the container.
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                with socket.create_connection(("127.0.0.1", smtp_port), timeout=2):
                    break
            except OSError:
                time.sleep(0.5)
        else:
            pytest.fail("postfix did not start listening within 30s")

        # ----------------------------------------------------------- send mail
        msg = EmailMessage()
        msg["From"] = "broker@home.dk"
        msg["To"] = "abc123@inbox.boliganalyse.ai"
        msg["Subject"] = "smoke test"
        msg.set_content("hello from the smoke test")

        with smtplib.SMTP("127.0.0.1", smtp_port, timeout=10) as smtp:
            smtp.send_message(msg)

        # ------------------------------------------------------- await delivery
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline and not _CaptureHandler.received:
            time.sleep(0.25)

        assert _CaptureHandler.received, "webhook never saw the inbound message"
        captured = _CaptureHandler.received[0]
        assert captured["path"] == "/webhooks/inbound-email"
        assert captured["secret"] == SECRET
        assert captured["content_type"] == "message/rfc822"
        body = captured["body"]
        assert isinstance(body, bytes) and b"smoke test" in body
        assert b"abc123@inbox.boliganalyse.ai" in body
    finally:
        subprocess.run(
            ["docker", "rm", "-f", container_name],
            capture_output=True,
            check=False,
        )
        server.shutdown()
        server.server_close()
        subprocess.run(
            ["docker", "image", "rm", "-f", IMAGE_TAG],
            capture_output=True,
            check=False,
        )
