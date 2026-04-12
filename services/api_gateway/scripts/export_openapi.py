#!/usr/bin/env python3
"""Export the OpenAPI schema from the FastAPI application to a JSON file.

Usage:
    python -m scripts.export_openapi

The generated file is written to ``services/api_gateway/docs/openapi.json``.
"""

import json
import sys
from pathlib import Path

# Ensure the api_gateway package is importable when running the script
# from the repository root or from the services/api_gateway directory.
_GATEWAY_DIR = Path(__file__).resolve().parent.parent
if str(_GATEWAY_DIR) not in sys.path:
    sys.path.insert(0, str(_GATEWAY_DIR))

from app.main import app  # noqa: E402

DOCS_DIR = _GATEWAY_DIR / "docs"
OUTPUT_PATH = DOCS_DIR / "openapi.json"


def main() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    schema = app.openapi()
    OUTPUT_PATH.write_text(
        json.dumps(schema, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"OpenAPI schema exported to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
