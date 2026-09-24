from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from lifegoods.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_scalar_endpoint_renders_html(client: TestClient) -> None:
    response = client.get("/scalar")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "scalar" in response.text.lower()


def test_scalar_route_is_excluded_from_openapi(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    openapi_spec = response.json()
    assert "/scalar" not in openapi_spec.get("paths", {})


def test_photo_comparison_routes_are_registered_by_the_normal_contract(
    client: TestClient,
) -> None:
    paths = client.get("/openapi.json").json().get("paths", {})
    assert "/api/v1/photo-comparison/extractions" in paths
    assert "/api/v1/photo-comparison/comparisons" in paths
    assert "/api/experimental/photo-comparison/extractions" not in paths
    assert "/api/experimental/photo-comparison/comparisons" not in paths
    extraction_request_body = paths["/api/v1/photo-comparison/extractions"]["post"]["requestBody"]
    assert extraction_request_body["required"] is True
    extraction_schema_ref = extraction_request_body["content"]["multipart/form-data"]["schema"]
    assert extraction_schema_ref == {"$ref": "#/components/schemas/Body_extractPhotoComparison"}
    extraction_schema = client.get("/openapi.json").json()["components"]["schemas"][
        "Body_extractPhotoComparison"
    ]
    # install_photo_comparison_openapi patches these multipart bodies by name, so a new
    # multipart operation must be added there before it is listed here.
    schema_names = client.get("/openapi.json").json()["components"]["schemas"]
    assert sorted(name for name in schema_names if name.startswith("Body_")) == [
        "Body_createLabelReading",
        "Body_extractPhotoComparison",
    ]
    assert extraction_schema["required"] == ["product_id", "photos"]
    assert extraction_schema["properties"]["photos"]["minItems"] == 1
    assert extraction_schema["properties"]["photos"]["maxItems"] == 3
    assert extraction_schema["properties"]["photos"]["items"] == {
        "type": "string",
        "format": "binary",
    }
    assert paths["/api/v1/photo-comparison/extractions"]["post"]["operationId"] == (
        "extractPhotoComparison"
    )
    assert paths["/api/v1/photo-comparison/comparisons"]["post"]["operationId"] == (
        "comparePhotoComparison"
    )
    comparison_request_body = paths["/api/v1/photo-comparison/comparisons"]["post"][
        "requestBody"
    ]
    assert comparison_request_body["required"] is True
    comparison_schema = comparison_request_body["content"]["application/json"]["schema"]
    assert comparison_schema["title"] == "ComparisonRequest"
    assert comparison_schema["additionalProperties"] is False
    assert comparison_schema["required"] == ["left", "right"]
    assert comparison_schema["properties"]["left"] == {
        "$ref": "#/components/schemas/Extraction"
    }
    assert comparison_schema["properties"]["right"] == {
        "$ref": "#/components/schemas/Extraction"
    }


def test_obsolete_routes_and_schemas_are_absent_from_openapi(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    specification = response.json()
    paths = specification.get("paths", {})
    schemas = specification.get("components", {}).get("schemas", {})

    assert "/api/v1/package-matches" not in paths
    assert "/api/v1/packages/search" not in paths
    assert "AllergenAssessmentResponse" not in schemas
    assert "PackageMatchCandidateResponse" not in schemas


def test_experimental_product_lookup_is_absent_from_openapi(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    specification = response.json()

    paths = specification["paths"]
    schemas = specification["components"]["schemas"]
    assert "/api/experimental/products/{barcode}" not in paths
    assert "ProductLookupResponse" not in schemas
    assert "ProductLookupDataResponse" not in schemas


def test_stable_product_lookup_is_typed_in_openapi(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    specification = response.json()

    operation = specification["paths"]["/api/v1/products/{barcode}"]["get"]
    assert operation["operationId"] == "getProduct"
    assert operation.get("deprecated") is not True
    assert operation["tags"] == ["Products"]
    assert operation["parameters"] == [
        {
            "name": "barcode",
            "in": "path",
            "required": True,
            "schema": {
                "type": "string",
                "description": "GTIN-8, UPC-A, EAN-13, or GTIN-14 Product Barcode.",
                "title": "Barcode",
            },
            "description": "GTIN-8, UPC-A, EAN-13, or GTIN-14 Product Barcode.",
        },
        {
            "name": "language",
            "in": "query",
            "required": False,
            "schema": {
                "anyOf": [
                    {"type": "string"},
                    {"type": "null"},
                ],
                "description": (
                    "Optional target language for product translation. "
                        "Only 'km' is supported; other language values return "
                        "unsupported_language. "
                    "Omit to skip generation. External source language tags remain unchanged."
                ),
                "title": "Language",
            },
            "description": (
                "Optional target language for product translation. "
                    "Only 'km' is supported; other language values return "
                    "unsupported_language. "
                "Omit to skip generation. External source language tags remain unchanged."
            ),
        },
    ]
    assert set(operation["responses"]) == {"200", "404", "422", "429", "500", "503"}
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProductProjectionResponse"
    }
    for status in ("404", "422", "429", "500", "503"):
        assert operation["responses"][status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ProductLookupErrorResponse"
        }

    schemas = specification["components"]["schemas"]
    assert "ProductProjectionResponse" in schemas
    assert "ProductProjection" in schemas
    assert "ProductIdentityProjection" in schemas
    assert "TranslatableField" in schemas
    assert "StorageInstructionItem" in schemas
    assert "TranslationMetaResponse" in schemas
    data_schema = schemas["ProductProjectionData"]
    assert data_schema["properties"]["allergen_analysis"] == {
        "$ref": "#/components/schemas/AllergenAnalysisResponse"
    }
    assert "allergen_analysis" in data_schema["required"]
    assert "qualifications" in schemas["IngredientMatchingAllergenResponse"][
        "required"
    ]
    assert "unmatched_spans" in schemas["IngredientMatchingAllergenResponse"][
        "required"
    ]
    assert schemas["AllergenEvidenceResponse"]["properties"]["qualification"][
        "enum"
    ] == [
        "positive_mention",
        "precautionary_statement",
        "negated_mention",
        "unresolved_context",
    ]
    ingredient_operation = specification["paths"][
        "/api/experimental/ingredient-matches"
    ]["post"]
    assert ingredient_operation["responses"]["422"]["content"]["application/json"][
        "schema"
    ] == {"$ref": "#/components/schemas/IngredientMatchErrorResponse"}


def test_product_search_is_typed_in_openapi(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    specification = response.json()

    operation = specification["paths"]["/api/v1/products/search"]["get"]
    assert operation["operationId"] == "searchProducts"
    assert operation.get("deprecated") is not True
    assert operation["tags"] == ["Products"]

    param_names = {p["name"]: p for p in operation["parameters"]}
    assert "q" in param_names
    assert param_names["q"]["required"] is True
    assert param_names["q"]["in"] == "query"

    assert "cursor" in param_names
    assert param_names["cursor"]["required"] is False
    assert param_names["cursor"]["in"] == "query"

    assert "examples" in param_names["q"]
    assert "final_word_prefix" in param_names["q"]["examples"]
    assert param_names["q"]["examples"]["final_word_prefix"]["value"] == "coca col"

    assert set(operation["responses"]) == {"200", "422", "429", "500", "503"}
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProductSearchResponse"
    }
    for status in ("422", "429", "500", "503"):
        assert operation["responses"][status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ProductSearchErrorResponse"
        }

    schemas = specification["components"]["schemas"]
    assert "ProductSearchResponse" in schemas
    assert "ProductSearchDataResponse" in schemas
    assert "ProductSummary" in schemas
    assert "ProductSearchMetaResponse" in schemas
    assert "SearchPaginationMetaResponse" in schemas
    assert "ProductSearchErrorResponse" in schemas
    assert schemas["ProductSearchErrorCode"]["enum"] == [
        "invalid_query",
        "invalid_barcode",
        "invalid_cursor",
        "search_unavailable",
        "search_timeout",
        "dataset_unavailable",
        "rate_limit_exceeded",
        "internal_error",
    ]


def test_product_lookup_errors_keep_security_headers(client: TestClient) -> None:
    response = client.get("/api/v1/products/invalid")
    assert response.status_code == 422
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Cache-Control"] == "no-store"


def test_product_search_response_examples_validate(client: TestClient) -> None:
    from lifegoods.product_search.contracts import ProductSearchErrorResponse, ProductSearchResponse
    from lifegoods.product_search.query import decode_and_validate_cursor

    operation = client.get("/openapi.json").json()["paths"]["/api/v1/products/search"]["get"]
    required = {
        "200": {"barcode", "text", "continuation", "no_results"},
        "422": {"invalid_query", "invalid_barcode", "invalid_cursor"},
        "429": {"rate_limit_exceeded"},
        "500": {"internal_error"},
        "503": {"search_unavailable", "search_timeout", "dataset_unavailable"},
    }
    for status, names in required.items():
        examples = operation["responses"][status]["content"]["application/json"]["examples"]
        assert set(examples) == names
        model = ProductSearchResponse if status == "200" else ProductSearchErrorResponse
        for example in examples.values():
            model.model_validate(example["value"])
    example = operation["responses"]["200"]["content"]["application/json"]["examples"][
        "continuation"
    ]
    decode_and_validate_cursor(
        example["value"]["meta"]["pagination"]["next_cursor"], expected_terms=("chocolate",)
    )
