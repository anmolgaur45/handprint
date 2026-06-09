# Use a pinned official lightweight Python image
FROM python:3.12-slim-bookworm AS builder

# Pin uv to a version compatible with the lockfile (revision 3 requires uv >= 0.5)
COPY --from=ghcr.io/astral-sh/uv:0.5.29 /uv /bin/uv

WORKDIR /app

# Copy lockfiles first for layer caching
COPY pyproject.toml uv.lock ./

# Install production dependencies from the lockfile into a virtualenv
RUN uv sync --frozen --no-dev

# Final lightweight runner image
FROM python:3.12-slim-bookworm

# Create a non-root system user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /bin/bash appuser

WORKDIR /app

# Copy the virtualenv and application code
COPY --from=builder /app/.venv /app/.venv
COPY app/ /app/app/

# Set env and path
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Expose port and run as non-root
USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
