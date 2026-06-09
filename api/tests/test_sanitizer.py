"""Unit tests for the input sanitizer utility and middleware."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core.sanitizer import sanitize_text
from app.middleware.sanitizer import InputSanitizerMiddleware


def test_sanitize_text_nfc_normalization() -> None:
    # Decomposed "e" + acute accent (u0301) should become normalized
    # to precomposed "e" with acute (u00e9)
    decomposed = "cafe\u0301"
    sanitized = sanitize_text(decomposed)
    assert len(sanitized) == 4
    assert sanitized == "café"


def test_sanitize_text_control_characters() -> None:
    # Null byte, bell character, etc. should be stripped, but newlines,
    # carriage returns, and tabs kept.
    text = "line1\nline2\twith\u0000null\u0007bell"
    sanitized = sanitize_text(text)
    assert sanitized == "line1\nline2\twithnullbell"


def test_sanitize_text_zero_width_characters() -> None:
    # Zero width space (u200b) and zero width non-joiner (u200c) should be stripped.
    text = "zero\u200bwidth\u200cjoiner"
    sanitized = sanitize_text(text)
    assert sanitized == "zerowidthjoiner"


def test_sanitize_text_bidi_overrides() -> None:
    # Bidi override characters (e.g. \u202e, \u202d) should be stripped.
    text = "right\u202eto\u202dleft"
    sanitized = sanitize_text(text)
    assert sanitized == "righttoleft"


# FastAPI test harness for middleware
app = FastAPI()
app.add_middleware(InputSanitizerMiddleware)


@app.post("/test-post")
async def handle_post(request: Request) -> dict[str, Any]:
    data = await request.json()
    return {"data": data}


@app.get("/test-get")
async def handle_get(request: Request) -> dict[str, Any]:
    params = dict(request.query_params)
    return {"params": params}


def test_sanitizer_middleware_json_body() -> None:
    client = TestClient(app)
    # Payload contains zero width spaces, control characters, bidi overrides, and decomposed unicode
    payload = {
        "text": "cafe\u0301\u200b\u0000text\u202eoverride",
        "nested": {"key": "value\u200c"},
        "list": ["item\u0007"],
    }
    response = client.post("/test-post", json=payload)
    assert response.status_code == 200
    res_data = response.json()["data"]

    assert res_data["text"] == "cafétextoverride"
    assert res_data["nested"]["key"] == "value"
    assert res_data["list"] == ["item"]


def test_sanitizer_middleware_query_params() -> None:
    client = TestClient(app)
    # Query parameters with decomposed characters and control characters (percent encoded)
    response = client.get("/test-get?origin=caf%C3%A9%E2%80%8B&destination=Bengaluru%00")
    assert response.status_code == 200
    params = response.json()["params"]

    assert params["origin"] == "café"
    assert params["destination"] == "Bengaluru"
