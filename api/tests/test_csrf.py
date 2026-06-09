"""Unit tests for the CSRF middleware."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.middleware.csrf import CSRFMiddleware

app = FastAPI()
app.add_middleware(CSRFMiddleware)


@app.post("/test-post")
async def handle_post(request: Request) -> dict[str, str]:
    return {"status": "ok"}


@app.get("/test-get")
async def handle_get(request: Request) -> dict[str, str]:
    return {"status": "ok"}


def test_csrf_no_headers_passes() -> None:
    client = TestClient(app)
    # Without Origin/Referer (e.g. native client or same-site backend fetch), pass through
    response = client.post("/test-post")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_csrf_same_origin_passes() -> None:
    client = TestClient(app)
    # Origin matching request host should pass
    response = client.post(
        "/test-post", headers={"origin": "http://testserver", "host": "testserver"}
    )
    assert response.status_code == 200


def test_csrf_allowed_cors_origin_passes() -> None:
    client = TestClient(app)
    # Origin matching configured allowed_origins (e.g., http://localhost:3000) should pass
    response = client.post("/test-post", headers={"origin": "http://localhost:3000"})
    assert response.status_code == 200


def test_csrf_banned_origin_fails() -> None:
    client = TestClient(app)
    # Cross-origin origin should be blocked
    response = client.post("/test-post", headers={"origin": "http://attacker.com"})
    assert response.status_code == 403
    assert "CSRF validation failed" in response.json()["detail"]


def test_csrf_fallback_allowed_referer_passes() -> None:
    client = TestClient(app)
    # Referer matching allowed origins passes when Origin is absent
    response = client.post("/test-post", headers={"referer": "http://localhost:3000/some-path"})
    assert response.status_code == 200


def test_csrf_fallback_banned_referer_fails() -> None:
    client = TestClient(app)
    # Referer matching attacker fails when Origin is absent
    response = client.post("/test-post", headers={"referer": "http://attacker.com/malicious-path"})
    assert response.status_code == 403


def test_csrf_safe_methods_ignore_origin() -> None:
    client = TestClient(app)
    # Safe methods (like GET) should ignore origin/referer verification and pass through
    response = client.get("/test-get", headers={"origin": "http://attacker.com"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
