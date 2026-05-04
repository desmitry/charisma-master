FROM nvidia/cuda:13.2.0-runtime-ubuntu24.04 AS builder

ARG UV_VERSION=0.11.3
ARG VERSION=0.0.0

WORKDIR /build

ENV SETUPTOOLS_SCM_PRETEND_VERSION=${VERSION}

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3.12 \
    python3.12-venv \
    python3-pip \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xz -C /usr/local/bin --strip-components=1 \
    && chmod +x /usr/local/bin/uv

COPY pyproject.toml ./pyproject.toml
COPY uv.lock ./uv.lock
COPY packages/charisma_schemas ./packages/charisma_schemas
COPY packages/charisma_storage ./packages/charisma_storage
COPY services/ml_worker/pyproject.toml ./services/ml_worker/pyproject.toml

ENV VIRTUAL_ENV=/build/.venv \
    PATH="/build/.venv/bin:$PATH"

RUN uv sync --frozen --no-dev --package charisma-ml-worker

RUN uv build --wheel --out-dir /build/wheels ./packages/charisma_schemas
RUN uv build --wheel --out-dir /build/wheels ./packages/charisma_storage

RUN uv pip install --no-deps /build/wheels/*.whl

FROM nvidia/cuda:13.2.0-runtime-ubuntu24.04 AS runtime

WORKDIR /backend

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    python3.12 \
    libgl1 \
    ffmpeg \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf python3.12 /usr/bin/python3

RUN groupadd -r appuser && \
    useradd -r -g appuser -m -d /home/appuser appuser

COPY --from=builder --chown=appuser:appuser /build/.venv /backend/.venv

COPY --chown=appuser:appuser services/ml_worker/app ./app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/backend/.venv/bin:$PATH" \
    VIRTUAL_ENV=/backend/.venv

RUN sed -i '1s|^#!/build/.venv/bin/python|#!/backend/.venv/bin/python|' /backend/.venv/bin/*

RUN mkdir -p /tmp/matplotlib /tmp/numba && \
    chown -R appuser:appuser /tmp/matplotlib /tmp/numba

USER appuser

CMD ["celery", "-A", "app.celery_app", "worker", "--loglevel=info", "--pool=solo"]
