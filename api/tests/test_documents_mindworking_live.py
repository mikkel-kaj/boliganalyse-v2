"""Opt-in integration test against real `*.mindworking.eu` URLs.

Skips by default. Set `RUN_INTEGRATION=1` to opt in. The two GUIDs below
are public Danbolig Holstebro documents we already verified return PDFs.
"""

from __future__ import annotations

import os

import pytest

from src.documents.mindworking import fetch_document

LIVE_URLS = [
    (
        "https://danbolig.mindworking.eu/api/Public/Documents/"
        "26d87892-deb1-44b4-bc6d-549702714284"
    ),
    (
        "https://danbolig.mindworking.eu/api/Public/Documents/"
        "889d6dbc-ad49-440d-99c1-f9afbb36201f"
    ),
]


@pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION") != "1",
    reason="set RUN_INTEGRATION=1 to hit real *.mindworking.eu hosts",
)
@pytest.mark.parametrize("url", LIVE_URLS)
async def test_fetch_real_danbolig_pdf(url: str) -> None:
    doc = await fetch_document(url)
    assert doc.content.startswith(b"%PDF-"), (
        f"expected PDF magic; got {doc.content[:8]!r}"
    )
    assert doc.content_type.lower().startswith("application/pdf")
    assert doc.filename
    assert len(doc.sha256) == 64
