"""Health check route for Cloud Run probes."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe endpoint."""
    return {"status": "ok"}


@router.get("/.well-known/security.txt", response_class=PlainTextResponse)
async def security_txt() -> str:
    """Security contact metadata file."""
    return (
        "Contact: mailto:30744879+anmolgaur45@users.noreply.github.com\n"
        "Preferred-Languages: en\n"
        "Expires: 2027-06-09T00:00:00.000Z\n"
        "Policy: https://github.com/anmolgaur45/handprint/blob/main/SECURITY.md\n"
    )
