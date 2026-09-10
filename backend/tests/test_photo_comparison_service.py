from __future__ import annotations

import io
import json
from decimal import Decimal

import httpx2 as httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from lifegoods.photo_comparison.app import create_photo_comparison_app
from lifegoods.photo_comparison.comparison import compare
from lifegoods.photo_comparison.contracts import (
    ComparisonRequest,
    ComparisonState,
    ExtractionOutcome,
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
    configuration_version = "photo-extraction-v1"

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
    assert too_many.status_code == 422
    assert too_many.json()["error"]["code"] == "request_invalid"
    assert unsupported.status_code == 415
    assert unsupported.json()["error"]["code"] == "unsupported_image_format"


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

