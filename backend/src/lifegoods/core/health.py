"""Read-only deployment probes. Never return dependency errors or credentials."""

from collections.abc import Callable
from typing import Any

import redis
from fastapi import APIRouter
from pydantic import BaseModel
from pymongo import MongoClient
from starlette.responses import JSONResponse

from lifegoods.core.settings import Settings
from lifegoods.generated_data.schema import verify_generated_data_schema
from lifegoods.open_food_facts.dataset import OpenFoodFactsDatasetSource
from lifegoods.open_food_facts.search_index import validate_search_index_readiness


class HealthStatus(BaseModel):
    status: str


class ReadinessProbe:
    def __init__(self, settings: Settings) -> None:
        self.off_client: MongoClient[dict[str, Any]] = MongoClient(
            settings.off_mongodb_uri,
            serverSelectionTimeoutMS=settings.off_mongodb_timeout_ms,
            connectTimeoutMS=settings.off_mongodb_timeout_ms,
            socketTimeoutMS=settings.off_mongodb_timeout_ms,
        )
        self.generated_client: MongoClient[dict[str, Any]] = MongoClient(
            settings.generated_mongodb_uri,
            serverSelectionTimeoutMS=settings.generated_mongodb_timeout_ms,
            connectTimeoutMS=settings.generated_mongodb_timeout_ms,
            socketTimeoutMS=settings.generated_mongodb_timeout_ms,
        )
        self.off = self.off_client[settings.off_mongodb_database]
        self.generated = self.generated_client[settings.generated_mongodb_database]
        self.redis = redis.Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=settings.redis_timeout_seconds,
            socket_timeout=settings.redis_timeout_seconds,
        )

    def __call__(self) -> bool:
        self.off.command("ping")
        self.generated.command("ping")
        # Resolve afresh: a health probe must not reuse a cached manifest.
        snapshot = OpenFoodFactsDatasetSource(self.off).resolve_product_lookup_snapshot()
        indexes = self.off[snapshot.collection_name].index_information()
        if not any(
            list(info["key"]) == [("code", 1)] and info.get("unique") for info in indexes.values()
        ):
            return False
        validate_search_index_readiness(self.off, snapshot.version)
        verify_generated_data_schema(self.generated)
        return bool(self.redis.ping())

    def close(self) -> None:
        self.off_client.close()
        self.generated_client.close()
        self.redis.close()


def build_health_router(probe: Callable[[], bool]) -> APIRouter:
    router = APIRouter(prefix="/api/health", tags=["Operations"])

    @router.get("/live", response_model=HealthStatus)
    def live() -> HealthStatus:
        return HealthStatus(status="alive")

    @router.get(
        "/ready",
        response_model=HealthStatus,
        responses={503: {"model": HealthStatus, "description": "Dependencies not ready"}},
    )
    def ready() -> JSONResponse:
        try:
            healthy = probe()
        except Exception:
            healthy = False
        return JSONResponse(
            {"status": "ready" if healthy else "not_ready"},
            status_code=200 if healthy else 503,
            headers={"Cache-Control": "no-store"},
        )

    return router
