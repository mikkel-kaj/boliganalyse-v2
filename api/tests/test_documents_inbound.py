"""Pure-function tests for `parse_inbound_email`.

Covers UUID-from-To extraction, multipart walking, HTML-only emails,
and HTML-entity-encoded URLs in href attributes.
"""

from __future__ import annotations

from pathlib import Path

from src.documents.inbound import parse_inbound_email

_FIXTURE = Path(__file__).parent / "fixtures" / "home_salesmaterial.eml"


def test_home_fixture_extracts_listing_id_and_three_urls() -> None:
    raw = _FIXTURE.read_bytes()

    parsed = parse_inbound_email(raw)

    assert parsed.listing_id == "00000000-0000-0000-0000-000000000001"
    assert parsed.inbox_local_part == "00000000-0000-0000-0000-000000000001"
    assert parsed.from_address == "noreply@myhome.home.dk"
    assert parsed.subject is not None
    assert "Kl" in parsed.subject  # MIME-encoded but at least the prefix survives raw
    assert parsed.document_urls == [
        "https://home.mindworking.eu/api/Public/Documents/e0518445-5ef7-4488-88dc-75ec065be023",
        "https://home.mindworking.eu/api/Public/Documents/de3a02c7-d7cd-4fcd-aa95-91e3b5592585",
        "https://home.mindworking.eu/api/Public/Documents/42354db5-cb3b-4b06-b458-cb409b0b1fd7",
    ]


def test_email_with_no_mindworking_urls() -> None:
    raw = (
        b"From: noreply@example.com\r\n"
        b"To: 11111111-1111-1111-1111-111111111111@inbox.boliganalyse.ai\r\n"
        b"Subject: Hello\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Just a plain message with no document links.\r\n"
    )

    parsed = parse_inbound_email(raw)

    assert parsed.listing_id == "11111111-1111-1111-1111-111111111111"
    assert parsed.document_urls == []


def test_to_not_uuid_keeps_local_part_but_no_listing_id() -> None:
    raw = (
        b"From: noreply@example.com\r\n"
        b"To: support@inbox.boliganalyse.ai\r\n"
        b"Subject: General mail\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Body\r\n"
    )

    parsed = parse_inbound_email(raw)

    assert parsed.listing_id is None
    assert parsed.inbox_local_part == "support"
    assert parsed.from_address == "noreply@example.com"


def test_html_only_email_extracts_urls_from_html_body() -> None:
    raw = (
        b"From: noreply@myhome.home.dk\r\n"
        b"To: 22222222-2222-2222-2222-222222222222@inbox.boliganalyse.ai\r\n"
        b"Subject: Materiale\r\n"
        b"MIME-Version: 1.0\r\n"
        b"Content-Type: text/html; charset=utf-8\r\n"
        b"\r\n"
        b"<html><body>"
        b"<a href=\"https://home.mindworking.eu/api/Public/Documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\">Doc</a>"
        b"</body></html>\r\n"
    )

    parsed = parse_inbound_email(raw)

    assert parsed.listing_id == "22222222-2222-2222-2222-222222222222"
    assert parsed.document_urls == [
        "https://home.mindworking.eu/api/Public/Documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    ]


def test_html_entity_encoded_urls_are_decoded() -> None:
    raw = (
        b"From: noreply@myhome.home.dk\r\n"
        b"To: 33333333-3333-3333-3333-333333333333@inbox.boliganalyse.ai\r\n"
        b"Subject: Materiale\r\n"
        b"MIME-Version: 1.0\r\n"
        b"Content-Type: text/html; charset=utf-8\r\n"
        b"\r\n"
        b"<html><body>"
        b"<a href=\"https://home.mindworking.eu/api/Public/Documents/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb&amp;param=1\">Doc</a>"
        b"</body></html>\r\n"
    )

    parsed = parse_inbound_email(raw)

    assert (
        "https://home.mindworking.eu/api/Public/Documents/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        in parsed.document_urls
    )


def test_delivered_to_preferred_over_to_when_available() -> None:
    raw = (
        b"From: noreply@example.com\r\n"
        b"Delivered-To: 44444444-4444-4444-4444-444444444444@inbox.boliganalyse.ai\r\n"
        b"To: undisclosed-recipients:;\r\n"
        b"Subject: Forwarded mail\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Body\r\n"
    )

    parsed = parse_inbound_email(raw)

    assert parsed.listing_id == "44444444-4444-4444-4444-444444444444"
    assert parsed.inbox_local_part == "44444444-4444-4444-4444-444444444444"


def test_uppercase_host_in_mindworking_url_is_matched() -> None:
    raw = (
        b"From: noreply@myhome.home.dk\r\n"
        b"To: 55555555-5555-5555-5555-555555555555@inbox.boliganalyse.ai\r\n"
        b"Subject: x\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Link: https://Home.Mindworking.eu/api/Public/Documents/cccccccc-cccc-cccc-cccc-cccccccccccc\r\n"
    )

    parsed = parse_inbound_email(raw)

    assert len(parsed.document_urls) == 1
