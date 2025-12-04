FROM ghcr.io/astral-sh/uv:0.9.8-trixie-slim

# Settings for UV
ENV UV_COMPILE_BYTECODE=1
ENV UV_TOOL_BIN_DIR=/usr/local/bin

# Copy base project files
COPY . /backend

# Set working dir
WORKDIR /backend

# Run UV commands
RUN uv sync --locked --no-install-project --no-dev

# Add uv installed tools to path
ENV PATH="/urfu-daddy/.venv/bin:$PATH"

# Add 
RUN apt update -y && apt upgrade -y && apt install libgl1 libglib2.0-0 -y

# Clear entrypoint
ENTRYPOINT []
