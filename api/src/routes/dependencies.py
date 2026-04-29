"""FastAPI dependencies — exposes singletons owned by the app's lifespan."""

from fastapi import Request

from src.documents.storage import DocumentStorage
from src.repositories.document import DocumentRepository
from src.repositories.inbound_email import InboundEmailRepository
from src.repositories.listing import ListingRepository


def get_repository(request: Request) -> ListingRepository:
    repo: ListingRepository | None = getattr(request.app.state, "repository", None)
    if repo is None:
        raise RuntimeError("ListingRepository not initialised on app.state")
    return repo


def get_document_repository(request: Request) -> DocumentRepository:
    repo: DocumentRepository | None = getattr(request.app.state, "document_repository", None)
    if repo is None:
        raise RuntimeError("DocumentRepository not initialised on app.state")
    return repo


def get_document_storage(request: Request) -> DocumentStorage:
    storage: DocumentStorage | None = getattr(request.app.state, "document_storage", None)
    if storage is None:
        raise RuntimeError("DocumentStorage not initialised on app.state")
    return storage


def get_inbound_email_repository(request: Request) -> InboundEmailRepository:
    repo: InboundEmailRepository | None = getattr(
        request.app.state, "inbound_email_repository", None
    )
    if repo is None:
        raise RuntimeError("InboundEmailRepository not initialised on app.state")
    return repo
