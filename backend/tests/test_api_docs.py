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


def test_experimental_product_lookup_is_typed_in_openapi(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    specification = response.json()

    operation = specification["paths"]["/api/experimental/products/{barcode}"]["get"]
    assert operation["operationId"] == "getExperimentalProduct"
    assert operation.get("deprecated") is True
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
        }
    ]
    assert set(operation["responses"]) == {"200", "404", "422", "429", "500", "503"}
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProductLookupResponse"
    }
    for status in ("404", "422", "429", "500", "503"):
        assert operation["responses"][status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ProductLookupErrorResponse"
        }

    schemas = specification["components"]["schemas"]
    assert schemas["ProductLookupErrorCode"]["enum"] == [
        "invalid_barcode",
        "product_not_found",
        "dataset_unavailable",
        "rate_limit_exceeded",
        "internal_error",
        "unsupported_language",
    ]
    source_record = schemas["ProductLookupDataResponse"]["properties"]["source_record"]
    assert source_record["type"] == "object"


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
                    "Only 'kh' is supported; 'km' returns unsupported_language. "
                    "Omit to skip generation. External source language tags remain unchanged."
                ),
                "title": "Language",
            },
            "description": (
                "Optional target language for product translation. "
                "Only 'kh' is supported; 'km' returns unsupported_language. "
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


def test_product_lookup_errors_keep_security_headers(client: TestClient) -> None:
    response = client.get("/api/v1/products/invalid")
    assert response.status_code == 422
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Cache-Control"] == "no-store"
