from __future__ import annotations

import argparse
import os
from pathlib import Path

import uvicorn


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"


def configured_port() -> int:
    """Return ATTVIZ_PORT from the process environment or the project .env file."""
    value = os.getenv("ATTVIZ_PORT")
    if value is None and ENV_PATH.is_file():
        for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, candidate = line.split("=", 1)
            if key.strip() == "ATTVIZ_PORT":
                value = candidate.strip().strip('"\'')

    if value is None:
        raise RuntimeError(f"ATTVIZ_PORT is not configured in the environment or {ENV_PATH}")
    try:
        port = int(value)
    except ValueError as exc:
        raise RuntimeError("ATTVIZ_PORT must be an integer") from exc
    if not 1 <= port <= 65535:
        raise RuntimeError("ATTVIZ_PORT must be between 1 and 65535")
    return port


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ATT&CK Visualizer")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    uvicorn.run("app.main:app", host=args.host, port=configured_port(), reload=args.reload)


if __name__ == "__main__":
    main()
