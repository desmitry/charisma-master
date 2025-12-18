FROM ubuntu:22.04 AS builder

# Устанавливаем только необходимые пакеты
RUN --mount=type=cache,target=/var/cache/apt \
    apt update -y && \
    DEBIAN_FRONTEND=noninteractive apt install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3.11 \
    python3.11-venv \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем UV (можно зафиксировать версию)
ARG UV_VERSION=0.4.8
RUN curl -LsSf "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xz -C /usr/local/bin --strip-components=1 \
    && chmod +x /usr/local/bin/uv

ENV UV_TOOL_BIN_DIR=/usr/local/bin \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /backend

COPY pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY . .

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/backend/.venv/bin:$PATH"

WORKDIR /backend

RUN --mount=type=cache,target=/var/cache/apt \
    apt update -y && \
    apt upgrade -y && \
    apt install -y \
    libgl1 \
    ffmpeg \
    python3.11 \
    python3.11-venv \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser -m -d /home/appuser appuser

COPY --from=builder --chown=appuser:appuser /backend /backend

RUN mkdir -p /backend/app/media
RUN mkdir -p /backend/app/media/results

RUN chown -R appuser:appuser /backend/app

USER appuser

ENTRYPOINT []
