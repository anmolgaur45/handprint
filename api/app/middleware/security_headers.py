"""Security headers middleware.

Adds the full header set from §6 to every response:
CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
Permissions-Policy, COOP, CORP, X-Request-ID.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response

# Content-Security-Policy: API-only service, so restrict everything.
_CSP = "; ".join([
    "default-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
])

_SECURITY_HEADERS: dict[str, str] = {
    "Content-Security-Policy": _CSP,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject security headers and a per-request X-Request-ID."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        response = await call_next(request)
        for header, value in _SECURITY_HEADERS.items():
            response.headers[header] = value
        response.headers["X-Request-ID"] = request_id
        return response
