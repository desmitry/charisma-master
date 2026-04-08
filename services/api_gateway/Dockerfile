FROM python:3.12-slim AS builder

ARG UV_VERSION=0.11.3

WORKDIR /build

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/build/.venv \
    PATH="/build/.venv/bin:$PATH" \
    UV_LINK_MODE=copy

RUN curl -LsSf "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xz -C /usr/local/bin --strip-components=1 \
    && chmod +x /usr/local/bin/uv

COPY pyproject.toml ./pyproject.toml
COPY uv.lock ./uv.lock
COPY packages/charisma_schemas ./packages/charisma_schemas
COPY packages/charisma_storage ./packages/charisma_storage
COPY services/api_gateway/pyproject.toml ./services/api_gateway/pyproject.toml

RUN uv sync --frozen --no-dev --package charisma-api-gateway

RUN uv build --wheel --out-dir /build/wheels ./packages/charisma_schemas
RUN uv build --wheel --out-dir /build/wheels ./packages/charisma_storage

RUN uv pip install --no-deps /build/wheels/*.whl

FROM python:3.12-slim AS runtime

WORKDIR /backend

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf python3.12 /usr/bin/python3

RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g 1000 -m -d /home/appuser appuser

COPY --from=builder --chown=appuser:appuser /build/.venv /backend/.venv

COPY --chown=appuser:appuser services/api_gateway/app ./app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/backend/.venv/bin:$PATH" \
    VIRTUAL_ENV=/backend/.venv

RUN sed -i '1s|^#!/build/.venv/bin/python|#!/backend/.venv/bin/python|' /backend/.venv/bin/*

USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
