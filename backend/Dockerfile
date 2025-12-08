# Use bookworm-slim because of opencv-python
FROM ghcr.io/astral-sh/uv:0.9.8-python3.11-bookworm-slim AS builder

ENV UV_TOOL_BIN_DIR=/usr/local/bin
ENV PYTHONDONTWRITEBYTECODE=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /backend

COPY pyproject.toml uv.lock ./

# Mount cache for faster subsequent builds
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY . .

# Sync the project itself
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ---------------------------------------
# Runtime Stage
# ---------------------------------------
FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/backend/.venv/bin:$PATH"

WORKDIR /backend

# FIX 1: Fixed apt "Exit Code 100"
# - Switched 'apt' to 'apt-get' (better for scripts)
# - Removed 'apt upgrade' (causes the crash/bloat)
# - Added '--no-install-recommends' (saves space)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser appuser

# FIX 2: Optimized COPY
# You were copying .venv and then overwriting it by copying /backend (which contains .venv)
# This single command copies everything (source + venv) with correct permissions at once.
COPY --from=builder --chown=appuser:appuser /backend /backend

# Create media directories and ensure permissions
# logic: We only need to chown the new folders, /backend is already owned by appuser from the COPY
RUN mkdir -p /backend/app/media/results && \
    chown -R appuser:appuser /backend/app/media

USER appuser

ENTRYPOINT []