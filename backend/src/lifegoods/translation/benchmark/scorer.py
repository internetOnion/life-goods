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
TRANSLATION_DEADLINE_MS = 12_000.0
MIN_PERCENTILE_SAMPLE_SIZE = 20
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
    estimated_cost_usd: float | None = None
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
    twelve_second_budget_rate: float
    avg_latency_ms: float
    p95_latency_ms: float | None
    measurement_mode: str
    status_counts: dict[str, int]
    timeout_count: int
    cached_provider_call_count: int
    usage_sample_count: int
    total_input_tokens: int | None
    total_output_tokens: int | None
    total_thinking_tokens: int | None
    total_billed_output_tokens: int | None
    total_estimated_cost_usd: float | None
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
    latency_within_budget = output.latency_ms <= TRANSLATION_DEADLINE_MS and not output.timed_out

    if not latency_within_budget:
        issues.append(f"Latency {output.latency_ms:.1f}ms exceeded 12000ms translation budget")

    if output.status != "success":
        schema_valid = False
        issues.append(output.error_message or "Candidate output status is error")

    expected_generated_fields = [
        f for f in item.fields if f.expected_status == "generated" and f.original_text
    ]

    for benchmark_field in item.fields:
        actual_status = output.field_statuses.get(benchmark_field.field_name)
        if actual_status != benchmark_field.expected_status:
            schema_valid = False
            issues.append(
                f"Field '{benchmark_field.field_name}' expected status "
                f"'{benchmark_field.expected_status}', got '{actual_status}'"
            )

    for field_name, expected_status in item.expected_structured_field_statuses.items():
        actual_status = output.field_statuses.get(field_name)
        if actual_status != expected_status:
            schema_valid = False
            issues.append(
                f"Structured field '{field_name}' expected status '{expected_status}', "
                f"got '{actual_status}'"
            )

    for group_name, expected_count in item.expected_taxonomy_reference_counts.items():
        actual_count = output.taxonomy_reference_counts.get(group_name)
        if actual_count != expected_count:
            schema_valid = False
            issues.append(
                f"Taxonomy group '{group_name}' expected {expected_count} references, "
                f"got {actual_count}"
            )

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

    # Structured fields are discovered by the production projection and do not need to
    # be duplicated in the benchmark schema. Validate every generated production outcome.
    for field_name, field_status in output.field_statuses.items():
        if field_status != "generated" or field_name in {
            "categories",
            "product_name",
            "generic_name",
            "ingredients_text",
        }:
            continue
        translated_text = output.translations.get(field_name)
        if not translated_text:
            schema_valid = False
            completeness_valid = False
            issues.append(f"Missing generated structured translation for field '{field_name}'")
            continue
        if LINGERING_PLACEHOLDER_REGEX.search(translated_text):
            placeholder_integrity_valid = False
            issues.append(f"Field '{field_name}' contains a lingering placeholder")
        if not KHMER_SCRIPT_REGEX.search(translated_text):
            khmer_script_valid = False
            issues.append(f"Field '{field_name}' does not contain Khmer script characters")

    # Validate that non-provider fields were not translated
    non_provider_fields = [
        f
        for f in item.fields
        if f.expected_status
        in ("source_khmer_available", "original_text_preserved", "source_data_unavailable")
    ]
    for f in non_provider_fields:
        if output.translations.get(f.field_name):
            schema_valid = False
            issues.append(
                f"Field '{f.field_name}' with status '{f.expected_status}' "
                "must not invoke provider translation"
            )

    if (
        output.measurement_mode == "offline"
        and item.expected_offline_overall_status is not None
        and output.overall_status != item.expected_offline_overall_status
    ):
        schema_valid = False
        issues.append(
            f"Expected overall status '{item.expected_offline_overall_status}', "
            f"got '{output.overall_status}'"
        )

    # If all fields in item are non-provider, verify that no input tokens were consumed
    if (
        non_provider_fields
        and len(non_provider_fields) == len(item.fields)
        and output.input_tokens is not None
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
            twelve_second_budget_rate=0.0,
            avg_latency_ms=0.0,
            p95_latency_ms=None,
            measurement_mode="offline",
            status_counts={},
            timeout_count=0,
            cached_provider_call_count=0,
            usage_sample_count=0,
            total_input_tokens=None,
            total_output_tokens=None,
            total_thinking_tokens=None,
            total_billed_output_tokens=None,
            total_estimated_cost_usd=None,
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
    p95_latency: float | None = None
    if total >= MIN_PERCENTILE_SAMPLE_SIZE:
        p95_idx = min(total - 1, int(0.95 * total))
        p95_latency = round(latencies[p95_idx], 2)

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
        twelve_second_budget_rate=round(budget_count / total, 4),
        avg_latency_ms=round(avg_latency, 2),
        p95_latency_ms=p95_latency,
        measurement_mode="offline",
        status_counts={},
        timeout_count=0,
        cached_provider_call_count=0,
        usage_sample_count=0,
        total_input_tokens=None,
        total_output_tokens=None,
        total_thinking_tokens=None,
        total_billed_output_tokens=None,
        total_estimated_cost_usd=None,
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
    summary.measurement_mode = outputs[0].measurement_mode if outputs else "offline"
    summary.status_counts = {
        status: sum(1 for output in outputs if output.overall_status == status)
        for status in sorted({output.overall_status for output in outputs})
    }
    summary.timeout_count = sum(1 for output in outputs if output.timed_out)
    summary.cached_provider_call_count = sum(output.cached_provider_calls for output in outputs)
    measured_outputs = [
        output
        for output in outputs
        if output.measurement_mode == "live" and output.provider_calls > 0
    ]
    summary.usage_sample_count = sum(
        1 for output in measured_outputs if output.input_tokens is not None
    )

    def complete_total(values: list[int | None]) -> int | None:
        if not values or any(value is None for value in values):
            return None
        return sum(value for value in values if value is not None)

    summary.total_input_tokens = complete_total(
        [output.input_tokens for output in measured_outputs]
    )
    summary.total_output_tokens = complete_total(
        [output.output_tokens for output in measured_outputs]
    )
    summary.total_thinking_tokens = complete_total(
        [output.thinking_tokens for output in measured_outputs]
    )
    summary.total_billed_output_tokens = complete_total(
        [output.billed_output_tokens for output in measured_outputs]
    )
    costs = [output.estimated_cost_usd for output in measured_outputs]
    if costs and all(cost is not None for cost in costs):
        summary.total_estimated_cost_usd = round(
            sum(cost for cost in costs if cost is not None), 6
        )
    return outputs, summary
