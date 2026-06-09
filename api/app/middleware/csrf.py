"""Middleware to enforce same-origin CSRF validation on state-changing requests."""

from __future__ import annotations

import urllib.parse
from typing import TYPE_CHECKING

from fastapi import status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings

if TYPE_CHECKING:
    from starlette.requests import Request


class CSRFMiddleware(BaseHTTPMiddleware):
    """Enforce Same-Origin/allowed-origin checks on POST, PUT, PATCH, DELETE.

    Blocks cross-origin requests by validating the Origin/Referer headers
    against the request's own origin and the configured allowed CORS origins.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            origin = request.headers.get("origin")
            referer = request.headers.get("referer")

            # Get request's own origin (scheme + netloc)
            scheme = request.url.scheme
            netloc = request.url.netloc
            request_origin = f"{scheme}://{netloc}"

            settings = get_settings()
            allowed = [request_origin] + settings.allowed_origins

            def normalize(url: str) -> str:
                parsed = urllib.parse.urlparse(url)
                if not parsed.scheme or not parsed.netloc:
                    return ""
                return f"{parsed.scheme}://{parsed.netloc}".lower()

            normalized_allowed = {normalize(a) for a in allowed if a}

            # 1. Validate Origin header if present
            if origin:
                if normalize(origin) not in normalized_allowed:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "CSRF validation failed: origin not allowed"},
                    )
            # 2. Fallback to Referer header if Origin is absent
            elif referer and normalize(referer) not in normalized_allowed:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "CSRF validation failed: referer not allowed"},
                )

        return await call_next(request)
