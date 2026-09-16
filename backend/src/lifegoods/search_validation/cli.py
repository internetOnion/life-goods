"""Prepare and evaluate an isolated, snapshot-pinned MongoDB search baseline."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import random
import unicodedata
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from lifegoods.open_food_facts.search_index import index_document
from lifegoods.open_food_facts.search_text import normalize_search_text, tokens

SCHEMA = 1
TARGETS = {
    "exact_top1": 0.9,
    "hit_at5": 0.9,
    "brand_precision_at5": 0.8,
    "warm_concurrency5_p95_ms": 300,
}


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, default=str) + "\n", encoding="utf-8"
    )


def pipeline(query: str) -> list[dict[str, Any]]:
    normalized = normalize_search_text(query)
    parts = tokens(query)
    if len(query) > 200 or not parts or len(parts) > 10:
        raise ValueError("Query must contain 1–10 tokens and at most 200 characters")
    return [
        {
            "$match": {
                "$and": [
                    {"$or": [{"name_tokens": t}, {"brand_tokens": t}]} for t in dict.fromkeys(parts)
                ]
            }
        },
        {
            "$set": {
                "rank": {
                    "$switch": {
                        "branches": [
                            {"case": {"$in": [normalized, "$name_values"]}, "then": 0},
                            {"case": {"$in": [normalized, "$brand_values"]}, "then": 1},
                        ],
                        "default": 2,
                    }
                }
            }
        },
        {"$sort": {"rank": 1, "name_sort": 1, "code": 1}},
        {"$limit": 20},
        {"$project": {"_id": 0, "code": 1, "summary": 1, "name_values": 1, "brand_values": 1}},
    ]


def search(database: Any, query: str) -> list[dict[str, Any]]:
    return list(database.products.aggregate(pipeline(query), maxTimeMS=2000))


def validate_ready(database: Any, version: str) -> dict[str, Any]:
    manifest = database.metadata.find_one({"_id": "evaluation"})
    if not manifest or manifest.get("status") != "ready":
        raise ValueError("Evaluation index unavailable; run prepare first")
    if manifest.get("version") != version or manifest.get("schema") != SCHEMA:
        raise ValueError("Evaluation index version/schema mismatch")
    indexes = database.products.index_information()
    if not {"name_tokens_1", "brand_tokens_1"}.issubset(indexes):
        raise ValueError("Evaluation token indexes unavailable")
    return manifest


def cases_from_sources(samples: list[dict[str, Any]], version: str) -> dict[str, Any]:
    # Expectations derive from source text, never candidate search results.
    usable = []
    for source in samples:
        name = source["name"]
        if 2 <= len(tokens(name)) <= 7 and len(name) <= 150:
            usable.append(source)
    if len(usable) < 50:
        raise ValueError("Insufficient source examples to curate 60 cases")
    cases = []
    for i, source in enumerate(usable[:50]):
        name, brand = source["name"], source["brand"]
        kind = "exact" if i < 20 else "fragment" if i < 30 else "brand" if i < 40 else "combined"
        query = name
        if kind == "fragment":
            query = " ".join(name.split()[:2])
        elif kind == "brand":
            query = brand
        elif kind == "combined":
            query = brand + " " + " ".join(name.split()[:2])
        pipeline(query)
        cases.append(
            {
                "id": f"q{i + 1:02}",
                "kind": kind,
                "language": source["language"],
                "query": query,
                "expected_codes": [source["code"]],
                "expected_brand": normalize_search_text(brand) if kind == "brand" else None,
                "source_name": name,
                "source_brand": brand,
                "source_field": source["field"],
            }
        )
    for i in range(5):
        source = usable[i]
        cases.append(
            {
                "id": f"q{51 + i}",
                "kind": "normalization",
                "language": source["language"],
                "query": "  " + source["name"].upper() + " !",
                "expected_codes": [source["code"]],
                "source_name": source["name"],
                "source_brand": source["brand"],
                "source_field": source["field"],
            }
        )
    for i in range(5):
        cases.append(
            {
                "id": f"q{56 + i}",
                "kind": "negative",
                "language": "und",
                "query": f"lifegoodsnonexistenttokenxyz{i}",
                "expected_codes": [],
            }
        )
    return {
        "version": version,
        "schema": SCHEMA,
        "label_method": "source-derived before retrieval",
        "limitations": [
            "Convenience sample; not Cambodian market coverage",
            "Primary name/brand equivalents accepted; localized-only alternatives may be missed",
            "Brand relevance means exact source brand membership",
        ],
        "cases": cases,
    }


def prepare(source: Any, target: Any, version: str, query_path: Path) -> dict[str, Any]:
    if target.list_collection_names():
        raise ValueError("Preparation requires an empty isolated evaluation database")
    manifest = source.off_dataset_versions.find_one({"_id": version})
    if (
        not manifest
        or not manifest.get("collection_name")
        or manifest.get("status") not in {"READY", "ACTIVE"}
    ):
        raise ValueError("Dataset Snapshot unavailable or not ready")
    collection = source[manifest["collection_name"]]
    started = perf_counter()
    target.metadata.insert_one({"_id": "evaluation", "status": "building", "version": version})
    languages: Counter[str] = Counter()
    candidates: dict[str, list[dict[str, Any]]] = {}
    batch = []
    count = missing = 0
    # Project dynamic name fields on the server; never transfer entire Source Records.
    source_projection = [
        {
            "$replaceWith": {
                "$arrayToObject": {
                    "$filter": {
                        "input": {"$objectToArray": "$$ROOT"},
                        "as": "field",
                        "cond": {
                            "$or": [
                                {
                                    "$in": [
                                        "$$field.k",
                                        ["code", "brands", "quantity", "product_name"],
                                    ]
                                },
                                {"$regexMatch": {"input": "$$field.k", "regex": "^product_name_"}},
                            ]
                        },
                    }
                }
            }
        }
    ]
    for record in collection.aggregate(source_projection, batchSize=2000):
        doc = index_document(record)
        if doc is None:
            continue
        raw_names = [
            (k, v)
            for k, v in record.items()
            if (k == "product_name" or k.startswith("product_name_"))
            and isinstance(v, str)
            and v.strip()
        ]
        if not raw_names:
            missing += 1
        doc["summary"] = {
            "name": record.get("product_name"),
            "brands": record.get("brands"),
            "quantity": record.get("quantity"),
            "source": "Open Food Facts",
            "product_url": f"https://world.openfoodfacts.org/product/{doc['code']}",
        }
        for field, name in raw_names:
            lang = field.removeprefix("product_name_") if field != "product_name" else "und"
            languages[lang] += 1
            raw_brand = record.get("brands")
            brand = raw_brand.split(",")[0].strip() if isinstance(raw_brand, str) else ""
            # Field suffixes can be wrong; prioritize actual Khmer script separately.
            bucket_key = (
                "script_khmer:" + lang if any("\u1780" <= c <= "\u17ff" for c in name) else lang
            )
            bucket = candidates.setdefault(bucket_key, [])
            if (
                len(bucket) < 100
                and brand
                and 1 <= len(tokens(brand)) <= 3
                and len(brand) < 40
                and 2 <= len(tokens(name)) <= 7
                and len(name) <= 150
            ):
                bucket.append(
                    {
                        "name": name,
                        "brand": brand,
                        "code": doc["code"],
                        "language": lang,
                        "field": field,
                    }
                )
        batch.append(doc)
        count += 1
        if len(batch) == 2000:
            target.products.insert_many(batch)
            batch.clear()
        if count % 250000 == 0:
            print(f"Prepared {count:,} Source Records", flush=True)
    if batch:
        target.products.insert_many(batch)
    for field in ("name_tokens", "brand_tokens"):
        target.products.create_index(field)
    target.products.create_index([("name_sort", 1), ("code", 1)])
    ordered_languages = sorted(
        candidates,
        key=lambda x: (
            not x.startswith("script_khmer:"),
            x not in {"km"},
            x != "en",
            x,
        ),
    )
    samples = []
    seen = set()
    for offset in range(100):
        for lang in ordered_languages:
            if offset < len(candidates[lang]):
                item = candidates[lang][offset]
                if item["code"] not in seen:
                    samples.append(item)
                    seen.add(item["code"])
    query_set = cases_from_sources(samples, version)
    stats = target.command("collStats", "products")
    result = {
        "_id": "evaluation",
        "schema": SCHEMA,
        "version": version,
        "status": "ready",
        "records": count,
        "source_records": collection.count_documents({}, hint="_id_"),
        "missing_names": missing,
        "name_field_counts_by_language": dict(languages),
        "source_indexes": list(collection.list_indexes()),
        "evaluation_indexes": list(target.products.list_indexes()),
        "index_bytes": stats["totalIndexSize"],
        "storage_bytes": stats["storageSize"],
        "mongodb_version": target.client.server_info()["version"],
        "host": {"platform": platform.platform(), "cpu_count": os.cpu_count()},
        "mongodb_host": target.client.admin.command("hostInfo")["system"],
        "prepared_at": datetime.now(UTC).isoformat(),
        "prepare_seconds": perf_counter() - started,
    }
    target.metadata.replace_one({"_id": "evaluation"}, result)
    write_json(query_path, query_set)
    return result


def original_key(value: str) -> str:
    """Compare labels without candidate tokenization or loss of combining marks."""
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def brand_relevant(case: dict[str, Any], row: dict[str, Any]) -> bool:
    brands = row.get("summary", {}).get("brands")
    return isinstance(brands, str) and original_key(case["source_brand"]) in [
        original_key(brand) for brand in brands.split(",")
    ]


def score(case: dict[str, Any], results: list[dict[str, Any]]) -> dict[str, float]:
    expected = set(case["expected_codes"])
    codes = [r["code"] for r in results]
    if case["kind"] == "negative":
        return {"negative_success": float(not codes)}
    if case["kind"] == "brand":
        top = results[:5]
        return {
            "brand_precision_at5": sum(brand_relevant(case, r) for r in top) / len(top)
            if top
            else 0.0
        }

    def relevant(row: dict[str, Any]) -> bool:
        if row["code"] in expected:
            return True
        summary = row.get("summary", {})
        name, brands = summary.get("name"), summary.get("brands")
        return (
            isinstance(name, str)
            and isinstance(brands, str)
            and bool(case.get("source_brand"))
            and original_key(name) == original_key(case["source_name"])
            and original_key(case["source_brand"]) in [original_key(b) for b in brands.split(",")]
        )

    value = {"hit_at5": float(any(relevant(row) for row in results[:5]))}
    if case["kind"] == "exact":
        value["exact_top1"] = float(bool(results and relevant(results[0])))
    return value


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    times = sorted(r["elapsed_ms"] for r in rows)
    return {
        "requests": len(rows),
        "errors": sum(r["error"] is not None for r in rows),
        "timeouts": sum(r["timeout"] for r in rows),
        **{f"p{p}_ms": times[max(0, math.ceil(len(times) * p / 100) - 1)] for p in (50, 95, 99)},
    }


def averages(rows: list[dict[str, Any]]) -> dict[str, float]:
    keys = {key for row in rows for key in row["scores"]}
    return {
        key: sum(r["scores"][key] for r in rows if key in r["scores"])
        / sum(key in r["scores"] for r in rows)
        for key in sorted(keys)
    }


def evaluate(database: Any, version: str, query_path: Path, requests: int) -> dict[str, Any]:
    manifest = validate_ready(database, version)
    query_set = json.loads(query_path.read_text(encoding="utf-8"))
    cases = query_set["cases"]
    if query_set["version"] != version or len(cases) != 60 or requests < 1000:
        raise ValueError("Require 60 snapshot-pinned cases and at least 1,000 requests per run")
    required_kinds = {
        "exact": 20,
        "fragment": 10,
        "brand": 10,
        "combined": 10,
        "normalization": 5,
        "negative": 5,
    }
    if Counter(c["kind"] for c in cases) != required_kinds:
        raise ValueError("Query set must retain the fixed case distribution")
    if len({c["id"] for c in cases}) != 60:
        raise ValueError("Query case identifiers must be unique")
    for case in cases:
        pipeline(case["query"])
        if case["kind"] != "negative" and not case["expected_codes"]:
            raise ValueError("Positive cases require source-derived expected Barcodes")

    def execute(case: dict[str, Any]) -> dict[str, Any]:
        start = perf_counter()
        results, error, timeout = [], None, False
        try:
            results = search(database, case["query"])
        except PyMongoError as exc:
            error, timeout = type(exc).__name__, exc.timeout
        return {
            "id": case["id"],
            "kind": case["kind"],
            "language": case["language"],
            "elapsed_ms": (perf_counter() - start) * 1000,
            "error": error,
            "timeout": timeout,
            "results": results,
            "scores": score(case, results) if error is None else {k: 0.0 for k in score(case, [])},
        }

    first = [execute(case) for case in cases]
    print("First-pass queries complete", flush=True)
    runs = {}
    for concurrency in (1, 5):
        order = [cases[i % len(cases)] for i in range(requests)]
        random.Random(20260908).shuffle(order)
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            rows = list(pool.map(execute, order))
        runs[str(concurrency)] = {
            "summary": summarize(rows),
            "requests": [
                {k: v for k, v in r.items() if k not in {"results", "scores"}} for r in rows
            ],
        }
        print(f"Completed {requests} requests at concurrency {concurrency}", flush=True)
    cardinalities = []
    for case in cases:
        try:
            count = database.products.count_documents(
                pipeline(case["query"])[0]["$match"], maxTimeMS=2000
            )
            cardinalities.append({"id": case["id"], "matches": count})
        except PyMongoError as exc:
            cardinalities.append({"id": case["id"], "error": type(exc).__name__})
    nonempty = sorted(
        (r for r in cardinalities if r.get("matches", 0) > 0), key=lambda r: r["matches"]
    )
    selected = []
    if nonempty:
        by_id = {c["id"]: c for c in cases}
        selected.extend([("common", by_id[nonempty[-1]["id"]]), ("rare", by_id[nonempty[0]["id"]])])
    selected.append(("no_match", next(c for c in cases if c["kind"] == "negative")))
    plans = []
    for label, case in selected:
        try:
            plan = database.command(
                "explain",
                {
                    "aggregate": "products",
                    "pipeline": pipeline(case["query"]),
                    "cursor": {},
                    "maxTimeMS": 2000,
                },
                verbosity="executionStats",
            )
            plans.append({"label": label, "id": case["id"], "plan": plan})
        except PyMongoError as exc:
            plans.append({"label": label, "id": case["id"], "error": type(exc).__name__})
    metrics = averages(first)
    passed = (
        all(
            metrics.get(k, 0) >= v
            for k, v in TARGETS.items()
            if k in {"exact_top1", "hit_at5", "brand_precision_at5"}
        )
        and runs["5"]["summary"]["p95_ms"] < 300
        and not any(r["error"] for r in first)
        and all(run["summary"]["errors"] == 0 for run in runs.values())
    )
    return {
        "manifest": manifest,
        "query_set_sha256": hashlib.sha256(query_path.read_bytes()).hexdigest(),
        "measured_at": datetime.now(UTC).isoformat(),
        "targets": TARGETS,
        "relevance": metrics,
        "case_counts_by_language": dict(Counter(c["language"] for c in cases)),
        "case_counts_by_kind": dict(Counter(c["kind"] for c in cases)),
        "by_language": {
            lang: averages([r for r in first if r["language"] == lang])
            for lang in sorted({r["language"] for r in first})
        },
        "by_kind": {
            kind: averages([r for r in first if r["kind"] == kind])
            for kind in sorted({r["kind"] for r in first})
        },
        "first_pass": {"summary": summarize(first), "cases": first},
        "warmed": runs,
        "execution_plans": plans,
        "query_cardinalities": cardinalities,
        "recommendation": "proceed with baseline" if passed else "revise baseline before API",
        "limitations": query_set["limitations"]
        + [
            "Local feasibility only; first pass is not cold disk-cache performance",
            "No application cache or translation provider; curated queries only",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("prepare", "run"))
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--evaluation-database", required=True)
    parser.add_argument("--source-database", default="lifegoods_off")
    parser.add_argument("--query-set", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--requests", type=int, default=1000)
    args = parser.parse_args()
    if (
        not args.evaluation_database.startswith("lifegoods_search_eval_")
        or args.evaluation_database == args.source_database
    ):
        parser.error("Use a separate database named lifegoods_search_eval_<experiment>")
    # Separate credentials; never use the evaluation connection to read source data.
    with MongoClient(
        os.environ["LIFEGOODS_SEARCH_EVAL_URI"], serverSelectionTimeoutMS=5000
    ) as client:
        target = client[args.evaluation_database]
        if args.command == "prepare":
            with MongoClient(
                os.environ["LIFEGOODS_SEARCH_SOURCE_URI"], serverSelectionTimeoutMS=5000
            ) as reader:
                result = prepare(
                    reader[args.source_database], target, args.dataset_version, args.query_set
                )
        else:
            result = evaluate(target, args.dataset_version, args.query_set, args.requests)
    write_json(args.output, result)


if __name__ == "__main__":
    main()
