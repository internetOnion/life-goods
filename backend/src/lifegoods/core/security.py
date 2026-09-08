"""Cross-cutting HTTP response hardening for the LifeGoods API.

This middleware adds defense-in-depth HTTP response headers to every API
response. It is intentionally conservative:

- It only ADDS a header when the route handler has not already set one, so the
  image proxy route (which sets its own ``Cache-Control`` and
  ``X-Content-Type-Options``) keeps its behavior.
- It does not set frame/CSP document policies on the JSON API; those belong on
  the HTML document served by the reverse proxy, where standalone-web and
  Telegram Mini App embedding can be controlled appropriately.
"""

from __future__ import annotations

from contextlib import suppress
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# API endpoints that intentionally serve cacheable binary assets are excluded
# from the ``Cache-Control: no-store`` default so proxied Open Food Facts images
# keep their own explicit cache policy.
_CACHEABLE_PATHS = frozenset({"/api/v1/open-food-facts-images"})


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: Any,
        *,
        frame_options: str = "SAMEORIGIN",
    ) -> None:
        super().__init__(app)
        self._frame_options = frame_options

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", self._frame_options)
        # Remove the framework banner to avoid exposing the server stack.
        with suppress(KeyError, AttributeError):
            del response.headers["Server"]

        path = request.url.path
        if path.startswith("/api/v1/") and path not in _CACHEABLE_PATHS:
            response.headers.setdefault("Cache-Control", "no-store")

        return response
