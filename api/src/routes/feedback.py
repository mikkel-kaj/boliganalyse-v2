from typing import Annotated

from fastapi import APIRouter, Depends

from src.repositories.listing import ListingRepository
from src.routes.dependencies import get_repository
from src.routes.schemas import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    payload: FeedbackRequest,
    repository: Annotated[ListingRepository, Depends(get_repository)],
) -> FeedbackResponse:
    row = await repository.insert_feedback(
        feedback_type=payload.feedback_type,
        message=payload.message,
        email=payload.email,
        listing_id=payload.listing_id,
        property_address=payload.property_address,
    )
    return FeedbackResponse(id=row["id"], created_at=row["created_at"])
