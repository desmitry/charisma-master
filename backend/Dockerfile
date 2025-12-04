# Use bookworm-slim because of opencv-python
FROM ghcr.io/astral-sh/uv:0.9.8-python3.13-bookworm-slim AS builder

ENV UV_TOOL_BIN_DIR=/usr/local/bin
ENV PYTHONDONTWRITEBYTECODE=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY . .

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt \
    apt update -y && \
    apt upgrade -y && \
    apt install -y \
    libgl1 \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appuser /app /app
RUN mkdir /app/media
RUN chown appuser:appuser /app/media
RUN mkdir /app/media/results
RUN chown appuser:appuser /app/media/results

USER appuser

ENTRYPOINT []