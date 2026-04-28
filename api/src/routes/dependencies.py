"""FastAPI dependencies — currently just exposes the singleton
ListingRepository owned by the app's lifespan."""

from fastapi import Request

from src.repositories.listing import ListingRepository


def get_repository(request: Request) -> ListingRepository:
    repo: ListingRepository | None = getattr(request.app.state, "repository", None)
    if repo is None:
        raise RuntimeError("ListingRepository not initialised on app.state")
    return repo
