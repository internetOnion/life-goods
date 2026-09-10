"""Cross-platform launcher for the loopback-only photo-comparison app."""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
    port_value = os.environ.get("LIFEGOODS_PHOTO_COMPARISON_PORT", "8765")
    try:
        port = int(port_value)
    except ValueError as error:
        raise SystemExit("LIFEGOODS_PHOTO_COMPARISON_PORT must be an integer.") from error
    if not 1 <= port <= 65_535:
        raise SystemExit("LIFEGOODS_PHOTO_COMPARISON_PORT must be between 1 and 65535.")
    uvicorn.run(
        "lifegoods.photo_comparison.app:app",
        host="127.0.0.1",
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
