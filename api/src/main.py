import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import acreate_client

from src.config import get_settings
from src.documents.storage import DocumentStorage
from src.repositories.document import DocumentRepository
from src.repositories.listing import ListingRepository
from src.routes import documents, feedback, listings
from src.routes.schemas import HealthResponse

settings = get_settings()

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.repository = await ListingRepository.create()
    app.state.document_repository = await DocumentRepository.create()
    storage_client = await acreate_client(
        settings.supabase_url, settings.supabase_service_role_key
    )
    app.state.document_storage = DocumentStorage(storage_client)
    try:
        yield
    finally:
        # supabase-py manages its own httpx lifecycle internally; nothing to close
        app.state.repository = None
        app.state.document_repository = None
        app.state.document_storage = None


app = FastAPI(title="Boliganalyse API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


app.include_router(listings.router)
app.include_router(documents.router)
app.include_router(feedback.router)
