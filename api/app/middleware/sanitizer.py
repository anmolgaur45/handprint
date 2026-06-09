"""Middleware to sanitize request query parameters and JSON bodies."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.sanitizer import sanitize_json_value, sanitize_query_string

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response


class InputSanitizerMiddleware(BaseHTTPMiddleware):
    """Global middleware to sanitize request query parameters and JSON bodies.

    Applies Unicode NFC normalization, strips formatting and control characters.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 1. Sanitize query parameters if present
        query_string = request.scope.get("query_string")
        if query_string:
            request.scope["query_string"] = sanitize_query_string(query_string)

        # 2. Sanitize request body for application/json content type
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = await request.body()
                if body:
                    data = json.loads(body)
                    sanitized_data = sanitize_json_value(data)
                    sanitized_body = json.dumps(sanitized_data).encode("utf-8")
                    # Set the private _body cache so downstream route handlers
                    # consume the sanitized version.
                    request._body = sanitized_body
            except Exception:
                # If JSON parsing fails, pass through and let standard handler reject
                pass

        return await call_next(request)
