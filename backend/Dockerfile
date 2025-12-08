# Use bookworm-slim because of opencv-python
FROM ghcr.io/astral-sh/uv:0.9.8-python3.11-bookworm-slim AS builder

ENV UV_TOOL_BIN_DIR=/usr/local/bin
ENV PYTHONDONTWRITEBYTECODE=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /backend

COPY pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY . .

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/backend/.venv/bin:$PATH"

WORKDIR /backend

RUN --mount=type=cache,target=/var/cache/apt \
    apt update -y && \
    apt upgrade -y && \
    apt install -y \
    libgl1 \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser -m -d /home/appuser appuser

COPY --from=builder --chown=appuser:appuser /backend/.venv /backend/.venv
COPY --from=builder --chown=appuser:appuser /backend /backend
RUN mkdir /backend/app/media
RUN mkdir /backend/app/media/results

RUN chown -R appuser:appuser /backend/app

USER appuser

ENTRYPOINT []