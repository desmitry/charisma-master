FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

RUN --mount=type=cache,target=/var/cache/apt \
    apt update -y && \
    DEBIAN_FRONTEND=noninteractive apt install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3.11 \
    python3-pip \
    libgl1 \
    ffmpeg \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ARG UV_VERSION=0.4.8
RUN curl -LsSf "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xz -C /usr/local/bin --strip-components=1 \
    && chmod +x /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /backend

COPY pyproject.toml uv.lock ./

COPY . .

RUN uv pip install --system --no-cache-dir -r pyproject.toml

# Create appuser with fixed UID/GID 1000 to match host bind-mount ownership
RUN groupadd -g 1000 appuser && useradd -u 1000 -g appuser -m -d /home/appuser appuser && \
    mkdir -p /backend/app/media/results && \
    chown -R appuser:appuser /backend

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Container starts as root; entrypoint creates media dirs and drops to appuser
ENTRYPOINT ["/entrypoint.sh"]
