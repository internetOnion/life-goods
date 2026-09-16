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

from collections.abc import Iterable
from contextlib import suppress
from ipaddress import IPv4Network, IPv6Network, ip_address, ip_network
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

# API endpoints that intentionally serve cacheable binary assets are excluded
# from the ``Cache-Control: no-store`` default so proxied Open Food Facts images
# keep their own explicit cache policy.
_CACHEABLE_PATHS = frozenset({"/api/v1/open-food-facts-images"})

_IPNetwork = IPv4Network | IPv6Network


def normalize_trusted_proxy_cidrs(cidrs: Iterable[str]) -> tuple[str, ...]:
    """Validate and canonicalize configured trusted proxy networks."""

    normalized: list[str] = []
    seen: set[str] = set()
    for raw_cidr in cidrs:
        cidr = raw_cidr.strip()
        if not cidr:
            raise ValueError("Trusted proxy CIDRs must not be blank")
        try:
            network = ip_network(cidr, strict=False)
        except ValueError as error:
            raise ValueError(f"Invalid trusted proxy CIDR: {cidr!r}") from error
        canonical = str(network)
        if canonical not in seen:
            seen.add(canonical)
            normalized.append(canonical)
    return tuple(normalized)


class TrustedProxyClientMiddleware:
    """Resolve client addresses from forwarded headers only via trusted peers.

    The middleware rewrites the ASGI client scope before route handlers create a
    Request, allowing all per-client rate limiters to use the same identity.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        trusted_proxy_cidrs: Iterable[str] = (),
    ) -> None:
        self.app = app
        normalized_cidrs = normalize_trusted_proxy_cidrs(trusted_proxy_cidrs)
        self._trusted_proxy_networks: tuple[_IPNetwork, ...] = tuple(
            ip_network(cidr) for cidr in normalized_cidrs
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        client = scope.get("client")
        if not client or not self._is_trusted_proxy(client[0]):
            await self.app(scope, receive, send)
            return

        forwarded_client = self._forwarded_client(scope)
        if forwarded_client is None:
            await self.app(scope, receive, send)
            return

        rewritten_scope = dict(scope)
        rewritten_scope["client"] = (forwarded_client, client[1])
        await self.app(rewritten_scope, receive, send)

    def _is_trusted_proxy(self, host: str) -> bool:
        try:
            address = ip_address(host)
        except ValueError:
            return False
        return any(address in network for network in self._trusted_proxy_networks)

    def _forwarded_client(self, scope: Scope) -> str | None:
        forwarded_values = [
            value.decode("latin-1")
            for name, value in scope.get("headers", [])
            if name.lower() == b"x-forwarded-for"
        ]
        candidates = [
            candidate.strip()
            for value in forwarded_values
            for candidate in value.split(",")
        ]
        if not candidates or any(not candidate for candidate in candidates):
            return None

        parsed_candidates = []
        for candidate in candidates:
            try:
                parsed_candidates.append(ip_address(candidate))
            except ValueError:
                return None

        # The rightmost entry is closest to FastAPI. Skip configured proxy
        # hops and select the first untrusted address, preventing a client from
        # spoofing the left side of a proxy-appended X-Forwarded-For chain.
        for address in reversed(parsed_candidates):
            if not any(address in network for network in self._trusted_proxy_networks):
                return str(address)
        return None


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
