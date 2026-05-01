"""Unit tests for the Danbolig document extractor."""

from __future__ import annotations

from pathlib import Path

from src.documents.extractors.danbolig import extract_danbolig_documents

_FIXTURE = Path(__file__).parent / "fixtures" / "danbolig_listing.html"


def _load_fixture() -> str:
    return _FIXTURE.read_text(encoding="utf-8")


def test_happy_path_returns_two_refs() -> None:
    refs = extract_danbolig_documents(_load_fixture())

    assert len(refs) == 2

    salgs = refs[0]
    assert salgs.url == (
        "https://danbolig.mindworking.eu/api/Public/Documents/"
        "26d87892-deb1-44b4-bc6d-549702714284"
    )
    assert salgs.source_url == salgs.url
    assert salgs.filename_hint == "Salgsopstilling"
    assert salgs.kind == "Salgsopstilling - Villa"

    energi = refs[1]
    assert energi.url == (
        "https://danbolig.mindworking.eu/api/Public/Documents/"
        "889d6dbc-ad49-440d-99c1-f9afbb36201f"
    )
    assert energi.filename_hint == "Energimærke"
    assert energi.kind == "Energimærke, gældende"


def test_null_documents_returns_empty_list() -> None:
    html = """
    <html><body><property-page :property-data="{
      'address': 'X',
      'documents': null,
      'openHouses': []
    }"></property-page></body></html>
    """
    assert extract_danbolig_documents(html) == []


def test_missing_documents_block_returns_empty_list() -> None:
    html = "<html><body>No relevant data here.</body></html>"
    assert extract_danbolig_documents(html) == []


def test_malformed_documents_block_returns_empty_list() -> None:
    # Truncated array — `_extract_array_literal` walks off the end and
    # returns None, so the extractor degrades gracefully.
    html = """
    <html><body><div data="{
      'documents': [
        { 'url': 'https://example.mindworking.eu/api/Public/Documents/abc',
          'name': 'X', 'type': 'Y'
    """
    assert extract_danbolig_documents(html) == []


def test_malformed_json_inside_block_returns_empty_list() -> None:
    # Brackets balance but the inner content is not valid JSON-ish
    # (a stray identifier). Should log + return [].
    html = """
    <html><body><div data="{
      'documents': [ this is not json at all ]
    }"></div></body></html>
    """
    assert extract_danbolig_documents(html) == []


def test_empty_html_returns_empty_list() -> None:
    assert extract_danbolig_documents("") == []


def test_skips_null_occurrences_to_find_real_array() -> None:
    # Real Danbolig pages embed multiple `documents` keys — typically
    # nested inside related-property objects with `null` values — and only
    # the listing's own block has the actual array. Make sure we don't
    # stop at the first `null`.
    html = """
    <html><body><div data="{
      'relatedProperty1': { 'documents': null, 'price': 1 },
      'relatedProperty2': { 'documents': null, 'price': 2 },
      'documents': [
        { 'url': 'https://x.mindworking.eu/api/Public/Documents/abc',
          'name': 'Salgsopstilling', 'type': 'Salgsopstilling - Villa' }
      ]
    }"></div></body></html>
    """
    refs = extract_danbolig_documents(html)
    assert len(refs) == 1
    assert refs[0].filename_hint == "Salgsopstilling"


def test_entries_without_url_are_skipped() -> None:
    html = """
    <html><body><div data="{
      'documents': [
        { 'name': 'No URL', 'type': 'Foo' },
        { 'url': 'https://example.mindworking.eu/api/Public/Documents/x',
          'name': 'Has URL', 'type': 'Bar' }
      ]
    }"></div></body></html>
    """
    refs = extract_danbolig_documents(html)
    assert len(refs) == 1
    assert refs[0].filename_hint == "Has URL"
