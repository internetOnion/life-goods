"""Issue #107: frozen source corpus and real HTTP acceptance measurements.

Run with --help. Never accepts Shopper input; artifacts contain curated source data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import random
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx2 as httpx
from pymongo import MongoClient, monitoring

from lifegoods.core.settings import DEFAULT_OFF_MONGODB_URI
from lifegoods.identifiers import InvalidIdentifierError, normalize_identifier
from lifegoods.open_food_facts import OpenFoodFactsDatasetSource
from lifegoods.product_search import parse_and_validate_query
from lifegoods.product_search.contracts import ProductSearchResponse

BENCHMARK_RATE_LIMIT = 100_000
BENCHMARK_REDIS_DATABASE = 14
NORMAL_REDIS_DATABASE = 15

ARTIFACTS = Path("docs/research/search-validation/issue-107")


def write(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, default=str) + "\n", encoding="utf-8"
    )


def freeze(output: Path) -> None:
    if output.exists():
        raise ValueError("Refusing to overwrite a frozen corpus")
    baseline_path = Path("docs/research/search-validation/queries.json")
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    client: MongoClient[dict[str, Any]] = MongoClient(DEFAULT_OFF_MONGODB_URI)
    database = client.lifegoods_off
    pointer = database.off_dataset_control.find_one({"_id": "active"})
    assert pointer is not None
    manifest = database.off_dataset_versions.find_one({"_id": pointer["active_version_id"]})
    assert manifest is not None
    source = database[manifest["collection_name"]]
    cases: list[dict[str, Any]] = []
    exclusions: list[dict[str, Any]] = []
    for old in baseline["cases"]:
        code = next(iter(old.get("expected_codes", [])), None)
        record = source.find_one({"code": code}) if code else None
        if code:
            try:
                assert normalize_identifier(code).value == code
            except (InvalidIdentifierError, AssertionError):
                exclusions.append({"baseline_id": old["id"], "reason": "unusable stored Barcode"})
                continue
            if record is None:
                exclusions.append({"baseline_id": old["id"], "reason": "Source Record absent"})
                continue
        item = dict(old)
        item["baseline_id"] = old["id"]
        item["intent"] = (
            "negative"
            if old["kind"] == "negative"
            else "brand"
            if old["kind"] == "brand"
            else "specific"
            if old["kind"] == "combined"
            else "discovery"
        )
        item["source_verified"] = record is not None
        if record:
            item["verified_source_text"] = record.get(old["source_field"])
            item["verified_source_brands"] = record.get("brands")
        cases.append(item)
    # Barcodes and explicit brand+name requests carry specific-Product intent.
    for original in list(cases):
        if original["kind"] != "exact":
            continue
        code = original["expected_codes"][0]
        cases.append(
            {
                **original,
                "id": f"barcode-{original['id']}",
                "kind": "barcode",
                "intent": "barcode",
                "query": code,
            }
        )
        if original.get("source_brand"):
            query = f"{original['source_brand']} {original['query']}"
            try:
                parse_and_validate_query(query)
            except ValueError:
                continue
            cases.append(
                {
                    **original,
                    "id": f"specific-{original['id']}",
                    "kind": "combined",
                    "intent": "specific",
                    "query": query,
                }
            )
    for query in ["co", "ch", "ca", "coca col", "Danone", "Kroger", "Nestlé", "1664"]:
        cases.append(
            {
                "id": f"extra-{len(cases)}",
                "query": query,
                "kind": "prefix",
                "intent": "discovery",
                "expected_codes": [],
            }
        )
    # Actual Khmer source text from baseline, combined with its source brand is mixed script.
    for item in cases:
        item["actual_khmer_script"] = bool(re.search("[\u1780-\u17ff]", item["query"]))
    write(
        output,
        {
            "corpus_version": "issue-107-v1",
            "frozen_at": datetime.now(UTC),
            "dataset_version": manifest["_id"],
            "baseline_sha256": hashlib.sha256(baseline_path.read_bytes()).hexdigest(),
            "targets": {
                "specific_hit5": 0.90,
                "brand_precision5": 0.80,
                "discovery_match5": 1.0,
                "barcode_hit1": 1.0,
                "negative_empty": 1.0,
                "concurrency5_p95_ms_below": 300,
                "errors": 0,
            },
            "exclusions": exclusions,
            "cases": cases,
        },
    )
    client.close()


def percentiles(rows: list[dict[str, Any]]) -> dict[str, Any]:
    values = sorted(row["http_ms"] for row in rows)
    return {
        "requests": len(rows),
        **{f"p{p}_ms": values[math.ceil(len(values) * p / 100) - 1] for p in (50, 95, 99)},
        "errors": sum(row["status"] != 200 for row in rows),
        "server_timeouts": sum(row.get("error") == "search_timeout" for row in rows),
        "client_timeouts": sum(row.get("client_timeout", False) for row in rows),
        "timeouts": sum(
            row.get("error") == "search_timeout" or row.get("client_timeout", False) for row in rows
        ),
    }


def request(
    client: httpx.Client, case: dict[str, Any], cursor: str | None = None, retain: bool = False
) -> dict[str, Any]:
    params = {"q": case["query"]}
    if cursor:
        params["cursor"] = cursor
    start = time.perf_counter()
    try:
        response = client.get("/api/v1/products/search", params=params)
        elapsed = (time.perf_counter() - start) * 1000
        body = response.json()
        result = {
            "id": case["id"],
            "status": response.status_code,
            "http_ms": elapsed,
            "error": body.get("error", {}).get("code"),
        }
        if response.status_code == 200:
            ProductSearchResponse.model_validate(body)
        if retain:
            result["body"] = body
        return result
    except Exception as error:
        return {
            "id": case["id"],
            "status": 0,
            "http_ms": (time.perf_counter() - start) * 1000,
            "error": type(error).__name__,
            "client_timeout": isinstance(error, httpx.TimeoutException),
        }


def tokens(value: str) -> list[str]:
    # Independent label normalization; retain all letters/marks using Unicode regex.
    import unicodedata

    import regex

    return regex.findall(
        r"[\p{L}\p{N}][\p{L}\p{N}\p{M}]*", unicodedata.normalize("NFKC", value).casefold()
    )


def score(case: dict[str, Any], row: dict[str, Any]) -> float:
    if row["status"] != 200:
        return 0.0
    products = row["body"]["data"]["products"][:5]
    intent = case["intent"]
    if intent == "negative":
        return float(not products)
    if intent == "barcode":
        return float(bool(products) and products[0]["barcode"] in case["expected_codes"])
    if intent == "specific":
        return float(any(p["barcode"] in case["expected_codes"] for p in products))
    if not products:
        return 0.0
    if intent == "brand":
        expected = tokens(case["expected_brand"])
        return sum(any(tokens(b) == expected for b in p["brands"]) for p in products) / len(
            products
        )
    terms = tokens(case["query"])

    def matches(product: dict[str, Any]) -> bool:
        name = product.get("name")
        text = (name["value"] if name else "") + " " + " ".join(product["brands"])
        available = tokens(text)
        return all(t in available for t in terms[:-1]) and any(
            t.startswith(terms[-1]) for t in available
        )

    return sum(matches(p) for p in products) / len(products)


def run(corpus_path: Path, output: Path, base_url: str, count: int) -> None:
    if output.exists():
        raise ValueError("Refusing to overwrite measurements")
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    cases = corpus["cases"]
    report: dict[str, Any] = {
        "started_at": datetime.now(UTC),
        "corpus_sha256": hashlib.sha256(corpus_path.read_bytes()).hexdigest(),
        "targets": corpus["targets"],
        "base_url": base_url,
        "runner": platform.uname()._asdict(),
        "configuration": {
            "search_requests_per_minute": BENCHMARK_RATE_LIMIT,
            "redis_database": BENCHMARK_REDIS_DATABASE,
            "provenance": "Required serve invocation; not remotely attested",
            "mongo_max_time_ms": 2000,
            "application_search_cache": False,
            "http_timeout_seconds": 15,
            "http_includes_queue_wait": False,
        },
    }
    with httpx.Client(base_url=base_url, timeout=15, trust_env=False) as client:
        # This is deliberately the first ranked HTTP retrieval after corpus freeze.
        first = [request(client, case, retain=True) for case in cases]
        report["first_pass"] = {
            "summary": percentiles(first),
            "rows": first,
            "cold_disk_cache": False,
        }
        report["relevance"] = {}
        for intent in sorted({case["intent"] for case in cases}):
            selected = [(c, r) for c, r in zip(cases, first, strict=True) if c["intent"] == intent]
            scores = [{"id": c["id"], "score": score(c, r)} for c, r in selected]
            report["relevance"][intent] = {
                "mean": sum(s["score"] for s in scores) / len(scores),
                "cases": scores,
            }
        write(output, report)
        for concurrency in (1, 5):
            schedule = [cases[i % len(cases)] for i in range(count)]
            random.Random(20260908).shuffle(schedule)
            with ThreadPoolExecutor(max_workers=concurrency) as pool:
                rows = list(pool.map(lambda case: request(client, case), schedule))
            report[f"warmed_concurrency_{concurrency}"] = {
                "summary": percentiles(rows),
                "rows": rows,
            }
            write(output, report)
            print(concurrency, percentiles(rows), flush=True)
        schema = client.get("/openapi.json")
        scalar = client.get("/scalar")
        report["documentation"] = {
            "openapi_status": schema.status_code,
            "search_operation": schema.json()["paths"]["/api/v1/products/search"]["get"],
            "scalar_status": scalar.status_code,
            "scalar_links_openapi": "/openapi.json" in scalar.text,
        }
        pages = []
        for case, row in zip(cases, first, strict=True):
            cursor = row.get("body", {}).get("meta", {}).get("pagination", {}).get("next_cursor")
            if not cursor:
                continue
            next_row = request(client, case, cursor, retain=True)
            previous = {p["barcode"] for p in row["body"]["data"]["products"]}
            following = {
                p["barcode"] for p in next_row.get("body", {}).get("data", {}).get("products", [])
            }
            pages.append(
                {
                    "id": case["id"],
                    "disjoint": previous.isdisjoint(following),
                    "continuation": next_row,
                }
            )
        report["continuations"] = pages
        write(output, report)


class CaptureAggregate(monitoring.CommandListener):
    def __init__(self) -> None:
        self.commands: list[dict[str, Any]] = []

    def started(self, event: monitoring.CommandStartedEvent) -> None:
        if event.command_name == "aggregate":
            self.commands.append(dict(event.command))

    def succeeded(self, event: monitoring.CommandSucceededEvent) -> None:
        pass

    def failed(self, event: monitoring.CommandFailedEvent) -> None:
        pass


def plans(output: Path) -> None:
    listener = CaptureAggregate()
    client: MongoClient[dict[str, Any]] = MongoClient(
        DEFAULT_OFF_MONGODB_URI, event_listeners=[listener]
    )
    database = client.lifegoods_off
    source = OpenFoodFactsDatasetSource(database)
    snapshot = source.resolve_product_lookup_snapshot()
    result = []
    for kind, query in [
        ("common", "Kroger"),
        ("rare", "កូកា-កូឡា"),
        ("no-match", "zzlifegoodsabsent107"),
        ("short-prefix", "co"),
        ("short-prefix", "ch"),
        ("short-prefix", "ca"),
        ("short-final-term", "sweet c"),
        ("sparse-short-prefix", "តែ ប"),
    ]:
        parsed = parse_and_validate_query(query)
        item: dict[str, Any] = {"kind": kind, "query": query}
        listener.commands.clear()
        try:
            source.search_text(snapshot, parsed.terms, " ".join(parsed.terms))
        except Exception as error:
            item["retrieval_error"] = type(error).__name__
        item["commands"] = []
        for command in list(listener.commands):
            clean = {
                k: command[k]
                for k in ("aggregate", "pipeline", "cursor", "maxTimeMS", "hint")
                if k in command
            }
            captured: dict[str, Any] = {"command": clean}
            try:
                captured["explain"] = database.command("explain", clean, verbosity="executionStats")
            except Exception as error:
                captured["explain_error"] = type(error).__name__
                captured["details"] = getattr(error, "details", None)
            item["commands"].append(captured)
        result.append(item)
        write(output, result)
    client.close()


def reference_pipeline(terms: tuple[str, ...]) -> list[dict[str, Any]]:
    """Original exhaustive ranking aggregate, retained as an independent ordering oracle."""
    normalized_query = " ".join(terms)
    earlier_terms = list(dict.fromkeys(terms[:-1]))
    final_term = terms[-1]
    escaped_final_term = re.escape(final_term)

    match_conditions: list[dict[str, Any]] = [
        {"$or": [{"name_tokens": t}, {"brand_tokens": t}]} for t in earlier_terms
    ]
    match_conditions.append(
        {
            "$or": [
                {"name_tokens": {"$regex": f"^{escaped_final_term}"}},
                {"brand_tokens": {"$regex": f"^{escaped_final_term}"}},
            ]
        }
    )

    pipeline: list[dict[str, Any]] = [
        {"$match": {"$and": match_conditions}},
        {
            "$set": {
                "rank": {
                    "$switch": {
                        "branches": [
                            {
                                "case": {"$in": [normalized_query, "$brand_values"]},
                                "then": 0,
                            },
                            {
                                "case": {"$in": [normalized_query, "$name_values"]},
                                "then": 1,
                            },
                            {
                                "case": {
                                    "$or": [
                                        {"$in": [final_term, "$name_tokens"]},
                                        {"$in": [final_term, "$brand_tokens"]},
                                    ]
                                },
                                "then": 2,
                            },
                        ],
                        "default": 3,
                    }
                }
            }
        },
    ]

    return pipeline + [{"$sort": {"rank": 1, "name_sort": 1, "code": 1}}]


def smoke(output: Path, base_url: str, pagination_query: str) -> None:
    """Inspect real HTTP contract and exhaust a fixed narrow query at full scale."""
    checks: list[dict[str, Any]] = []
    with httpx.Client(base_url=base_url, timeout=15, trust_env=False) as client:
        examples = [
            ({"q": "8847100567574"}, 200, None),
            ({"q": " 8847-100 567574 "}, 200, None),
            ({"q": "0000105000011"}, 200, None),
            ({"q": "9999999876547"}, 200, None),
            ({"q": "8847100567575"}, 422, "invalid_barcode"),
            ({"q": "!!!"}, 422, "invalid_query"),
            ({"q": "x"}, 422, "invalid_query"),
            ({"q": "x" * 201}, 422, "invalid_query"),
            ({"q": "a b c d e f g h i j k"}, 422, "invalid_query"),
            ({"q": "milk", "cursor": "invalid"}, 422, "invalid_cursor"),
            ({"q": "8847100567574", "cursor": "invalid"}, 422, "invalid_cursor"),
            ({"q": "zzlifegoodsabsent107"}, 200, None),
            ({"q": "1664"}, 200, None),
        ]
        for params, expected_status, expected_error in examples:
            response = client.get("/api/v1/products/search", params=params)
            body = response.json()
            products = body.get("data", {}).get("products", [])
            expected_codes = {
                "8847100567574": ["8847100567574"],
                " 8847-100 567574 ": ["8847100567574"],
                "0000105000011": ["0000105000011"],
                "9999999876547": [],
                "zzlifegoodsabsent107": [],
            }.get(params["q"])
            actual_codes = [product["barcode"] for product in products]
            semantic_pass = (
                expected_status != 200 or expected_codes is None or actual_codes == expected_codes
            )
            if response.status_code == 200:
                ProductSearchResponse.model_validate(body)
                semantic_pass = (
                    semantic_pass and body["meta"]["source"]["name"] == "Open Food Facts"
                )
                semantic_pass = semantic_pass and all(
                    product["source"]["name"] == "Open Food Facts"
                    and product["source"]["product_url"]
                    == f"https://world.openfoodfacts.org/product/{product['barcode']}"
                    for product in products
                )
            checks.append(
                {
                    "params": params,
                    "status": response.status_code,
                    "body": body,
                    "expected_codes": expected_codes,
                    "passed": response.status_code == expected_status
                    and body.get("error", {}).get("code") == expected_error
                    and semantic_pass,
                }
            )
        # A fixed source-derived narrow brand query; retain failure if it cannot terminate.
        case = {"id": "exhaustive-pagination", "query": pagination_query}
        pages: list[dict[str, Any]] = []
        codes: list[str] = []
        cursor = None
        terminated = False
        first_cursor = None
        for _ in range(100):
            row = request(client, case, cursor, retain=True)
            pages.append(row)
            if row["status"] != 200:
                break
            codes.extend(p["barcode"] for p in row["body"]["data"]["products"])
            cursor = row["body"]["meta"]["pagination"]["next_cursor"]
            if first_cursor is None:
                first_cursor = cursor
            if cursor is None:
                terminated = True
                break
        mismatched = None
        malformed = None
        if first_cursor:
            response = client.get(
                "/api/v1/products/search", params={"q": "milk", "cursor": first_cursor}
            )
            mismatched = {"status": response.status_code, "body": response.json()}
            response = client.get(
                "/api/v1/products/search",
                params={"q": case["query"], "cursor": first_cursor + "!!!!"},
            )
            body = response.json()
            malformed = {
                "mutation": "Append four non-base64 exclamation marks",
                "status": response.status_code,
                "body": body,
                "passed": response.status_code == 422
                and body.get("error", {}).get("code") == "invalid_cursor",
            }
        # Compare all HTTP codes with the original exhaustive ranking oracle, outside timing.
        listener = CaptureAggregate()
        mongo: MongoClient[dict[str, Any]] = MongoClient(
            DEFAULT_OFF_MONGODB_URI, event_listeners=[listener]
        )
        source = OpenFoodFactsDatasetSource(mongo.lifegoods_off)
        parsed = parse_and_validate_query(case["query"])
        comparison: dict[str, Any] = {}
        try:
            snapshot = source.resolve_product_lookup_snapshot()
            from lifegoods.open_food_facts import validate_search_index_readiness

            collection = validate_search_index_readiness(mongo.lifegoods_off, snapshot.version)
            pipeline = reference_pipeline(parsed.terms) + [
                {"$limit": 2001},
                {"$project": {"code": 1}},
            ]
            expected = list(mongo.lifegoods_off[collection].aggregate(pipeline, maxTimeMS=2000))
            expected_codes = [p["code"] for p in expected]
            comparison = {
                "database_codes": expected_codes,
                "within_comparison_bound": len(expected_codes) <= 2000,
                "same_order_no_omissions": terminated and codes == expected_codes,
            }
        except Exception as error:
            comparison = {"error": type(error).__name__}
        mongo.close()
        write(
            output,
            {
                "checks": checks,
                "pagination": {
                    "query": case["query"],
                    "pages": pages,
                    "terminated": terminated,
                    "unique": len(codes) == len(set(codes)),
                    "result_count": len(codes),
                    "comparison": comparison,
                    "mismatched_cursor": mismatched,
                    "malformed_cursor": malformed,
                },
            },
        )


def serve(port: int, normal_limit: bool) -> None:
    env = dict(os.environ)
    redis_database = NORMAL_REDIS_DATABASE if normal_limit else BENCHMARK_REDIS_DATABASE
    env.update(
        LIFEGOODS_PRODUCT_SEARCH_REQUESTS_PER_MINUTE="60"
        if normal_limit
        else str(BENCHMARK_RATE_LIMIT),
        LIFEGOODS_REDIS_URL=f"redis://localhost:6380/{redis_database}",
    )
    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "lifegoods.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--no-access-log",
        ],
        env=env,
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["freeze", "run", "plans", "serve", "smoke"])
    parser.add_argument("--corpus", type=Path, default=ARTIFACTS / "corpus-v1.json")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--base-url", default="http://127.0.0.1:8107")
    parser.add_argument("--requests", type=int, default=1000)
    parser.add_argument("--port", type=int, default=8107)
    parser.add_argument("--normal-limit", action="store_true")
    parser.add_argument("--pagination-query", default="Darigold Inc")
    args = parser.parse_args()
    if args.action == "freeze":
        freeze(args.corpus)
    elif args.action == "serve":
        serve(args.port, args.normal_limit)
    elif args.action == "smoke":
        smoke(args.output or ARTIFACTS / "http-smoke.json", args.base_url, args.pagination_query)
    elif args.action == "plans":
        plans(args.output or ARTIFACTS / "plans.json")
    else:
        if args.requests < 1000:
            parser.error("At least 1,000 requests per concurrency required")
        run(
            args.corpus,
            args.output or ARTIFACTS / "http-measurements.json",
            args.base_url,
            args.requests,
        )


if __name__ == "__main__":
    main()
