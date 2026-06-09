"""Unit tests for the security headers middleware."""

from __future__ import annotations

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

    # Verify all expected security headers from §6 / security_headers.py
    assert "Content-Security-Policy" in headers
    assert "default-src 'none'" in headers["Content-Security-Policy"]
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]

    assert headers["Strict-Transport-Security"] == "max-age=63072000; includeSubDomains; preload"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["Referrer-Policy"] == "strict-origin-when-cross-origin"

    assert "camera=()" in headers["Permissions-Policy"]
    assert "geolocation=()" in headers["Permissions-Policy"]

    assert headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert headers["Cross-Origin-Resource-Policy"] == "same-origin"

    # Request ID check
    assert "X-Request-ID" in headers


def test_security_headers_custom_request_id() -> None:
    client = TestClient(app)
    # If client passes X-Request-ID, the middleware should preserve and echo it
    custom_id = "test-req-12345"
    response = client.get("/test-headers", headers={"X-Request-ID": custom_id})
    assert response.headers["X-Request-ID"] == custom_id
