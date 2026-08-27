from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest

from lifegoods.adapters.open_food_facts import OpenFoodFactsPackageSource
from lifegoods.matching.external_source import (
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageUnavailable,
    ExternalSourceUnavailableReason,
)
from lifegoods.matching.identifier import IdentifierScheme, NormalizedIdentifier

FIXTURES = Path(__file__).parent / "fixtures" / "open_food_facts"


class MutableClock:
    def __init__(self) -> None:
        self.monotonic_value = 100.0
        self.utc_value = datetime(2026, 8, 24, 10, 0, tzinfo=UTC)

    def monotonic(self) -> float:
        return self.monotonic_value

    def utc_now(self) -> datetime:
        return self.utc_value

    def advance(self, seconds: float) -> None:
        self.monotonic_value += seconds
        self.utc_value = datetime.fromtimestamp(
            self.utc_value.timestamp() + seconds,
            tz=UTC,
        )


def test_complete_record_is_returned_with_source_metadata_and_raw_response() -> None:
    raw_response = (FIXTURES / "complete.json").read_bytes()
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200, content=raw_response, headers={"content-type": "application/json"}
        )

    client = httpx.Client(transport=httpx.MockTransport(respond))
    retrieved_at = datetime(2026, 8, 24, 8, 30, tzinfo=UTC)
    source = OpenFoodFactsPackageSource(client, utc_now=lambda: retrieved_at)

    result = source.lookup(
        NormalizedIdentifier(value="4006381333931", scheme=IdentifierScheme.EAN_13)
    )

    assert isinstance(result, ExternalPackageFound)
    assert result.record.identifier == "4006381333931"
    assert result.record.source_record_id == "4006381333931"
    assert result.record.source_url == "https://world.openfoodfacts.org/product/4006381333931"
    assert result.record.source.name == "Open Food Facts"
    assert result.record.source.source_type == "COMMUNITY_DATABASE"
    assert result.record.source.base_url == "https://world.openfoodfacts.org"
    assert result.record.source.attribution == "Open Food Facts contributors"
    assert result.record.source.database_license == "ODbL"
    assert result.record.source.contents_license == "Database Contents License"
    assert result.record.source.image_license == "CC BY-SA"
    assert result.record.source.terms_version is None
    assert result.record.retrieved_at == retrieved_at
    assert result.record.source_revision == "1787462400"
    assert result.record.raw_response == raw_response
    assert [(name.value, name.language) for name in result.record.names] == [
        ("Dark Chocolate", "en"),
        ("Dark Chocolate", "en"),
        ("សូកូឡាខ្មៅ", "km"),
        ("ดาร์กช็อกโกแลต", "th"),
        ("Sô-cô-la đen", "vi"),
        ("黑巧克力", "zh"),
    ]
    assert result.record.brands is not None
    assert result.record.brands.value == ("Example Foods", "Example Brand")
    assert result.record.quantity is not None
    assert result.record.quantity.value == "100 g"
    assert result.record.allergen_declaration is not None
    assert result.record.allergen_declaration.language == "en"
    assert result.record.trace_declaration is not None
    assert result.record.trace_declaration.language == "en"
    assert result.record.additives is not None
    assert result.record.additives.value == ("en:e322", "en:e330")
    assert result.record.manufacturing_places is not None
    assert result.record.manufacturing_places.value == "Cambodia"
    assert [(item.value, item.language) for item in result.record.storage_conditions] == [
        ("Keep in a cool, dry place", "en"),
        ("រក្សាទុកកន្លែងត្រជាក់ និងស្ងួត", "km"),
    ]
    assert result.record.halal_label_claim is not None
    assert result.record.halal_label_claim.value == ("en:halal",)
    assert len(result.record.selected_images) == 3
    assert {value.source_field: value.value for value in result.record.nutrition} == {
        "nutriments": {"energy-kcal_100g": 598, "fat_100g": 43},
        "nutrition_data_per": "100g",
        "serving_size": "25 g",
    }
    assert result.record.packaging_languages is not None
    assert result.record.packaging_languages.value == ("en:english", "en:khmer")
    assert result.record.countries_sold is not None
    assert result.record.countries_sold.value == ("en:cambodia", "en:thailand")

    assert len(requests) == 1
    request = requests[0]
    assert request.url.path == "/api/v3/product/4006381333931.json"
    assert set(request.url.params["fields"].split(",")) == {
        "allergens",
        "allergens_tags",
        "additives_tags",
        "brands",
        "conservation_conditions",
        "conservation_conditions_en",
        "conservation_conditions_km",
        "conservation_conditions_th",
        "conservation_conditions_vi",
        "conservation_conditions_zh",
        "code",
        "countries_tags",
        "ingredients_text",
        "ingredients_text_en",
        "ingredients_text_km",
        "ingredients_text_th",
        "ingredients_text_vi",
        "ingredients_text_zh",
        "lang",
        "languages_tags",
        "labels_tags",
        "last_modified_t",
        "manufacturing_places",
        "nutriments",
        "nutrition_data_per",
        "nutrition_data_prepared_per",
        "product_name",
        "product_name_en",
        "product_name_km",
        "product_name_th",
        "product_name_vi",
        "product_name_zh",
        "quantity",
        "selected_images",
        "serving_size",
        "traces",
        "traces_tags",
    }
    assert request.headers["accept"] == "application/json"
    assert request.headers["user-agent"] == (
        "LifeGoods/0.1.0 (https://github.com/internetOnion/life-goods)"
    )


def test_sparse_record_keeps_missing_evidence_absent() -> None:
    raw_response = (FIXTURES / "sparse.json").read_bytes()
    client = httpx.Client(
        transport=httpx.MockTransport(lambda _request: httpx.Response(200, content=raw_response))
    )
    source = OpenFoodFactsPackageSource(client)

    result = source.lookup(
        NormalizedIdentifier(value="8850000000003", scheme=IdentifierScheme.EAN_13)
    )

    assert isinstance(result, ExternalPackageFound)
    assert [(name.value, name.language, name.source_field) for name in result.record.names] == [
        ("ขนมตัวอย่าง", "th", "product_name_th")
    ]
    assert result.record.brands is None
    assert result.record.quantity is None
    assert result.record.selected_images == ()
    assert result.record.ingredient_texts == ()
    assert result.record.allergen_declaration is None
    assert result.record.allergen_tags is None
    assert result.record.trace_declaration is None
    assert result.record.trace_tags is None
    assert result.record.additives is None
    assert result.record.manufacturing_places is None
    assert result.record.storage_conditions == ()
    assert result.record.halal_label_claim is None
    assert result.record.nutrition == ()
    assert result.record.packaging_languages is not None
    assert result.record.packaging_languages.value == ("en:thai",)
    assert result.record.countries_sold is None
    assert result.record.source_revision is None


def test_confirmed_not_found_is_distinct_and_preserves_response() -> None:
    raw_response = b'{"result":{"id":"product_not_found"}}'
    retrieved_at = datetime(2026, 8, 24, 9, 0, tzinfo=UTC)
    client = httpx.Client(
        transport=httpx.MockTransport(lambda _request: httpx.Response(404, content=raw_response))
    )
    source = OpenFoodFactsPackageSource(client, utc_now=lambda: retrieved_at)

    result = source.lookup(
        NormalizedIdentifier(value="4006381333931", scheme=IdentifierScheme.EAN_13)
    )

    assert isinstance(result, ExternalPackageNotFound)
    assert result.identifier == "4006381333931"
    assert result.retrieved_at == retrieved_at
    assert result.raw_response == raw_response
    assert result.source.name == "Open Food Facts"
    assert result.request_url.startswith(
        "https://world.openfoodfacts.org/api/v3/product/4006381333931.json"
    )


def test_unconfirmed_not_found_response_is_unavailable_and_not_cached() -> None:
    request_count = 0

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(404, json={"error": "route missing"})

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(respond))
    )
    identifier = NormalizedIdentifier(
        value="4006381333931", scheme=IdentifierScheme.EAN_13
    )

    first = source.lookup(identifier)
    second = source.lookup(identifier)

    assert first == ExternalPackageUnavailable(
        identifier="4006381333931",
        reason=ExternalSourceUnavailableReason.INVALID_RESPONSE,
        status_code=404,
    )
    assert second == first
    assert request_count == 2


@pytest.mark.parametrize(
    ("status_code", "expected_reason"),
    [
        (429, ExternalSourceUnavailableReason.RATE_LIMITED),
        (503, ExternalSourceUnavailableReason.UPSTREAM_ERROR),
        (400, ExternalSourceUnavailableReason.UNEXPECTED_STATUS),
    ],
)
def test_non_success_status_is_unavailable(
    status_code: int, expected_reason: ExternalSourceUnavailableReason
) -> None:
    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(status_code, json={"status": "failure"})
        )
    )
    source = OpenFoodFactsPackageSource(client)

    result = source.lookup(
        NormalizedIdentifier(value="4006381333931", scheme=IdentifierScheme.EAN_13)
    )

    assert result == ExternalPackageUnavailable(
        identifier="4006381333931",
        reason=expected_reason,
        status_code=status_code,
    )


@pytest.mark.parametrize(
    ("error_type", "expected_reason"),
    [
        (httpx.ReadTimeout, ExternalSourceUnavailableReason.TIMEOUT),
        (httpx.ConnectError, ExternalSourceUnavailableReason.NETWORK),
    ],
)
def test_transport_failure_is_unavailable(
    error_type: type[httpx.TransportError], expected_reason: ExternalSourceUnavailableReason
) -> None:
    def fail(request: httpx.Request) -> httpx.Response:
        raise error_type("OFF unavailable", request=request)

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(fail))
    )

    result = source.lookup(
        NormalizedIdentifier(value="4006381333931", scheme=IdentifierScheme.EAN_13)
    )

    assert result == ExternalPackageUnavailable(
        identifier="4006381333931",
        reason=expected_reason,
    )


@pytest.mark.parametrize(
    "raw_response",
    [
        b"not-json",
        b'{"status":"success"}',
        b'{"status":"success","product":{"code":"0000000000000"}}',
        b'{"status":"failure","product":{"code":"4006381333931"}}',
    ],
)
def test_invalid_success_response_is_unavailable(raw_response: bytes) -> None:
    client = httpx.Client(
        transport=httpx.MockTransport(lambda _request: httpx.Response(200, content=raw_response))
    )
    source = OpenFoodFactsPackageSource(client)

    result = source.lookup(
        NormalizedIdentifier(value="4006381333931", scheme=IdentifierScheme.EAN_13)
    )

    assert result == ExternalPackageUnavailable(
        identifier="4006381333931",
        reason=ExternalSourceUnavailableReason.INVALID_RESPONSE,
    )


def test_found_result_is_cached_for_at_most_24_hours() -> None:
    raw_response = (FIXTURES / "complete.json").read_bytes()
    request_count = 0
    clock = MutableClock()

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(200, content=raw_response)

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(respond)),
        utc_now=clock.utc_now,
        monotonic=clock.monotonic,
    )
    identifier = NormalizedIdentifier(
        value="4006381333931", scheme=IdentifierScheme.EAN_13
    )

    first = source.lookup(identifier)
    clock.advance(86_399)
    cached = source.lookup(identifier)
    clock.advance(1)
    refreshed = source.lookup(identifier)

    assert request_count == 2
    assert cached == first
    assert isinstance(first, ExternalPackageFound)
    assert isinstance(refreshed, ExternalPackageFound)
    assert refreshed.record.retrieved_at > first.record.retrieved_at


def test_not_found_result_is_cached_for_at_most_15_minutes() -> None:
    request_count = 0
    clock = MutableClock()

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(404, json={"result": {"id": "product_not_found"}})

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(respond)),
        utc_now=clock.utc_now,
        monotonic=clock.monotonic,
    )
    identifier = NormalizedIdentifier(
        value="4006381333931", scheme=IdentifierScheme.EAN_13
    )

    first = source.lookup(identifier)
    clock.advance(899)
    cached = source.lookup(identifier)
    clock.advance(1)
    refreshed = source.lookup(identifier)

    assert request_count == 2
    assert cached == first
    assert isinstance(first, ExternalPackageNotFound)
    assert isinstance(refreshed, ExternalPackageNotFound)
    assert refreshed.retrieved_at > first.retrieved_at


def test_unavailable_result_is_never_cached() -> None:
    request_count = 0

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(503)

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(respond))
    )
    identifier = NormalizedIdentifier(
        value="4006381333931", scheme=IdentifierScheme.EAN_13
    )

    source.lookup(identifier)
    source.lookup(identifier)

    assert request_count == 2


def test_cache_evicts_the_least_recently_used_entry_at_capacity() -> None:
    requested_identifiers: list[str] = []

    def respond(request: httpx.Request) -> httpx.Response:
        identifier = request.url.path.split("/")[-1].removesuffix(".json")
        requested_identifiers.append(identifier)
        return httpx.Response(
            200,
            json={"status": "success", "product": {"code": identifier}},
        )

    source = OpenFoodFactsPackageSource(
        httpx.Client(transport=httpx.MockTransport(respond)),
        max_cache_entries=2,
    )
    identifiers = [
        NormalizedIdentifier(value=value, scheme=IdentifierScheme.EAN_13)
        for value in ("4006381333931", "8850000000003", "9550000000005")
    ]

    source.lookup(identifiers[0])
    source.lookup(identifiers[1])
    source.lookup(identifiers[0])
    source.lookup(identifiers[2])
    source.lookup(identifiers[1])

    assert requested_identifiers == [
        "4006381333931",
        "8850000000003",
        "9550000000005",
        "8850000000003",
    ]
