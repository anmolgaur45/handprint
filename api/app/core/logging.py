"""Structured JSON logging via structlog."""

from __future__ import annotations

import logging
import sys

import structlog


def setup_logging(*, debug: bool = False) -> None:
    """Configure structlog for JSON output to stdout.

    Cloud Run captures stdout automatically, so no file handler is needed.
    """
    log_level = logging.DEBUG if debug else logging.INFO

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
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
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Also route stdlib logging through structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )
