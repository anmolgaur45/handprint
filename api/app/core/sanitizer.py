"""Utility to sanitize user input text before it reaches database/LLM models."""

from __future__ import annotations

import unicodedata
import urllib.parse
from typing import Any


def sanitize_text(text: str) -> str:
    """Perform Unicode NFC normalization and strip formatting/control characters.

    Removes control characters, zero-width characters, and bidi overrides,
    but preserves standard whitespace characters (newlines, tabs).
    """
    if not text:
        return text

    # Unicode NFC normalization
    normalized = unicodedata.normalize("NFC", text)

    # Filter characters
    cleaned_chars = []
    for char in normalized:
        category = unicodedata.category(char)
        # Category 'C' represents control (Cc), format (Cf), surrogate (Cs), etc.
        # Preserve safe whitespace characters.
        if category.startswith("C"):
            if char in ("\n", "\r", "\t"):
                cleaned_chars.append(char)
        else:
            cleaned_chars.append(char)

    return "".join(cleaned_chars)


def sanitize_json_value(value: Any) -> Any:
    """Recursively sanitize all string values in a JSON-compatible object."""
    if isinstance(value, str):
        return sanitize_text(value)
    elif isinstance(value, dict):
        return {k: sanitize_json_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [sanitize_json_value(v) for v in value]
    return value


def sanitize_query_string(query_string: bytes) -> bytes:
    """Decode, sanitize values, and re-encode a URL query string."""
    if not query_string:
        return query_string
    decoded = query_string.decode("utf-8", errors="ignore")
    parsed = urllib.parse.parse_qsl(decoded, keep_blank_values=True)
    sanitized = [(k, sanitize_text(v)) for k, v in parsed]
    return urllib.parse.urlencode(sanitized).encode("utf-8")
