"""Deterministic checks; MongoDB performance must be measured separately."""

from __future__ import annotations

import mongomock
import pytest

from lifegoods.open_food_facts.search_index import index_document
from lifegoods.open_food_facts.search_text import normalize_search_text, tokens
from lifegoods.search_validation.cli import (
    cases_from_sources,
    pipeline,
    prepare,
    score,
    search,
    summarize,
    validate_ready,
)


@pytest.mark.parametrize("query", ["", "  !!! ", "x" * 201, " ".join(["a"] * 11)])
def test_rejects_invalid_queries(query):
    with pytest.raises(ValueError):
        pipeline(query)


def test_normalization_and_khmer_baseline_limitation():
    assert normalize_search_text("  CAFÉ—Milk! ") == "café milk"
    assert normalize_search_text("ＭＩＬＫ") == "milk"
    # Preserve an explicit regression witness: baseline drops Khmer combining marks.
    original = "ទឹកដោះគោ"
    assert normalize_search_text(original) != original
    assert tokens(original)
    assert normalize_search_text("Milk ទឹកដោះគោ") == "milk " + normalize_search_text(original)


def test_cross_field_matching_exact_ranking_ties_and_limit():
    database = mongomock.MongoClient().evaluation
    records = [
        {"code": "3", "product_name": "Acme Milk", "brands": "Other"},
        {"code": "2", "product_name": "Milk", "brands": "Acme"},
        {"code": "1", "product_name": "Milk", "brands": "Acme"},
        {"code": "4", "product_name": "Other", "brands": "Acme Milk"},
        {"code": "5", "product_name": "Acme", "brands": "Unrelated"},
    ]
    database.products.insert_many([index_document(r) for r in records])
    assert [r["code"] for r in search(database, "acme milk")] == ["3", "4", "1", "2"]
    assert search(database, "no such source") == []
    database.products.insert_many(
        [
            index_document({"code": f"extra{i}", "product_name": "Milk", "brands": "Acme"})
            for i in range(30)
        ]
    )
    assert len(search(database, "milk")) == 20


def test_missing_index_and_snapshot_mismatch():
    database = mongomock.MongoClient().evaluation
    with pytest.raises(ValueError, match="unavailable"):
        validate_ready(database, "v1")
    database.metadata.insert_one(
        {"_id": "evaluation", "status": "ready", "version": "v1", "schema": 1}
    )
    with pytest.raises(ValueError, match="mismatch"):
        validate_ready(database, "v2")
    with pytest.raises(ValueError, match="indexes unavailable"):
        validate_ready(database, "v1")
    database.products.create_index("name_tokens")
    database.products.create_index("brand_tokens")
    assert validate_ready(database, "v1")["version"] == "v1"


def test_preparation_refuses_nonempty_database(tmp_path):
    client = mongomock.MongoClient()
    client.evaluation.existing.insert_one({"data": "keep"})
    with pytest.raises(ValueError, match="empty"):
        prepare(client.source, client.evaluation, "v1", tmp_path / "queries.json")
    assert client.evaluation.existing.count_documents({}) == 1


def test_source_derived_case_distribution_and_scores():
    from collections import Counter

    samples = [
        {
            "name": f"Product milk {i}",
            "brand": "Acme",
            "code": str(i),
            "language": "en",
            "field": "product_name_en",
        }
        for i in range(60)
    ]
    cases = cases_from_sources(samples, "v1")["cases"]
    assert Counter(c["kind"] for c in cases) == {
        "exact": 20,
        "fragment": 10,
        "brand": 10,
        "combined": 10,
        "normalization": 5,
        "negative": 5,
    }
    assert score(cases[0], [{"code": "0"}]) == {"hit_at5": 1, "exact_top1": 1}
    assert score(cases[0], []) == {"hit_at5": 0, "exact_top1": 0}
    assert score(cases[30], [{"code": "x", "summary": {"brands": "Acme"}}]) == {
        "brand_precision_at5": 1,
    }
    assert score(cases[-1], []) == {"negative_success": 1}


def test_timing_summary_includes_failures_and_tail():
    rows = [
        {"elapsed_ms": i, "error": "ExecutionTimeout" if i == 100 else None, "timeout": i == 100}
        for i in range(1, 101)
    ]
    assert summarize(rows) == {
        "requests": 100,
        "errors": 1,
        "timeouts": 1,
        "p50_ms": 50,
        "p95_ms": 95,
        "p99_ms": 99,
    }


def test_search_enforces_database_deadline():
    class Collection:
        def aggregate(self, stages, **kwargs):
            assert kwargs == {"maxTimeMS": 2000}
            assert {"$limit": 20} in stages
            return iter([])

    class Database:
        products = Collection()

    assert search(Database(), "milk") == []


def test_evaluation_counts_database_timeouts_as_relevance_failures(tmp_path, monkeypatch):
    from pymongo.errors import ExecutionTimeout

    from lifegoods.search_validation import cli

    samples = [
        {
            "name": f"Product milk {i}",
            "brand": "Acme",
            "code": str(i),
            "language": "en",
            "field": "product_name_en",
        }
        for i in range(60)
    ]
    path = tmp_path / "queries.json"
    cli.write_json(path, cases_from_sources(samples, "v1"))
    monkeypatch.setattr(cli, "validate_ready", lambda *_: {"version": "v1"})

    def fail(*_):
        raise ExecutionTimeout("test timeout")

    monkeypatch.setattr(cli, "search", fail)

    class Database:
        @property
        def products(self):
            return self

        def count_documents(self, *args, **kwargs):
            return 0

        def command(self, *args, **kwargs):
            return {"fixture": True}

    result = cli.evaluate(Database(), "v1", path, 1000)
    assert result["relevance"]["exact_top1"] == 0
    assert result["relevance"]["negative_success"] == 0
    assert result["warmed"]["5"]["summary"]["timeouts"] == 1000
    assert result["recommendation"] == "revise baseline before API"


def test_equivalent_names_require_original_text_and_brand():
    case = {
        "kind": "exact",
        "expected_codes": ["1"],
        "source_name": "ទឹកដោះគោ",
        "source_brand": "Acme",
    }
    equivalent = {"code": "2", "summary": {"name": "ទឹកដោះគោ", "brands": "Acme"}}
    collision = {"code": "3", "summary": {"name": "ទ កដ គ", "brands": "Acme"}}
    assert score(case, [equivalent])["exact_top1"] == 1
    assert score(case, [collision])["exact_top1"] == 0
