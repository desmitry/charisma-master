#!/usr/bin/env python3
"""Export OpenAPI schema from FastAPI app to JSON file."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app  # noqa: E402


def main():
    schema = app.openapi()
    output_path = Path(__file__).parent.parent / "docs" / "openapi.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, ensure_ascii=False, indent=2)
    print(f"OpenAPI schema exported to {output_path}")


if __name__ == "__main__":
    main()
