"""Unit tests for `DocumentStorage`. The supabase client is replaced by
a hand-rolled fake that records calls."""

from __future__ import annotations

from typing import Any

import pytest

from src.documents.storage import DocumentStorage


class _FakeBucketAPI:
    def __init__(self) -> None:
        self.uploads: list[dict[str, Any]] = []
        self.downloads: list[str] = []
        self.exists_calls: list[str] = []
        self._existing: set[str] = set()

    def add_existing(self, *paths: str) -> None:
        self._existing.update(paths)

    async def upload(
        self,
        path: str,
        file: bytes,
        file_options: dict[str, str] | None = None,
    ) -> None:
        self.uploads.append({"path": path, "file": file, "file_options": file_options or {}})
        self._existing.add(path)

    async def download(self, path: str) -> bytes:
        self.downloads.append(path)
        if path not in self._existing:
            raise RuntimeError(f"object not found: {path}")
        return b"%PDF-fake-bytes"

    async def exists(self, path: str) -> bool:
        self.exists_calls.append(path)
        return path in self._existing


class _FakeStorage:
    def __init__(self) -> None:
        self.buckets: dict[str, _FakeBucketAPI] = {}
        self.created_buckets: list[tuple[str, dict[str, Any]]] = []
        self.bucket_lookups: list[str] = []
        self._known_buckets: set[str] = set()

    def from_(self, bucket: str) -> _FakeBucketAPI:
        api = self.buckets.setdefault(bucket, _FakeBucketAPI())
        return api

    async def get_bucket(self, name: str) -> dict[str, Any]:
        self.bucket_lookups.append(name)
        if name in self._known_buckets:
            return {"id": name, "public": False}
        raise RuntimeError(f"bucket not found: {name}")

    async def create_bucket(
        self, name: str, options: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        self.created_buckets.append((name, options or {}))
        self._known_buckets.add(name)
        return {"id": name}


class _FakeClient:
    def __init__(self) -> None:
        self.storage = _FakeStorage()


@pytest.fixture
def fake_client() -> _FakeClient:
    return _FakeClient()


@pytest.fixture
def storage(fake_client: _FakeClient) -> DocumentStorage:
    return DocumentStorage(fake_client)  # type: ignore[arg-type]


async def test_upload_happy_path(
    storage: DocumentStorage, fake_client: _FakeClient
) -> None:
    await storage.upload("listing-1/abc.pdf", b"%PDF-content", "application/pdf")

    bucket = fake_client.storage.from_("documents")
    assert len(bucket.uploads) == 1
    call = bucket.uploads[0]
    assert call["path"] == "listing-1/abc.pdf"
    assert call["file"] == b"%PDF-content"
    assert call["file_options"]["content-type"] == "application/pdf"
    # Overwrite enabled by default — content can change between calls.
    assert call["file_options"]["upsert"] == "true"


async def test_upload_overwrites_existing(
    storage: DocumentStorage, fake_client: _FakeClient
) -> None:
    await storage.upload("p.pdf", b"v1", "application/pdf")
    await storage.upload("p.pdf", b"v2", "application/pdf")

    bucket = fake_client.storage.from_("documents")
    assert len(bucket.uploads) == 2
    assert all(c["file_options"]["upsert"] == "true" for c in bucket.uploads)


async def test_download_happy_path(
    storage: DocumentStorage, fake_client: _FakeClient
) -> None:
    bucket = fake_client.storage.from_("documents")
    bucket.add_existing("listing-1/abc.pdf")

    payload = await storage.download("listing-1/abc.pdf")

    assert payload.startswith(b"%PDF-")
    assert bucket.downloads == ["listing-1/abc.pdf"]


async def test_exists_true(
    storage: DocumentStorage, fake_client: _FakeClient
) -> None:
    bucket = fake_client.storage.from_("documents")
    bucket.add_existing("listing-1/abc.pdf")

    assert await storage.exists("listing-1/abc.pdf") is True
    assert bucket.exists_calls == ["listing-1/abc.pdf"]


async def test_exists_false(
    storage: DocumentStorage, fake_client: _FakeClient
) -> None:
    assert await storage.exists("missing.pdf") is False


async def test_ensure_bucket_creates_when_missing(
    storage: DocumentStorage, fake_client: _FakeClient
) -> None:
    await storage.ensure_bucket()

    assert fake_client.storage.bucket_lookups == ["documents"]
    assert len(fake_client.storage.created_buckets) == 1
    name, options = fake_client.storage.created_buckets[0]
    assert name == "documents"
    assert options == {"public": False}


async def test_ensure_bucket_noop_when_present(
    storage: DocumentStorage, fake_client: _FakeClient
) -> None:
    await fake_client.storage.create_bucket("documents", {"public": False})
    fake_client.storage.created_buckets.clear()

    await storage.ensure_bucket()

    assert fake_client.storage.bucket_lookups == ["documents"]
    assert fake_client.storage.created_buckets == []
