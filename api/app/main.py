"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.middleware.body_size import BodySizeLimitMiddleware
from app.middleware.csrf import CSRFMiddleware
from app.middleware.rate_limit import RateLimitMiddleware, SlidingWindowRateLimiter
from app.middleware.sanitizer import InputSanitizerMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routes.committed_actions import router as committed_actions_router
from app.routes.energy import router as energy_router
from app.routes.food import router as food_router
from app.routes.health import router as health_router
from app.routes.insights import router as insights_router
from app.routes.simulation import router as simulation_router
from app.routes.streaks import router as streaks_router
from app.routes.trips import router as trips_router

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup and shutdown lifecycle."""
    from app.core.dependencies import close_clients, enable_in_memory_mode, get_firestore_client
    from app.middleware.auth import initialize_firebase

    settings = get_settings()
    setup_logging(debug=settings.debug)
    logger.info("starting", app=settings.app_name, debug=settings.debug)
    initialize_firebase()

    # Test Firestore connectivity and fallback to in-memory on any errors
    try:
        db = get_firestore_client()
        # Perform a quick dummy stream check (limit 1) to verify connection/permissions
        async for _ in db.collection("trips").limit(1).stream():
            break
    except Exception as e:
        logger.warning(
            "Firestore connectivity check failed. Falling back to InMemoryAsyncClient.",
            error=str(e),
        )
        enable_in_memory_mode()

    yield
    logger.info("shutting down")
    await close_clients()


def create_app() -> FastAPI:
    """Build and return the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Handprint API",
        description="Carbon footprint awareness platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # Rate limiting for AI endpoints
    limiter = SlidingWindowRateLimiter(
        max_requests=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    app.add_middleware(
        RateLimitMiddleware,
        limiter=limiter,
        path_prefix="/ai",
    )

    # Body size cap
    app.add_middleware(
        BodySizeLimitMiddleware,
        max_bytes=settings.max_body_size_bytes,
    )

    # Input sanitizer
    app.add_middleware(InputSanitizerMiddleware)

    # CSRF validation
    app.add_middleware(CSRFMiddleware)

    # Routes
    app.include_router(health_router)
    app.include_router(trips_router)
    app.include_router(simulation_router)
    app.include_router(committed_actions_router)
    app.include_router(streaks_router)
    app.include_router(food_router)
    app.include_router(energy_router)
    app.include_router(insights_router)

    return app


app = create_app()
