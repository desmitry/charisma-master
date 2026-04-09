FROM python:3.12-slim

ARG UV_VERSION=0.11.3

WORKDIR /migrator

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/migrator/.venv \
    PATH="/migrator/.venv/bin:$PATH" \
    UV_LINK_MODE=copy

RUN curl -LsSf "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xz -C /usr/local/bin --strip-components=1 \
    && chmod +x /usr/local/bin/uv

COPY pyproject.toml ./pyproject.toml
COPY uv.lock ./uv.lock
COPY services/migrator/pyproject.toml ./services/migrator/pyproject.toml

RUN uv sync --frozen --no-dev --package charisma-migrator 

COPY services/migrator/migrate.py ./services/migrator/migrate.py

COPY docs/prompts ./services/migrator/docs/prompts
COPY docs/presets ./services/migrator/docs/presets

CMD ["python", "./services/migrator/migrate.py"]
