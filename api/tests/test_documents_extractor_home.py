"""Unit tests for the Home.dk listing metadata extractor."""

from __future__ import annotations

from pathlib import Path

from src.documents.extractors.home import extract_home_listing_metadata
from src.types.models import HomeListingMetadata

_FIXTURE = Path(__file__).parent / "fixtures" / "home_listing_nuxt.html"


def _load_fixture() -> str:
    return _FIXTURE.read_text(encoding="utf-8")


def test_happy_path_returns_metadata() -> None:
    meta = extract_home_listing_metadata(_load_fixture())
    assert meta == HomeListingMetadata(store_id="801", case_number="8010001832")


def test_missing_nuxt_data_tag_returns_none() -> None:
    html = "<html><body>No Nuxt data here.</body></html>"
    assert extract_home_listing_metadata(html) is None


def test_malformed_json_returns_none() -> None:
    html = (
        '<html><body>'
        '<script id="__NUXT_DATA__" type="application/json">[not, valid json}</script>'
        '</body></html>'
    )
    assert extract_home_listing_metadata(html) is None


def test_no_case_row_returns_none() -> None:
    # Valid JSON, no dict has BOTH shopNumber and id at the top level.
    html = (
        '<html><body>'
        '<script id="__NUXT_DATA__" type="application/json">'
        '[{"id": 1}, "x", {"shopNumber": 1}, {"otherKey": 1}]'
        '</script></body></html>'
    )
    assert extract_home_listing_metadata(html) is None


def test_empty_html_returns_none() -> None:
    assert extract_home_listing_metadata("") is None


def test_payload_not_a_list_returns_none() -> None:
    html = (
        '<html><body>'
        '<script id="__NUXT_DATA__" type="application/json">{"foo": "bar"}</script>'
        '</body></html>'
    )
    assert extract_home_listing_metadata(html) is None
