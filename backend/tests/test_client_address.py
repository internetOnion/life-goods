from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from lifegoods.core.security import TrustedProxyClientMiddleware


def _client_app(trusted_proxy_cidrs: tuple[str, ...]) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        TrustedProxyClientMiddleware,
        trusted_proxy_cidrs=trusted_proxy_cidrs,
    )

    @app.get("/client")
    def client_address(request: Request) -> dict[str, str]:
        return {"address": request.client.host if request.client is not None else "unknown"}

    return app


def test_untrusted_peer_cannot_spoof_forwarded_client_address() -> None:
    app = _client_app(("172.20.0.0/16",))

    with TestClient(app, client=("198.51.100.10", 50000)) as client:
        response = client.get(
            "/client",
            headers={"x-forwarded-for": "198.51.100.20"},
        )

    assert response.json() == {"address": "198.51.100.10"}


def test_trusted_proxy_resolves_the_original_forwarded_client() -> None:
    app = _client_app(("172.20.0.0/16",))

    with TestClient(app, client=("172.20.0.5", 50000)) as client:
        response = client.get(
            "/client",
            headers={"x-forwarded-for": "198.51.100.20, 172.20.0.6"},
        )

    assert response.json() == {"address": "198.51.100.20"}


def test_trusted_proxy_chain_uses_rightmost_untrusted_address() -> None:
    app = _client_app(("172.20.0.0/16",))

    with TestClient(app, client=("172.20.0.5", 50000)) as client:
        response = client.get(
            "/client",
            headers={
                "x-forwarded-for": "198.51.100.77, 172.20.0.6, 198.51.100.20"
            },
        )

    assert response.json() == {"address": "198.51.100.20"}


def test_malformed_forwarded_chain_falls_back_to_proxy_peer() -> None:
    app = _client_app(("172.20.0.0/16",))

    with TestClient(app, client=("172.20.0.5", 50000)) as client:
        single_invalid = client.get(
            "/client",
            headers={"x-forwarded-for": "not-an-ip"},
        )
        mixed_invalid = client.get(
            "/client",
            headers={"x-forwarded-for": "not-an-ip, 198.51.100.20"},
        )

    assert single_invalid.json() == {"address": "172.20.0.5"}
    assert mixed_invalid.json() == {"address": "172.20.0.5"}


def test_forwarded_ipv6_client_is_supported() -> None:
    app = _client_app(("fd00::/8",))

    with TestClient(app, client=("fd00::5", 50000)) as client:
        response = client.get(
            "/client",
            headers={"x-forwarded-for": "2001:db8::20"},
        )

    assert response.json() == {"address": "2001:db8::20"}
