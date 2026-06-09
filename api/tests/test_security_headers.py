"""Unit tests for the security headers middleware."""

from __future__ import annotations

import re

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.security_headers import SecurityHeadersMiddleware

app = FastAPI()
app.add_middleware(SecurityHeadersMiddleware)


@app.get("/test-headers")
async def handle_get() -> dict[str, str]:
    return {"status": "ok"}


def test_security_headers_injected() -> None:
    client = TestClient(app)
    response = client.get("/test-headers")
    assert response.status_code == 200

    headers = response.headers

    assert "Content-Security-Policy" in headers
    assert "default-src 'none'" in headers["Content-Security-Policy"]
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    assert "strict-dynamic" in headers["Content-Security-Policy"]

    assert headers["Strict-Transport-Security"] == "max-age=63072000; includeSubDomains; preload"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["Referrer-Policy"] == "strict-origin-when-cross-origin"

    assert "camera=()" in headers["Permissions-Policy"]
    assert "geolocation=()" in headers["Permissions-Policy"]

    assert headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert headers["Cross-Origin-Resource-Policy"] == "same-origin"

    assert "X-Request-ID" in headers


def test_csp_nonce_present() -> None:
    """Every response must carry a base64 nonce in the CSP script-src directive."""
    client = TestClient(app)
    response = client.get("/test-headers")
    csp = response.headers["Content-Security-Policy"]
    # nonce-<base64> where base64 uses A-Za-z0-9+/= characters
    assert re.search(r"'nonce-[A-Za-z0-9+/=]+'", csp), f"No nonce found in CSP: {csp}"


def test_csp_nonce_unique_per_request() -> None:
    """Each response must have a distinct nonce to prevent replay attacks."""
    client = TestClient(app)
    nonces: set[str] = set()
    for _ in range(5):
        csp = client.get("/test-headers").headers["Content-Security-Policy"]
        match = re.search(r"'nonce-([A-Za-z0-9+/=]+)'", csp)
        assert match, f"No nonce found in CSP: {csp}"
        nonces.add(match.group(1))
    assert len(nonces) == 5, "Expected unique nonce per request; got duplicates"


def test_security_headers_custom_request_id() -> None:
    """If client passes X-Request-ID the middleware preserves and echoes it."""
    client = TestClient(app)
    custom_id = "test-req-12345"
    response = client.get("/test-headers", headers={"X-Request-ID": custom_id})
    assert response.headers["X-Request-ID"] == custom_id
