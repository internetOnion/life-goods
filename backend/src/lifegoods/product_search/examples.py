"""Curated OpenAPI examples for the Product Search HTTP contract."""

from typing import Any

from lifegoods.product_search.contracts import ProductSearchErrorResponse
from lifegoods.product_search.query import encode_cursor

_PRODUCT = {
    "barcode": "4006381333931",
    "name": {"value": "Dark Chocolate", "language": "en", "source_field": "product_name"},
    "brands": ["Example Foods"],
    "quantity": "100 g",
    "thumbnail": None,
    "source": {
        "name": "Open Food Facts",
        "product_url": "https://world.openfoodfacts.org/product/4006381333931",
    },
}


def _success(*, empty: bool = False, continuation: bool = False) -> dict[str, Any]:
    return {
        "data": {"products": [] if empty else [_PRODUCT]},
        "meta": {
            "source": {"name": "Open Food Facts", "product_url": "https://world.openfoodfacts.org"},
            "dataset": {"version": "example-snapshot", "retrieved_at": "2026-08-27T08:00:00Z"},
            "pagination": {
                "next_cursor": encode_cursor(
                    terms=("chocolate",), rank=2, information_score=2,
                    name_sort="dark chocolate", code="4006381333931"
                )
                if continuation
                else None
            },
        },
    }


SEARCH_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {
        "content": {
            "application/json": {
                "examples": {
                    "barcode": {"summary": "A Barcode match", "value": _success()},
                    "text": {"summary": "Text results for chocolate", "value": _success()},
                    "continuation": {
                        "summary": "More results for chocolate (abbreviated page)",
                        "description": (
                            "Pass next_cursor with the same query to retrieve the next page."
                        ),
                        "value": _success(continuation=True),
                    },
                    "no_results": {
                        "summary": "No matching Products",
                        "value": _success(empty=True),
                    },
                }
            }
        }
    },
}

for _status, _errors in {
    422: {
        "invalid_query": "Query must be between 2 and 200 characters",
        "invalid_barcode": "Barcode is invalid",
        "invalid_cursor": "Pagination cursor is invalid",
    },
    429: {"rate_limit_exceeded": "Too many requests. Please try again later."},
    500: {"internal_error": "Product Search failed unexpectedly"},
    503: {
        "search_unavailable": "Text search is temporarily unavailable",
        "search_timeout": "Search request timed out. Please try again.",
        "dataset_unavailable": "Dataset Snapshot is temporarily unavailable",
    },
}.items():
    SEARCH_RESPONSES[_status] = {
        "model": ProductSearchErrorResponse,
        "content": {
            "application/json": {
                "examples": {
                    code: {
                        "summary": code.replace("_", " "),
                        "value": {
                            "error": {
                                "code": code,
                                "message": message,
                            }
                        },
                    }
                    for code, message in _errors.items()
                }
            }
        },
    }
SEARCH_RESPONSES[429]["headers"] = {
    "Retry-After": {
        "description": "Seconds until another request can be made",
        "schema": {"type": "integer"},
        "example": 60,
    }
}
