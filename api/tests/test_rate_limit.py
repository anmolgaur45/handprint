"""Tests for per-IP sliding-window rate limiting."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from app.middleware.rate_limit import SlidingWindowRateLimiter

if TYPE_CHECKING:
    from httpx import AsyncClient


# --- Unit tests for SlidingWindowRateLimiter ---


class TestSlidingWindowRateLimiter:
    """Unit tests for the limiter logic independent of HTTP."""

    def test_allows_up_to_max(self) -> None:
        limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=60)
        assert limiter.is_allowed("ip1") is True
        assert limiter.is_allowed("ip1") is True
        assert limiter.is_allowed("ip1") is True
        assert limiter.is_allowed("ip1") is False

    def test_separate_keys_independent(self) -> None:
        limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60)
        assert limiter.is_allowed("ip1") is True
        assert limiter.is_allowed("ip2") is True
        assert limiter.is_allowed("ip1") is False

    def test_remaining_decrements(self) -> None:
        limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60)
        assert limiter.remaining("ip1") == 5
        limiter.is_allowed("ip1")
        assert limiter.remaining("ip1") == 4


# --- Integration tests via HTTP ---


@pytest.mark.asyncio
async def test_rate_limit_not_applied_to_health(client: AsyncClient) -> None:
    """Non-AI paths bypass the rate limiter entirely."""
    for _ in range(30):
        resp = await client.get("/healthz")
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_rate_limit_triggers_on_ai_path(client: AsyncClient) -> None:
    """AI paths return 429 after exceeding the limit."""
    # The test app uses the default settings: 20 requests / 60s window.
    # We hit a nonexistent /ai/test path — the rate limiter fires before routing.
    for i in range(20):
        resp = await client.get("/ai/test")
        # 404 is expected (no route), but rate limiter should still allow
        assert resp.status_code == 404, f"request {i} unexpected status {resp.status_code}"

    # 21st request should be rate-limited
    resp = await client.get("/ai/test")
    assert resp.status_code == 429
    assert resp.json()["detail"] == "rate limit exceeded"
