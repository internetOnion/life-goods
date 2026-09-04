from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from lifegoods.translation.benchmark.candidate import CandidateOutput, CandidateRunner
from lifegoods.translation.benchmark.dataset import BenchmarkDataset, BenchmarkItem
from lifegoods.translation.benchmark.protection import (
    LINGERING_PLACEHOLDER_REGEX,
    validate_token_preservation,
)

KHMER_SCRIPT_REGEX = re.compile(r"[\u1780-\u17FF\u19E0-\u19FF]")
FOUR_SECOND_BUDGET_MS = 4000.0
ItemStatus = Literal["pass", "fail"]


@dataclass
class ItemEvaluationResult:
    item_id: str
    status: ItemStatus
    schema_valid: bool = True
    token_preservation_valid: bool = True
    placeholder_integrity_valid: bool = True
    completeness_valid: bool = True
    khmer_script_valid: bool = True
    latency_within_budget: bool = True
    latency_ms: float = 0.0
    estimated_cost_usd: float = 0.0
    issues: list[str] = field(default_factory=list)


@dataclass
class BenchmarkEvaluationSummary:
    candidate_name: str
    benchmark_version: str
    total_items: int
    passed_items: int
    failed_items: int
    pass_rate: float
    schema_validity_rate: float
    token_preservation_rate: float
    placeholder_integrity_rate: float
    khmer_script_validity_rate: float
    four_second_budget_rate: float
    avg_latency_ms: float
    p95_latency_ms: float
    total_estimated_cost_usd: float
    item_results: list[ItemEvaluationResult] = field(default_factory=list)


def evaluate_candidate_output(
    item: BenchmarkItem,
    output: CandidateOutput,
) -> ItemEvaluationResult:
    issues: list[str] = []
    schema_valid = True
    token_preservation_valid = True
    placeholder_integrity_valid = True
    completeness_valid = True
    khmer_script_valid = True
    latency_within_budget = output.latency_ms <= FOUR_SECOND_BUDGET_MS

    if not latency_within_budget:
        issues.append(f"Latency {output.latency_ms:.1f}ms exceeded 4000ms translation budget")

    if output.status != "success":
        schema_valid = False
        issues.append(output.error_message or "Candidate output status is error")

    expected_generated_fields = [
        f for f in item.fields if f.expected_status == "generated" and f.original_text
    ]

    for f in expected_generated_fields:
        field_name = f.field_name
        translated_text = output.translations.get(field_name)

        if translated_text is None:
            schema_valid = False
            completeness_valid = False
            issues.append(f"Missing expected translation for field '{field_name}'")
            continue

        if not translated_text.strip():
            completeness_valid = False
            issues.append(f"Empty translation for field '{field_name}'")

        # Check for lingering placeholders
        lingering = LINGERING_PLACEHOLDER_REGEX.findall(translated_text)
        if lingering:
            placeholder_integrity_valid = False
            issues.append(f"Field '{field_name}' contains lingering placeholders: {lingering}")

        # Check token preservation
        token_map = output.token_maps.get(field_name, {})
        val_res = validate_token_preservation(translated_text, token_map)
        if not val_res.is_valid:
            token_preservation_valid = False
            if val_res.missing_tokens:
                issues.append(
                    f"Field '{field_name}' dropped protected tokens: {val_res.missing_tokens}"
                )

        # Check for benchmark-specified protected tokens as well
        for expected_tok in f.protected_tokens:
            if expected_tok not in translated_text:
                token_preservation_valid = False
                issues.append(
                    f"Field '{field_name}' missing expected benchmark token '{expected_tok}'"
                )

        # Check Khmer script
        if not KHMER_SCRIPT_REGEX.search(translated_text):
            khmer_script_valid = False
            issues.append(
                f"Field '{field_name}' translation does not contain Khmer script characters"
            )

    # Validate that non-provider fields were not translated
    non_provider_fields = [
        f
        for f in item.fields
        if f.expected_status in ("source_khmer_available", "source_data_unavailable")
    ]
    for f in non_provider_fields:
        if output.translations.get(f.field_name):
            schema_valid = False
            issues.append(
                f"Field '{f.field_name}' with status '{f.expected_status}' "
                "must not invoke provider translation"
            )

    # If all fields in item are non-provider, verify that no input tokens were consumed
    if (
        non_provider_fields
        and len(non_provider_fields) == len(item.fields)
        and output.input_tokens > 0
    ):
        schema_valid = False
        issues.append(
            f"Item '{item.item_id}' contains only non-provider fields "
            f"but consumed {output.input_tokens} input tokens"
        )

    is_passed = (
        schema_valid
        and token_preservation_valid
        and placeholder_integrity_valid
        and completeness_valid
        and khmer_script_valid
        and latency_within_budget
    )

    return ItemEvaluationResult(
        item_id=item.item_id,
        status="pass" if is_passed else "fail",
        schema_valid=schema_valid,
        token_preservation_valid=token_preservation_valid,
        placeholder_integrity_valid=placeholder_integrity_valid,
        completeness_valid=completeness_valid,
        khmer_script_valid=khmer_script_valid,
        latency_within_budget=latency_within_budget,
        latency_ms=output.latency_ms,
        estimated_cost_usd=output.estimated_cost_usd,
        issues=issues,
    )


def aggregate_evaluation_summary(
    results: list[ItemEvaluationResult],
    candidate_name: str,
    benchmark_version: str,
) -> BenchmarkEvaluationSummary:
    total = len(results)
    if total == 0:
        return BenchmarkEvaluationSummary(
            candidate_name=candidate_name,
            benchmark_version=benchmark_version,
            total_items=0,
            passed_items=0,
            failed_items=0,
            pass_rate=0.0,
            schema_validity_rate=0.0,
            token_preservation_rate=0.0,
            placeholder_integrity_rate=0.0,
            khmer_script_validity_rate=0.0,
            four_second_budget_rate=0.0,
            avg_latency_ms=0.0,
            p95_latency_ms=0.0,
            total_estimated_cost_usd=0.0,
            item_results=[],
        )

    passed = sum(1 for r in results if r.status == "pass")
    failed = total - passed

    schema_valid_count = sum(1 for r in results if r.schema_valid)
    token_preservation_count = sum(1 for r in results if r.token_preservation_valid)
    placeholder_integrity_count = sum(1 for r in results if r.placeholder_integrity_valid)
    khmer_script_count = sum(1 for r in results if r.khmer_script_valid)
    budget_count = sum(1 for r in results if r.latency_within_budget)

    latencies = sorted(r.latency_ms for r in results)
    avg_latency = sum(latencies) / total
    p95_idx = min(total - 1, int(0.95 * total))
    p95_latency = latencies[p95_idx]

    total_cost = sum(r.estimated_cost_usd for r in results)

    return BenchmarkEvaluationSummary(
        candidate_name=candidate_name,
        benchmark_version=benchmark_version,
        total_items=total,
        passed_items=passed,
        failed_items=failed,
        pass_rate=round(passed / total, 4),
        schema_validity_rate=round(schema_valid_count / total, 4),
        token_preservation_rate=round(token_preservation_count / total, 4),
        placeholder_integrity_rate=round(placeholder_integrity_count / total, 4),
        khmer_script_validity_rate=round(khmer_script_count / total, 4),
        four_second_budget_rate=round(budget_count / total, 4),
        avg_latency_ms=round(avg_latency, 2),
        p95_latency_ms=round(p95_latency, 2),
        total_estimated_cost_usd=round(total_cost, 6),
        item_results=results,
    )


def run_and_evaluate_benchmark(
    runner: CandidateRunner,
    dataset: BenchmarkDataset,
) -> tuple[list[CandidateOutput], BenchmarkEvaluationSummary]:
    outputs = runner.run_dataset(dataset)
    results = [
        evaluate_candidate_output(item, out)
        for item, out in zip(dataset.items, outputs, strict=True)
    ]
    summary = aggregate_evaluation_summary(
        results,
        candidate_name=runner.config.name,
        benchmark_version=dataset.version,
    )
    return outputs, summary
