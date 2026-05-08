#!/usr/bin/env python3
"""Compile protobuf schemas to Python gRPC files."""

import subprocess
import sys
from pathlib import Path


def main():
    project_root = Path(__file__).parent.parent
    proto_dir = project_root / "packages" / "proto"

    output_dir = (
        project_root / "services" / "api_gateway" / "app" / "proto_gen"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    proto_files = list(proto_dir.glob("*.proto")) + list(
        (proto_dir / "account").glob("*.proto")
    )

    if not proto_files:
        print("No proto files found!")
        sys.exit(1)

    for proto_file in proto_files:
        print(f"Compiling {proto_file}...")
        try:
            subprocess.run(
                [
                    "python",
                    "-m",
                    "grpc_tools.protoc",
                    f"--proto_path={proto_dir}",
                    f"--python_out={output_dir}",
                    f"--grpc_python_out={output_dir}",
                    str(proto_file),
                ],
                check=True,
            )
            print(f"  Success: {proto_file.name}")
        except subprocess.CalledProcessError as e:
            print(f"  Failed: {e}")
            sys.exit(1)

    print(f"\nGenerated files in {output_dir}")


if __name__ == "__main__":
    main()
