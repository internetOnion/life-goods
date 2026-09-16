from __future__ import annotations

import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from lifegoods.translation.benchmark.candidate import CandidateOutput
from lifegoods.translation.benchmark.dataset import BenchmarkDataset
from lifegoods.translation.benchmark.scorer import BenchmarkEvaluationSummary
from lifegoods.translation.module import TRANSLATION_CONFIG_VERSION


def _value_or_unavailable(value: int | None) -> str:
    return str(value) if value is not None else "unavailable"


def export_summary_json(
    summary: BenchmarkEvaluationSummary,
    output_path: Path,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = asdict(summary)
    data.update(
        {
            "provider": "google",
            "model": summary.candidate_name,
            "translation_configuration_version": TRANSLATION_CONFIG_VERSION,
            "deadline_seconds": 12.0,
            "pricing_source": "https://ai.google.dev/gemini-api/docs/pricing",
        }
    )
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return output_path


def export_measurements_json(outputs: list[CandidateOutput], output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    measurements = [
        {
            "fixture_id": output.item_id,
            "mode": output.measurement_mode,
            "overall_status": output.overall_status,
            "field_statuses": output.field_statuses,
            "taxonomy_reference_counts": output.taxonomy_reference_counts,
            "cold_latency_ms": output.latency_ms,
            "cached_latency_ms": output.cached_latency_ms,
            "deadline_seconds": output.deadline_seconds,
            "timed_out": output.timed_out,
            "provider_calls": output.provider_calls,
            "provider_attempts": output.provider_attempts,
            "cached_provider_calls": output.cached_provider_calls,
            "prompt_tokens": output.input_tokens,
            "visible_output_tokens": output.output_tokens,
            "thinking_tokens": output.thinking_tokens,
            "billed_output_tokens": output.billed_output_tokens,
            "total_tokens": output.total_tokens,
            "estimated_cost_usd": output.estimated_cost_usd,
        }
        for output in outputs
    ]
    with open(output_path, "w", encoding="utf-8") as output_file:
        json.dump(measurements, output_file, indent=2, ensure_ascii=False)
    return output_path


def export_evaluation_report(
    summary: BenchmarkEvaluationSummary,
    dataset: BenchmarkDataset,
    outputs: list[CandidateOutput],
    output_path: Path,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    now_iso = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    evidence_label = (
        "Live provider measurements"
        if summary.measurement_mode == "live"
        else "Deterministic offline verification"
    )
    evidence_boundary = (
        "These values are observed from live Gemini requests."
        if summary.measurement_mode == "live"
        else (
            "Offline latency and fixture outputs are structural test evidence only; they are "
            "not observed provider performance or charges. Token usage and cost remain unavailable."
        )
    )
    p95 = (
        f"{summary.p95_latency_ms:.1f} ms"
        if summary.p95_latency_ms is not None
        else f"not reported (requires at least 20 samples; n={summary.total_items})"
    )
    cost = (
        f"${summary.total_estimated_cost_usd:.6f} USD"
        if summary.total_estimated_cost_usd is not None
        else "unavailable"
    )
    lines: list[str] = [
        "# Khmer Translation automated evaluation",
        "",
        f"Generated: {now_iso}",
        f"Evidence: **{evidence_label}**",
        f"Candidate: `{summary.candidate_name}`",
        f"Translation configuration: `{TRANSLATION_CONFIG_VERSION}`",
        f"Dataset: `{summary.benchmark_version}`",
        "",
        evidence_boundary,
        "Automated checks establish structural behavior only; they do not claim semantic "
        "verification or human-reviewed Product translations. Human review is not required "
        "for this evaluation or production activation.",
        "",
        "## Results",
        "",
        "| Metric | Result |",
        "| :--- | :--- |",
        f"| Items | {summary.total_items} |",
        f"| Pass Rate | {summary.pass_rate * 100:.1f}% "
        f"({summary.passed_items}/{summary.total_items}) |",
        f"| 12-second deadline adherence | {summary.twelve_second_budget_rate * 100:.1f}% |",
        f"| Average cold latency | {summary.avg_latency_ms:.1f} ms |",
        f"| P95 cold latency | {p95} |",
        f"| Completion statuses | `{json.dumps(summary.status_counts, sort_keys=True)}` |",
        f"| Timeouts | {summary.timeout_count} |",
        f"| Cached provider calls | {summary.cached_provider_call_count} |",
        f"| Usage samples | {summary.usage_sample_count}/{summary.total_items} |",
        f"| Prompt tokens | {_value_or_unavailable(summary.total_input_tokens)} |",
        f"| Visible output tokens | {_value_or_unavailable(summary.total_output_tokens)} |",
        f"| Thinking tokens | {_value_or_unavailable(summary.total_thinking_tokens)} |",
        f"| Billed output tokens | {_value_or_unavailable(summary.total_billed_output_tokens)} |",
        f"| Estimated cost | {cost} |",
        "",
        "Cost uses Google Gemini 3.8 Flash standard pricing effective through "
        "2026-12-31: $0.75 per million input tokens and $3.75 per million output tokens, "
        "including thinking tokens. Retries are included in provider attempt counts. A retried "
        "request reports cost as unavailable because the final response cannot establish usage "
        "for every attempt. Other usage is costed only when the API reports enough metadata to "
        "avoid treating missing data as zero. Pricing source: "
        "https://ai.google.dev/gemini-api/docs/pricing",
        "",
        "## Scenario outcomes",
        "",
    ]
    results_by_id = {result.item_id: result for result in summary.item_results}
    for item, output in zip(dataset.items, outputs, strict=True):
        result = results_by_id[output.item_id]
        lines.append(
            f"- `{item.item_id}` ({', '.join(item.tags)}): {result.status}; "
            f"overall `{output.overall_status}`; cold {output.latency_ms:.1f} ms; "
            f"cached {output.cached_latency_ms or 0:.1f} ms; "
            f"provider calls cold/cached {output.provider_calls}/{output.cached_provider_calls}; "
            f"provider attempts {output.provider_attempts}."
        )

    content = "\n".join(lines) + "\n"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    return output_path
