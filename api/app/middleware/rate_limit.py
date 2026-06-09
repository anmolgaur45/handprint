"""Per-IP sliding-window rate limiter for AI endpoints.

Uses an in-memory sliding window.  Sufficient for a single Cloud Run
instance; swap to Redis if horizontal scaling is needed later.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import TYPE_CHECKING

from fastapi import status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response


class SlidingWindowRateLimiter:
    """Track request timestamps per key in a sliding window."""

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str) -> bool:
        """Return True if the key has budget remaining in the current window."""
        now = time.monotonic()
        window = self._hits[key]
        cutoff = now - self.window_seconds

        # Expire old entries
        while window and window[0] <= cutoff:
            window.popleft()

        if len(window) >= self.max_requests:
            return False

        window.append(now)
        return True

    def remaining(self, key: str) -> int:
        """Return the number of requests remaining for the key."""
        now = time.monotonic()
        window = self._hits[key]
        cutoff = now - self.window_seconds

        while window and window[0] <= cutoff:
            window.popleft()

        return max(0, self.max_requests - len(window))


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply sliding-window rate limiting to paths matching a prefix."""

    def __init__(
        self,
        app: object,
        limiter: SlidingWindowRateLimiter,
        path_prefix: str = "/ai",
    ) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self.limiter = limiter
        self.path_prefix = path_prefix

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not request.url.path.startswith(self.path_prefix):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"

        if not self.limiter.is_allowed(client_ip):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "rate limit exceeded"},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(self.limiter.remaining(client_ip))
        return response
