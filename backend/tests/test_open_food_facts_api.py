from datetime import UTC

import httpx2 as httpx
import pytest

from lifegoods.identifiers import normalize_identifier
from lifegoods.open_food_facts import OpenFoodFactsApiSource
from lifegoods.product_lookup.models import DatasetUnavailableError, InvalidSourceRecordError


def _source(response: httpx.Response) -> OpenFoodFactsApiSource:
    client = httpx.Client(transport=httpx.MockTransport(lambda _request: response))
    return OpenFoodFactsApiSource(
        client,
        base_url="https://world.openfoodfacts.org/api/v2",
        user_agent="LifeGoods/test",
    )


def test_live_api_source_returns_the_complete_product_object() -> None:
    record = {
        "code": "3017620422003",
        "product_name": "Nutella",
        "nutriments": {"energy-kcal_100g": 539},
        "images": {"front": {"display": {"en": "https://example.test/front.jpg"}}},
        "_id": "storage-only",
    }
    source = _source(httpx.Response(200, json={"status": 1, "product": record}))
    snapshot = source.resolve_product_lookup_snapshot()

    result = source.fetch_source_record(normalize_identifier("3017620422003"), snapshot)

    assert result == {key: value for key, value in record.items() if key != "_id"}
    assert snapshot.version == "open-food-facts-live-api"
    assert snapshot.retrieved_at.tzinfo == UTC


def test_live_api_source_returns_none_for_an_unknown_product() -> None:
    source = _source(httpx.Response(200, json={"status": 0, "status_verbose": "product not found"}))

    result = source.fetch_source_record(
        normalize_identifier("3017620422003"), source.resolve_product_lookup_snapshot()
    )

    assert result is None


def test_live_api_source_translates_transport_failures() -> None:
    def fail(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline")

    client = httpx.Client(transport=httpx.MockTransport(fail))
    source = OpenFoodFactsApiSource(client)

    with pytest.raises(DatasetUnavailableError):
        source.fetch_source_record(
            normalize_identifier("3017620422003"), source.resolve_product_lookup_snapshot()
        )


def test_live_api_source_rejects_a_mismatched_product() -> None:
    source = _source(
        httpx.Response(200, json={"status": 1, "product": {"code": "0000000000000"}})
    )

    with pytest.raises(InvalidSourceRecordError):
        source.fetch_source_record(
            normalize_identifier("3017620422003"), source.resolve_product_lookup_snapshot()
        )
