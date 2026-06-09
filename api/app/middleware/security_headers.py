"""Security headers middleware.

Adds the full header set from §6 to every response:
CSP (per-request nonce + strict-dynamic), HSTS, X-Frame-Options,
X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP,
X-Request-ID.
"""

from __future__ import annotations

import base64
import os
import uuid
from typing import TYPE_CHECKING

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response

_STATIC_HEADERS: dict[str, str] = {
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


def _build_csp(nonce: str) -> str:
    return "; ".join(
        [
            f"script-src 'nonce-{nonce}' 'strict-dynamic'",
            "default-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'none'",
            "form-action 'none'",
        ]
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject security headers and a per-request nonce + X-Request-ID."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        nonce = base64.b64encode(os.urandom(16)).decode("ascii")
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = _build_csp(nonce)
        for header, value in _STATIC_HEADERS.items():
            response.headers[header] = value
        response.headers["X-Request-ID"] = request_id
        return response
