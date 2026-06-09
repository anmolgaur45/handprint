from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import get_committed_action_repository
from app.domain.models import CommittedAction
from app.middleware.auth import get_current_user_id
from app.repositories.committed_action import CommittedActionRepository

router = APIRouter(prefix="/committed_actions", tags=["committed_actions"])


class CommittedActionCreateRequest(BaseModel):
    """Schema for pledging a new carbon reduction action."""

    action_key: str = Field(
        ..., min_length=1, max_length=128, description="Action identifier key"
    )
    title: str = Field(..., min_length=1, max_length=256, description="Description of action")
    category: str = Field(
        ..., min_length=1, max_length=50, description="E.g. transport, food, energy"
    )
    projected_savings_kg: float = Field(
        ..., ge=0.0, description="Projected annual kg CO2e saved"
    )


class CommittedActionStatusRequest(BaseModel):
    """Schema for updating the lifecycle status of a committed action."""

    status: Literal["active", "completed", "abandoned"] = Field(
        ..., description="New lifecycle status"
    )


@router.post(
    "",
    response_model=CommittedAction,
    status_code=status.HTTP_201_CREATED,
    summary="Commit to a new carbon reduction action",
)
async def create_commitment(
    request: CommittedActionCreateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[CommittedActionRepository, Depends(get_committed_action_repository)],
) -> CommittedAction:
    """Create a new commitment pledge in Cloud Firestore."""
    action = CommittedAction(
        user_id=user_id,
        action_key=request.action_key,
        title=request.title,
        category=request.category,
        projected_savings_kg=request.projected_savings_kg,
    )
    return await repo.create(action)


@router.get(
    "",
    response_model=list[CommittedAction],
    summary="List all committed actions for the authenticated user",
)
async def list_commitments(
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[CommittedActionRepository, Depends(get_committed_action_repository)],
) -> list[CommittedAction]:
    """Retrieve all committed action pledges logged by the user."""
    return await repo.list_by_user(user_id)


@router.patch(
    "/{action_id}",
    summary="Update the status of a committed action",
)
async def update_commitment_status(
    action_id: str,
    request: CommittedActionStatusRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    repo: Annotated[CommittedActionRepository, Depends(get_committed_action_repository)],
) -> dict[str, bool]:
    """Update status of a committed action. Returns success indicator."""
    # To secure this, list user actions first to verify ownership
    actions = await repo.list_by_user(user_id)
    owned_ids = {a.id for a in actions if a.id is not None}

    if action_id not in owned_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Committed action not found or access denied",
        )

    success = await repo.update_status(action_id, request.status)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update commitment status",
        )

    return {"success": True}
