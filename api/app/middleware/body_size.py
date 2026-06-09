"""Middleware to enforce a strict upper bound on request body size."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import ClientDisconnect
from starlette.responses import JSONResponse

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response
    from starlette.types import Message


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests with bodies larger than max_bytes.

    Checks the Content-Length header first for an early exit, then tracks
    bytes consumed as the stream is read to catch chunked payloads or
    lying headers.
    """

    def __init__(self, app: object, max_bytes: int = 16_384) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 1. Check Content-Length header if present
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > self.max_bytes:
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={"detail": "request body too large"},
                    )
            except ValueError:
                pass  # Ignore malformed header, fallback to reading stream

        # 2. Check stream as we read
        body_bytes = 0

        # We must buffer the stream locally to measure it, then reconstruct
        # an async generator for downstream consumption.
        original_receive = request.receive

        async def receive() -> Message:
            nonlocal body_bytes
            message = await original_receive()
            if message["type"] == "http.request":
                chunk = message.get("body", b"")
                body_bytes += len(chunk)
                if body_bytes > self.max_bytes:
                    raise RuntimeError("Request body too large")
            return message

        request._receive = receive

        try:
            return await call_next(request)
        except RuntimeError as e:
            if str(e) == "Request body too large":
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": "request body too large"},
                )
            raise
        except ClientDisconnect:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "client disconnected"},
            )
