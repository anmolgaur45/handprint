"""Structured JSON logging via structlog."""

from __future__ import annotations

import logging
import re
import sys
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import MutableMapping

import structlog

# Google API Keys (e.g. AIzaSy...)
# JWTs (e.g. eyJ...)
# PEM blocks (e.g. -----BEGIN PRIVATE KEY-----)
SECRET_PATTERNS = [
    re.compile(r"AIzaSy[A-Za-z0-9_-]{33}"),
    re.compile(r"eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+"),
    re.compile(
        r"-----BEGIN[A-Z0-9\s_]+PRIVATE KEY-----(.*?)"
        r"-----END[A-Z0-9\s_]+PRIVATE KEY-----",
        re.DOTALL,
    ),
]

SENSITIVE_KEYS = {"api_key", "secret", "password", "token", "credential", "private_key", "auth"}


def redact_secrets(
    logger: Any, method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Redact secret-shaped strings and values of sensitive keys from logging output."""
    for key, value in list(event_dict.items()):
        if isinstance(value, str):
            # Redact if key indicates a secret field
            if any(s_key in key.lower() for s_key in SENSITIVE_KEYS):
                event_dict[key] = "[REDACTED]"
                continue

            # Redact based on pattern matches within values
            cleaned = value
            for pattern in SECRET_PATTERNS:
                cleaned = pattern.sub("[REDACTED]", cleaned)
            event_dict[key] = cleaned
        elif isinstance(value, dict):
            event_dict[key] = redact_secrets(logger, method_name, value)
    return event_dict


def setup_logging(*, debug: bool = False) -> None:
    """Configure structlog for JSON output to stdout.

    Cloud Run captures stdout automatically, so no file handler is needed.
    """
    log_level = logging.DEBUG if debug else logging.INFO

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            redact_secrets,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Also route stdlib logging through structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )
