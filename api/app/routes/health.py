"""Health check route for Cloud Run probes."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness probe endpoint."""
    return {"status": "ok"}
