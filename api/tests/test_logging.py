"""Unit tests for the structlog secret redaction processor."""

from __future__ import annotations

from app.core.logging import redact_secrets


def test_redact_secrets_by_pattern() -> None:
    # 1. Google API Key pattern
    event = {"msg": "Connecting with key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q"}
    res = redact_secrets(None, "info", event)
    assert res["msg"] == "Connecting with key [REDACTED]"

    # 2. JWT pattern (using a non-sensitive key name to test value pattern regex)
    event = {
        "msg": (
            "Found token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9."
            "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ."
            "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        )
    }
    res = redact_secrets(None, "info", event)
    assert res["msg"] == "Found token: [REDACTED]"

    # 3. PEM private key pattern
    pem = (
        "-----BEGIN PRIVATE KEY-----\n"
        "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD...==\n"
        "-----END PRIVATE KEY-----"
    )
    event = {"key_content": pem}
    res = redact_secrets(None, "info", event)
    assert res["key_content"] == "[REDACTED]"


def test_redact_secrets_by_key_names() -> None:
    # Keys with sensitive names should have their values completely replaced with [REDACTED]
    event = {
        "db_password": "my-secret-password-123",
        "api_key": "rawkey",
        "auth_token": "bearer xyz",
        "safe_field": "hello world",
    }
    res = redact_secrets(None, "info", event)

    assert res["db_password"] == "[REDACTED]"
    assert res["api_key"] == "[REDACTED]"
    assert res["auth_token"] == "[REDACTED]"
    assert res["safe_field"] == "hello world"


def test_redact_secrets_nested() -> None:
    # Nested dictionaries should also be recursively cleaned
    event = {
        "event_type": "request",
        "details": {
            "headers": {
                "authorization": "Bearer eyJhbGciOiJSUzI1NiIs.eyJzdWIiOiIxMjMifQ.signature"
            },
            "body": {"password": "secretpwd", "username": "alice"},
        },
    }
    res = redact_secrets(None, "info", event)

    # "authorization" contains "auth" which is in SENSITIVE_KEYS
    assert res["details"]["headers"]["authorization"] == "[REDACTED]"
    assert res["details"]["body"]["password"] == "[REDACTED]"
    assert res["details"]["body"]["username"] == "alice"
