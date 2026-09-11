from __future__ import annotations

import io
import json
from decimal import Decimal

import fakeredis
import httpx2 as httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from lifegoods.core.settings import Settings
from lifegoods.main import create_app
from lifegoods.photo_comparison.app import create_photo_comparison_app
from lifegoods.photo_comparison.comparison import compare
from lifegoods.photo_comparison.contracts import (
    ComparisonRequest,
    ComparisonState,
    ExtractionOutcome,
    ImageEvidence,
    PreparationState,
)
from lifegoods.photo_comparison.examples import (
    _field,
    multiple_columns_extraction,
    normal_pair,
    seed_extraction,
)
from lifegoods.photo_comparison.gemini import (
    GeminiPhotoExtractionAdapter,
    PhotoProviderOutputInvalid,
    PhotoProviderRequest,
    PhotoProviderUnavailable,
)
from lifegoods.photo_comparison.images import MAX_UPLOAD_BYTES, ImageValidationError, prepare_image
from lifegoods.photo_comparison.normalization import build_extraction
from lifegoods.photo_comparison.rate_limit import RedisPhotoComparisonRateLimiter
from lifegoods.photo_comparison.service import ProviderCapacity, RedisProviderCapacity


def _png_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (40, 30), (220, 180, 90)).save(output, format="PNG")
    return output.getvalue()


def _provider_payload(
    request: PhotoProviderRequest, *, unknown_reference: bool = False
) -> dict[str, object]:
    image_id = "not-an-image" if unknown_reference else request.images[0].evidence.image_id
    pointer = {"image_id": image_id, "region": {"x": 0, "y": 0, "width": 1, "height": 1}}
    return {
        "identity": None,
        "package_quantity": {
            "field_id": "package-weight",
            "label": "Net weight",
            "value_text": "60 g",
            "unit_text": "g",
            "language": "en",
            "state": "readable",
            "qualifier": "exact",
            "alternatives": [],
            "evidence": [pointer],
        },
        "nutrition_columns": [
            {
                "column_id": "per-pack",
                "label": "Per package",
                "basis": "per_package",
                "preparation_state": "unknown",
                "serving_quantity_state": "not_visible",
                "basis_evidence": [pointer],
                "preparation_evidence": [],
                "fields": [
                    {
                        "field_id": "sodium-field",
                        "nutrient": "sodium",
                        "label": "Sodium",
                        "value_text": "1,380 mg",
                        "unit_text": "mg",
                        "original_script": "សូដ្យូម 1,380 mg",
                        "language": "km",
                        "state": "readable",
                        "qualifier": "exact",
                        "row_kind": "amount",
                        "alternatives": [],
                        "evidence": [pointer],
                    }
                ],
            }
        ],
        "outcome": "partial",
        "retake_reasons": ["Preparation state is not visible."],
    }


class FakeProvider:
    provider_name = "fake-provider"
    model = "gemini-3.8-flash"
    configuration_version = "photo-extraction-v3"

    def __init__(
        self, *, unknown_reference: bool = False, failure: Exception | None = None
    ) -> None:
        self.unknown_reference = unknown_reference
        self.failure = failure

    def extract(self, request: PhotoProviderRequest) -> dict[str, object]:
        if self.failure:
            raise self.failure
        return _provider_payload(request, unknown_reference=self.unknown_reference)


def test_photo_normalization_corrects_orientation_and_strips_metadata() -> None:
    prepared = prepare_image(_png_bytes(), declared_content_type="image/png")
    assert prepared.mime_type == "image/png"
    assert prepared.evidence.width == 40
    assert prepared.evidence.height == 30
    with Image.open(io.BytesIO(prepared.content)) as image:
        assert image.getexif() == {}


def test_photo_limits_reject_oversized_and_unsupported_content() -> None:
    with pytest.raises(ImageValidationError, match="10 MiB"):
        prepare_image(b"x" * (10 * 1024 * 1024 + 1))
    with pytest.raises(ImageValidationError, match="readable JPEG or PNG") as error:
        prepare_image(b"not an image", declared_content_type="image/heic")
    assert error.value.unsupported_format


def test_comparison_normalizes_mass_units_and_exposes_derivation() -> None:
    response = compare(normal_pair())
    row = response.rows[0]
    assert row.state is ComparisonState.COMPARABLE
    assert row.normalized_left is not None
    assert row.normalized_right is not None
    assert row.derived_difference is not None
    assert row.normalized_right.value == Decimal("2.3")
    assert row.derived_difference.value == Decimal("0.007692307692307692307692308")
    assert row.assumptions == [
        "Assumes each reported per-package value covers the stated net weight."
    ]


def test_comparison_keeps_zero_distinct_from_missing() -> None:
    zero_request = ComparisonRequest(
        left=seed_extraction("zero-left", "zero-left", "0", "mg", "0", weight_g="60"),
        right=seed_extraction("zero-right", "zero-right", "0", "mg", "0", weight_g="60"),
    )
    zero_row = compare(zero_request).rows[0]
    assert zero_row.state is ComparisonState.COMPARABLE
    assert zero_row.derived_difference is not None
    assert zero_row.derived_difference.value == Decimal("0")

    missing_request = ComparisonRequest(
        left=seed_extraction("missing-left", "missing-left", "trace", "mg", None, weight_g="60"),
        right=seed_extraction("missing-right", "missing-right", "0", "mg", "0", weight_g="60"),
    )
    missing_row = compare(missing_request).rows[0]
    assert missing_row.state is ComparisonState.NOT_COMPARABLE
    assert missing_row.derived_difference is None


def test_comparison_does_not_match_unestablished_nutrients_by_field_id() -> None:
    request = normal_pair()
    for extraction in (request.left, request.right):
        field = extraction.nutrition_columns[0].fields[0]
        field.nutrient = "unestablished-label"
        field.label = "Mystery row"

    rows = compare(request).rows
    assert len(rows) == 2
    assert all(row.state is ComparisonState.NOT_COMPARABLE for row in rows)
    assert all(row.left is None or row.right is None for row in rows)


def test_unknown_preparation_is_conditional_without_difference() -> None:
    request = normal_pair()
    request.left.nutrition_columns[0].preparation_state = PreparationState.UNKNOWN
    request.left.nutrition_columns[0].preparation_evidence = []
    row = compare(request).rows[0]
    assert row.state is ComparisonState.CONDITIONAL
    assert row.normalized_left is not None
    assert row.derived_difference is None
    assert "conditional" in (row.reason or "")


def test_multiple_column_comparison_requires_and_accepts_selection() -> None:
    right = normal_pair().right
    with pytest.raises(ValidationError, match="left_column_id"):
        ComparisonRequest(left=multiple_columns_extraction(), right=right)
    request = ComparisonRequest(
        left=multiple_columns_extraction(),
        right=right,
        left_column_id="pack",
    )
    assert request.left_column_id == "pack"


def test_gemini_photo_adapter_sends_all_images_and_exact_model() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "nutrition_columns": [],
                                            "outcome": "retake_required",
                                            "retake_reasons": ["Unreadable"],
                                        }
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )

    prepared = prepare_image(_png_bytes(), declared_content_type="image/png")
    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = GeminiPhotoExtractionAdapter(
        "secret-key",
        http_client=client,
        base_url="https://example.test/v1beta",
    )
    response = adapter.extract(PhotoProviderRequest(images=[prepared]))
    assert response["outcome"] == "retake_required"
    sent = json.loads(captured[0].content)
    assert "/models/gemini-3.8-flash:generateContent" in str(captured[0].url)
    assert sent["generationConfig"]["responseMimeType"] == "application/json"
    assert sent["generationConfig"]["maxOutputTokens"] == 16384
    assert sent["generationConfig"]["thinkingConfig"] == {"thinkingLevel": "low"}
    assert sent["contents"][0]["parts"][1]["inlineData"]["mimeType"] == "image/png"
    assert "web lookup" in sent["systemInstruction"]["parts"][0]["text"]


def test_gemini_photo_adapter_rejects_truncation_with_specific_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"candidates": [{"finishReason": "MAX_TOKENS"}]})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        adapter = GeminiPhotoExtractionAdapter("test-key", http_client=client)
        with pytest.raises(PhotoProviderOutputInvalid, match="output limit"):
            adapter.extract(PhotoProviderRequest(images=[prepare_image(_png_bytes())]))


def test_compact_extraction_generates_ids_and_accepts_missing_serving_quantity() -> None:
    image = prepare_image(_png_bytes())
    payload = _provider_payload(PhotoProviderRequest(images=[image]))
    # Exercise the JSON boundary without relying on provider-generated application IDs.
    compact = json.loads(json.dumps(payload))
    compact.pop("outcome")
    compact["package_quantity"] = None
    compact["identity"] = {"brand": {
        "value_text": "MAMA", "language": "en", "state": "readable",
        "evidence": [{"image_id": image.evidence.image_id}],
    }}
    column = compact["nutrition_columns"][0]
    column.pop("column_id")
    column.pop("serving_quantity_state")
    column["serving_quantity"] = None
    column["fields"][0].pop("field_id")
    result = build_extraction(
        compact, product_id="left", images=[image.evidence], provider="google",
        model="gemini-3.8-flash",
    )
    assert result.outcome is ExtractionOutcome.PARTIAL
    assert result.package_quantity is None
    assert result.identity is not None and result.identity.brand is not None
    assert result.identity.brand.original_script == "MAMA"
    assert result.identity.brand.label == "Brand"
    assert result.nutrition_columns[0].serving_quantity_state.value == "not_visible"
    assert result.nutrition_columns[0].column_id
    field = result.nutrition_columns[0].fields[0]
    assert field.field_id
    assert field.normalized_value == Decimal("1380")
    assert field.evidence[0].image_id == image.evidence.image_id


def test_http_extraction_validates_provider_references_and_failures() -> None:
    valid_app = create_photo_comparison_app(provider=FakeProvider())
    with TestClient(valid_app) as client:
        response = client.post(
            "/api/experimental/photo-comparison/extractions",
            data={"product_id": "left"},
            files=[("photos", ("panel.png", _png_bytes(), "image/png"))],
        )
    assert response.status_code == 200
    body = response.json()
    assert body["outcome"] == ExtractionOutcome.PARTIAL.value
    assert body["images"][0]["image_id"]
    assert body["nutrition_columns"][0]["fields"][0]["original_script"].startswith("សូដ្យូម")
    assert body["nutrition_columns"][0]["fields"][0]["normalized_value"] == "1380"
    assert response.headers["cache-control"] == "no-store"

    invalid_app = create_photo_comparison_app(provider=FakeProvider(unknown_reference=True))
    with TestClient(invalid_app) as client:
        response = client.post(
            "/api/experimental/photo-comparison/extractions",
            data={"product_id": "left"},
            files=[("photos", ("panel.png", _png_bytes(), "image/png"))],
        )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "provider_output_invalid"

    failed_app = create_photo_comparison_app(
        provider=FakeProvider(failure=PhotoProviderUnavailable("Provider down"))
    )
    with TestClient(failed_app) as client:
        response = client.post(
            "/api/experimental/photo-comparison/extractions",
            data={"product_id": "left"},
            files=[("photos", ("panel.png", _png_bytes(), "image/png"))],
        )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "provider_unavailable"


class AllowAllPhotoRateLimiter:
    def try_acquire(self, key: str) -> tuple[bool, int]:
        del key
        return True, 0


def test_normal_app_serves_stable_photo_routes_with_injected_provider() -> None:
    app = create_app(
        settings=Settings(_env_file=None, gemini_api_key=None),  # pyright: ignore[reportCallIssue]
        photo_provider=FakeProvider(),
        photo_rate_limiter=AllowAllPhotoRateLimiter(),
        photo_capacity=ProviderCapacity(),
    )
    with TestClient(app) as client:
        left = client.post(
            "/api/v1/photo-comparison/extractions",
            data={"product_id": "left"},
            files=[("photos", ("left.png", _png_bytes(), "image/png"))],
        )
        right = client.post(
            "/api/v1/photo-comparison/extractions",
            data={"product_id": "right"},
            files=[("photos", ("right.png", _png_bytes(), "image/png"))],
        )
        comparison = client.post(
            "/api/v1/photo-comparison/comparisons",
            json={"left": left.json(), "right": right.json()},
        )
        invalid_comparison = client.post(
            "/api/v1/photo-comparison/comparisons",
            json={"left": {"product_id": "left"}, "right": right.json()},
        )

    assert left.status_code == 200
    assert right.status_code == 200
    assert comparison.status_code == 200
    assert comparison.json()["left_product_id"] == "left"
    assert comparison.json()["right_product_id"] == "right"
    assert invalid_comparison.status_code == 422
    assert invalid_comparison.json()["error"]["code"] == "request_invalid"


def test_normal_app_returns_actionable_error_when_photo_provider_is_unconfigured() -> None:
    app = create_app(
        settings=Settings(_env_file=None, gemini_api_key=None),  # pyright: ignore[reportCallIssue]
        photo_rate_limiter=AllowAllPhotoRateLimiter(),
        photo_capacity=ProviderCapacity(),
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/photo-comparison/extractions",
            data={"product_id": "left"},
            files=[("photos", ("left.png", _png_bytes(), "image/png"))],
        )

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "provider_unavailable",
            "message": "Photo extraction is unavailable because Gemini credentials are missing.",
        }
    }


def test_normal_app_sanitizes_malformed_multipart_errors() -> None:
    app = create_app(
        settings=Settings(_env_file=None, gemini_api_key=None),  # pyright: ignore[reportCallIssue]
        photo_rate_limiter=AllowAllPhotoRateLimiter(),
        photo_capacity=ProviderCapacity(),
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/photo-comparison/extractions",
            content=b"not multipart",
            headers={"content-type": "multipart/form-data; boundary=missing"},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_invalid"


def test_photo_rate_limit_is_shared_between_app_instances() -> None:
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    first = RedisPhotoComparisonRateLimiter(redis_client, requests_per_minute=1)
    second = RedisPhotoComparisonRateLimiter(redis_client, requests_per_minute=1)

    assert first.try_acquire("same-anonymous-client")[0]
    allowed, retry_after = second.try_acquire("same-anonymous-client")

    assert not allowed
    assert retry_after >= 1


def test_photo_provider_capacity_is_shared_between_app_instances() -> None:
    redis_client = fakeredis.FakeRedis(decode_responses=True)
    first = RedisProviderCapacity(redis_client)
    second = RedisProviderCapacity(redis_client)

    assert first.acquire()
    assert not second.acquire()
    first.release()
    assert second.acquire()
    second.release()


def test_http_extraction_rejects_count_and_unsupported_format() -> None:
    app = create_photo_comparison_app(provider=FakeProvider())
    files = [("photos", (f"{index}.png", _png_bytes(), "image/png")) for index in range(7)]
    with TestClient(app) as client:
        too_many = client.post(
            "/api/experimental/photo-comparison/extractions",
            data={"product_id": "left"},
            files=files,
        )
        unsupported = client.post(
            "/api/experimental/photo-comparison/extractions",
            data={"product_id": "left"},
            files=[("photos", ("panel.heic", b"not an image", "image/heic"))],
        )
        empty = client.post(
            "/api/experimental/photo-comparison/extractions",
            data={"product_id": "left"},
            files=[("photos", ("empty.png", b"", "image/png"))],
        )
    assert too_many.status_code == 422
    assert too_many.json()["error"]["code"] == "request_invalid"
    assert unsupported.status_code == 415
    assert unsupported.json()["error"]["code"] == "unsupported_image_format"
    assert empty.status_code == 422
    assert empty.json()["error"]["code"] == "request_invalid"


def test_standalone_app_serves_only_local_photo_routes_and_browser_page() -> None:
    app = create_photo_comparison_app(provider=FakeProvider())
    with TestClient(app) as client:
        page = client.get("/")
        scalar = client.get("/scalar")
        paths = sorted(client.get("/openapi.json").json()["paths"])

    assert page.status_code == 200
    assert "Read two labels side by side." in page.text
    assert scalar.status_code == 200
    assert paths == [
        "/api/experimental/photo-comparison/comparisons",
        "/api/experimental/photo-comparison/extractions",
    ]


def test_http_comparison_accepts_partial_extractions_and_rechecks_columns() -> None:
    app = create_photo_comparison_app(provider=FakeProvider())
    with TestClient(app) as client:
        left_response = client.post(
            "/api/experimental/photo-comparison/extractions",
            data={"product_id": "left"},
            files=[("photos", ("left.png", _png_bytes(), "image/png"))],
        )
        right_response = client.post(
            "/api/experimental/photo-comparison/extractions",
            data={"product_id": "right"},
            files=[("photos", ("right.png", _png_bytes(), "image/png"))],
        )
        compared = client.post(
            "/api/experimental/photo-comparison/comparisons",
            json={"left": left_response.json(), "right": right_response.json()},
        )
        invalid_selection = client.post(
            "/api/experimental/photo-comparison/comparisons",
            json={
                "left": multiple_columns_extraction().model_dump(mode="json"),
                "right": right_response.json(),
            },
        )
        oversized = client.post(
            "/api/experimental/photo-comparison/extractions",
            headers={"content-length": str(MAX_UPLOAD_BYTES + 1)},
            data={"product_id": "left"},
            files=[("photos", ("left.png", _png_bytes(), "image/png"))],
        )
    assert compared.status_code == 200
    assert compared.json()["rows"][0]["state"] == "conditional"
    assert compared.json()["rows"][0]["derived_difference"] is None
    assert invalid_selection.status_code == 422
    assert invalid_selection.json()["error"]["code"] == "request_invalid"
    assert oversized.status_code == 413
    assert oversized.json()["error"]["code"] == "size_limit_exceeded"


def test_package_quantity_normalization_handles_missing_label_and_merged_units() -> None:
    image = prepare_image(_png_bytes())
    # Test 1: missing label and merged unit in value_text ("60 g")
    raw = {
        "identity": None,
        "package_quantity": {
            "label": None,
            "value_text": "60 g",
            "unit_text": None,
            "language": "en",
            "state": "readable",
            "qualifier": "exact",
            "evidence": [],
        },
        "nutrition_columns": [
            {
                "column_id": "col1",
                "label": "Per pack",
                "basis": "per_package",
                "preparation_state": "unknown",
                "basis_evidence": [{"image_id": image.evidence.image_id}],
                "preparation_evidence": [],
                "fields": [
                    {
                        "field_id": "f1",
                        "nutrient": "sodium",
                        "label": "Sodium",
                        "value_text": "1380",
                        "unit_text": "mg",
                        "original_script": "Sodium 1380 mg",
                        "language": "en",
                        "state": "readable",
                        "qualifier": "exact",
                        "row_kind": "amount",
                        "evidence": [{"image_id": image.evidence.image_id}],
                    }
                ],
            }
        ],
        "outcome": "partial",
        "retake_reasons": [],
    }
    extraction = build_extraction(
        raw, product_id="left", images=[image.evidence], provider="google", model="gemini-3.8-flash"
    )
    assert extraction.package_quantity is not None
    assert extraction.package_quantity.label == "Net weight"
    assert extraction.package_quantity.value_text == "60"
    assert extraction.package_quantity.unit_text == "g"
    assert extraction.package_quantity.normalized_value == Decimal("60")
    assert extraction.package_quantity.evidence[0].image_id == image.evidence.image_id

    # Test 2: marked readable but value is null -> downgrades to not_visible instead of crashing
    raw["package_quantity"] = {
        "label": "Net weight",
        "value_text": None,
        "unit_text": None,
        "language": "en",
        "state": "readable",
        "qualifier": "exact",
        "evidence": [],
    }
    extraction_null = build_extraction(
        raw, product_id="left", images=[image.evidence], provider="google", model="gemini-3.8-flash"
    )
    assert extraction_null.package_quantity is not None
    assert extraction_null.package_quantity.state.value == "not_visible"


def test_percentage_rows_pair_across_products_and_retain_both_values() -> None:
    from lifegoods.photo_comparison.contracts import NutrientRowKind
    request = normal_pair()
    left_image_id = request.left.images[0].image_id
    right_image_id = request.right.images[0].image_id

    # Add percentage rows to both products for sodium
    request.left.nutrition_columns[0].fields.append(
        _field(
            "left-sodium-pct",
            left_image_id,
            "sodium",
            "60",
            "%",
            "60",
            row_kind=NutrientRowKind.PERCENTAGE,
        )
    )
    request.right.nutrition_columns[0].fields.append(
        _field(
            "right-sodium-pct",
            right_image_id,
            "sodium",
            "65",
            "%",
            "65",
            row_kind=NutrientRowKind.PERCENTAGE,
        )
    )

    response = compare(request)
    assert len(response.rows) == 2
    # First row: amount
    amount_row = response.rows[0]
    assert amount_row.nutrient == "sodium"
    assert amount_row.row_kind is NutrientRowKind.AMOUNT
    assert amount_row.state is ComparisonState.COMPARABLE

    # Second row: percentage
    pct_row = response.rows[1]
    assert pct_row.nutrient == "sodium"
    assert pct_row.row_kind is NutrientRowKind.PERCENTAGE
    assert pct_row.left is not None
    assert pct_row.right is not None
    assert pct_row.left.observation.value_text == "60"
    assert pct_row.right.observation.value_text == "65"
    assert pct_row.state is ComparisonState.NOT_COMPARABLE
    assert "Percentage rows are retained" in (pct_row.reason or "")


def test_unmatched_rows_display_clean_nutrient_names() -> None:
    from lifegoods.photo_comparison.contracts import NutrientRowKind
    request = normal_pair()
    right_image_id = request.right.images[0].image_id

    # Add Vitamin B5 to right product only
    request.right.nutrition_columns[0].fields.append(
        _field(
            "b5-field-123",
            right_image_id,
            "vitamin_b5",
            "1.5",
            "mg",
            "1.5",
            row_kind=NutrientRowKind.AMOUNT,
        )
    )

    response = compare(request)
    assert len(response.rows) == 2
    b5_row = response.rows[1]
    assert b5_row.nutrient == "vitamin_b5"
    assert b5_row.left is None
    assert b5_row.right is not None
    assert "not found in photos" in (b5_row.reason or "").lower()


def test_unitless_calories_normalized_and_comparable() -> None:
    from lifegoods.photo_comparison.contracts import MeasurementUnit
    raw_response = {
        "nutrition_columns": [
            {
                "label": "Nutrition Facts",
                "basis": "per_package",
                "preparation_state": "as_sold",
                "basis_evidence": [{"image_id": "img-1"}],
                "preparation_evidence": [{"image_id": "img-1"}],
                "fields": [
                    {
                        "label": "Calories",
                        "value_text": "280",
                        "unit_text": None,
                        "original_script": "Calories 280",
                        "language": "en",
                        "state": "readable",
                        "qualifier": "exact",
                        "row_kind": "amount",
                        "evidence": [{"image_id": "img-1"}],
                    }
                ],
            }
        ],
        "package_quantity": {
            "value_text": "60",
            "unit_text": "g",
            "language": "en",
            "state": "readable",
            "evidence": [{"image_id": "img-1"}],
        },
        "retake_reasons": [],
    }
    img_a = ImageEvidence(
        image_id="img-1", original_image_id="img-1", role="label", width=800, height=600
    )
    extraction_a = build_extraction(
        raw_response,
        product_id="left",
        images=[img_a],
        provider="google",
        model="gemini-3.8-flash",
    )
    field_a = extraction_a.nutrition_columns[0].fields[0]
    assert field_a.nutrient == "energy"
    assert field_a.normalized_value == Decimal("280")
    assert field_a.normalized_unit is MeasurementUnit.KCAL

    # Second product with Calories 320
    raw_b = dict(raw_response)
    raw_b["package_quantity"] = {
        "value_text": "60",
        "unit_text": "g",
        "language": "en",
        "state": "readable",
        "evidence": [{"image_id": "img-2"}],
    }
    raw_b["nutrition_columns"] = [
        {
            "label": "Nutrition Facts",
            "basis": "per_package",
            "preparation_state": "as_sold",
            "basis_evidence": [{"image_id": "img-2"}],
            "preparation_evidence": [{"image_id": "img-2"}],
            "fields": [
                {
                    "label": "Calories",
                    "value_text": "320",
                    "unit_text": None,
                    "original_script": "Calories 320",
                    "language": "en",
                    "state": "readable",
                    "qualifier": "exact",
                    "row_kind": "amount",
                    "evidence": [{"image_id": "img-2"}],
                }
            ],
        }
    ]
    img_b = ImageEvidence(
        image_id="img-2", original_image_id="img-2", role="label", width=800, height=600
    )
    extraction_b = build_extraction(
        raw_b,
        product_id="right",
        images=[img_b],
        provider="google",
        model="gemini-3.8-flash",
    )

    req = ComparisonRequest(left=extraction_a, right=extraction_b)
    resp = compare(req)
    assert len(resp.rows) == 1
    cal_row = resp.rows[0]
    assert cal_row.nutrient == "energy"
    assert cal_row.state is ComparisonState.COMPARABLE
    assert cal_row.derived_difference is not None
    assert cal_row.derived_difference.value == Decimal("-40")
    assert cal_row.derived_difference.unit is MeasurementUnit.KCAL


def test_khmer_nutrient_aliases_canonicalized() -> None:
    from lifegoods.photo_comparison.normalization import canonical_nutrient
    assert canonical_nutrient("ថាមពល") == "energy"
    assert canonical_nutrient("កាឡូរី") == "energy"
    assert canonical_nutrient("ជាតិខ្លាញ់") == "fat"
    assert canonical_nutrient("ខ្លាញ់ឆ្អែត") == "saturated_fat"
    assert canonical_nutrient("កាបូអ៊ីដ្រាត") == "carbohydrate"
    assert canonical_nutrient("ជាតិស្ករ") == "sugars"
    assert canonical_nutrient("ជាតិសរសៃ") == "fiber"
    assert canonical_nutrient("ប្រូតេអ៊ីន") == "protein"
    assert canonical_nutrient("សូដ្យូម") == "sodium"
    assert canonical_nutrient("អំបិល") == "salt"
    assert canonical_nutrient("កូឡេស្តេរ៉ុល") == "cholesterol"
    assert canonical_nutrient("កាល់ស្យូម") == "calcium"
    assert canonical_nutrient("ជាតិដែក") == "iron"
    assert canonical_nutrient("ប៉ូតាស្យូម") == "potassium"


def test_special_unit_normalization_and_quantities() -> None:
    from lifegoods.photo_comparison.contracts import MeasurementUnit
    from lifegoods.photo_comparison.normalization import normalize_unit
    unit, factor = normalize_unit("oz")
    assert unit is MeasurementUnit.G
    assert factor == Decimal("28.3495")

    unit_floz, factor_floz = normalize_unit("fl oz")
    assert unit_floz is MeasurementUnit.ML
    assert factor_floz == Decimal("29.5735")

    unit_kj, factor_kj = normalize_unit("kJ")
    assert unit_kj is MeasurementUnit.KJ
    assert factor_kj == Decimal("1")
