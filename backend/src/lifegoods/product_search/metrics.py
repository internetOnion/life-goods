from __future__ import annotations

from typing import Protocol


class ProductSearchMetrics(Protocol):
    def observe(
        self,
        *,
        outcome: str,
        latency_ms: float,
        dataset_version: str | None,
    ) -> None: ...


class NoOpProductSearchMetrics:
    def observe(
        self,
        *,
        outcome: str,
        latency_ms: float,
        dataset_version: str | None,
    ) -> None:
        return None
