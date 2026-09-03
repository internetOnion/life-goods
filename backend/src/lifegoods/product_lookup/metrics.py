from typing import Protocol


class ProductLookupMetrics(Protocol):
    def observe(
        self,
        *,
        outcome: str,
        latency_ms: float,
        cache_status: str | None,
        dataset_version: str | None,
    ) -> None: ...


class NoOpProductLookupMetrics:
    def observe(
        self,
        *,
        outcome: str,
        latency_ms: float,
        cache_status: str | None,
        dataset_version: str | None,
    ) -> None:
        return None
