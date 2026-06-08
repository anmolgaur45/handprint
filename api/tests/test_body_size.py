"""Tests for body-size limit middleware."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from fastapi import Request  # noqa: TC002

from app.main import app

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from httpx import AsyncClient


@app.post("/test-body")
async def dummy_body_route(request: Request) -> dict[str, int]:
    """Dummy route that reads the entire body."""
    body = await request.body()
    return {"size": len(body)}


@pytest.mark.asyncio
async def test_body_size_under_limit(client: AsyncClient) -> None:
    """Requests under the limit pass through."""
    payload = b"x" * 10
    resp = await client.post("/test-body", content=payload)
    assert resp.status_code == 200
    assert resp.json() == {"size": 10}


@pytest.mark.asyncio
async def test_body_size_over_limit_header(client: AsyncClient) -> None:
    """Content-Length header > max triggers early 413."""
    # 16 KiB limit from config
    payload = b"x" * 17_000
    resp = await client.post("/test-body", content=payload)
    assert resp.status_code == 413
    assert resp.json()["detail"] == "request body too large"


@pytest.mark.asyncio
async def test_body_size_over_limit_stream(client: AsyncClient) -> None:
    """If Content-Length is missing or lies, streaming catches it."""
    # Build a generator to send chunked, bypassing Content-Length
    async def chunk_generator() -> AsyncGenerator[bytes, None]:
        yield b"x" * 10_000
        yield b"x" * 10_000

    resp = await client.post(
        "/test-body",
        content=chunk_generator(),  # type: ignore[arg-type]
    )
    assert resp.status_code == 413
    assert resp.json()["detail"] == "request body too large"
