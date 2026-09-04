from datetime import UTC, datetime
from typing import Any, cast
from urllib.parse import quote

import httpx2 as httpx

from lifegoods.core.settings import (
    DEFAULT_OPEN_FOOD_FACTS_API_BASE_URL,
    DEFAULT_OPEN_FOOD_FACTS_API_TIMEOUT_SECONDS,
    DEFAULT_OPEN_FOOD_FACTS_USER_AGENT,
)
from lifegoods.identifiers import NormalizedIdentifier
from lifegoods.product_lookup.models import (
    DatasetSnapshot,
    DatasetUnavailableError,
    InvalidSourceRecordError,
    SourceRecord,
)


class OpenFoodFactsApiSource:
    """Read complete Product Records directly from the Open Food Facts API.

    This source is intentionally opt-in for local development. It is not a
    fallback for the configured local Dataset Snapshot.
    """

    def __init__(
        self,
        client: httpx.Client,
        *,
        base_url: str = DEFAULT_OPEN_FOOD_FACTS_API_BASE_URL,
        timeout_seconds: float = DEFAULT_OPEN_FOOD_FACTS_API_TIMEOUT_SECONDS,
        user_agent: str = DEFAULT_OPEN_FOOD_FACTS_USER_AGENT,
    ) -> None:
        if timeout_seconds <= 0:
            raise ValueError("Open Food Facts API timeout must be greater than zero")
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds
        self._user_agent = user_agent

    def resolve_product_lookup_snapshot(self) -> DatasetSnapshot:
        return DatasetSnapshot(
            version="open-food-facts-live-api",
            retrieved_at=datetime.now(UTC),
            collection_name="",
        )

    def fetch_source_record(
        self,
        identifier: NormalizedIdentifier,
        snapshot: DatasetSnapshot,
    ) -> SourceRecord | None:
        del snapshot
        url = f"{self._base_url}/product/{quote(identifier.value, safe='')}.json"
        try:
            response = self._client.get(
                url,
                headers={
                    "accept": "application/json",
                    "user-agent": self._user_agent,
                },
                timeout=self._timeout_seconds,
                follow_redirects=False,
            )
            if response.status_code in {404, 410}:
                return None
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, TypeError, ValueError) as error:
            raise DatasetUnavailableError(
                "Open Food Facts API is temporarily unavailable"
            ) from error

        if not isinstance(payload, dict):
            raise InvalidSourceRecordError("Open Food Facts API returned an invalid payload")
        if payload.get("status") == 0:
            return None

        product = payload.get("product")
        if payload.get("status") != 1 or not isinstance(product, dict):
            raise InvalidSourceRecordError("Open Food Facts API returned an invalid Product")
        if product.get("code") != identifier.value:
            raise InvalidSourceRecordError("Open Food Facts API returned the wrong Barcode")

        source_record: dict[str, Any] = {
            key: value for key, value in product.items() if key != "_id"
        }
        return cast(SourceRecord, source_record)
