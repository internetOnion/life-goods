from __future__ import annotations

import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from lifegoods.translation.benchmark.candidate import CandidateOutput
from lifegoods.translation.benchmark.dataset import BenchmarkDataset
from lifegoods.translation.benchmark.scorer import BenchmarkEvaluationSummary

DISCLAIMER_NOTICE = (
    "> [!IMPORTANT]\n"
    "> **Life Goods Packaged-Food Khmer Translation Benchmark Review Packet**\n"
    "> Machine-generated benchmark evaluation for candidate model selection and "
    "go/no-go thresholds. Candidate approval establishes the exact provider model and "
    "translation-configuration version; it does NOT claim, represent, or imply that "
    "individual live Product translations are human-reviewed, verified, or endorsed label text.\n"
)


def export_summary_json(
    summary: BenchmarkEvaluationSummary,
    output_path: Path,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = asdict(summary)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return output_path


def export_review_packet(
    summary: BenchmarkEvaluationSummary,
    dataset: BenchmarkDataset,
    outputs: list[CandidateOutput],
    output_path: Path,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    outputs_by_id = {o.item_id: o for o in outputs}
    results_by_id = {r.item_id: r for r in summary.item_results}

    now_iso = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines: list[str] = [
        "# Packaged-Food Khmer Translation Benchmark: Review Packet",
        "",
        DISCLAIMER_NOTICE,
        f"**Generated:** {now_iso}  ",
        f"**Candidate Model:** `{summary.candidate_name}`  ",
        f"**Benchmark Dataset Version:** `{summary.benchmark_version}`  ",
        "",
        "## Quantitative Evaluation Summary",
        "",
        "| Metric | Result | Target Gate |",
        "| :--- | :--- | :--- |",
        f"| **Total Benchmark Items** | {summary.total_items} | All items evaluated |",
        f"| **Overall Pass Rate** | {summary.pass_rate * 100:.1f}% "
        f"({summary.passed_items}/{summary.total_items}) | >= 90.0% |",
        f"| **Schema & Completeness Validity** | {summary.schema_validity_rate * 100:.1f}% "
        "| 100.0% |",
        f"| **Protected Token Preservation** | {summary.token_preservation_rate * 100:.1f}% "
        "| 100.0% |",
        f"| **Placeholder Integrity** | {summary.placeholder_integrity_rate * 100:.1f}% "
        "| 100.0% |",
        f"| **Khmer Script Validity** | {summary.khmer_script_validity_rate * 100:.1f}% "
        "| 100.0% |",
        f"| **4-Second Budget Adherence** | {summary.four_second_budget_rate * 100:.1f}% "
        "| 100.0% |",
        f"| **Average Latency** | {summary.avg_latency_ms:.1f} ms | < 2000 ms |",
        f"| **Total Estimated Cost** | ${summary.total_estimated_cost_usd:.6f} USD "
        "| < $0.05 / run |",
        "",
        "## Human Decision Review Checklist (Issue #86)",
        "",
        "Fluent Khmer reviewer verification checklist:",
        "- [ ] Khmer meaning is faithful across English, French, Thai, Vietnamese, "
        "mixed, and unknown-language inputs.",
        "- [ ] Khmer wording is natural and useful to a Shopper in Cambodia.",
        "- [ ] Product and brand names remain in their intended original form.",
        "- [ ] E-numbers, INS codes, numerical tokens, decimal separators, percentages, "
        "quantities, and units remain exact.",
        "- [ ] Ingredient list structure remains understandable and complete.",
        "- [ ] Missing data is not turned into an assertion.",
        "- [ ] Source-provided Khmer is not mislabeled as machine-generated.",
        "- [ ] The exact provider and stable model are approved; no moving alias is used.",
        "- [ ] Cold-generation completion, validation, provider-error, latency, and "
        "estimated-cost thresholds are accepted.",
        "- [ ] Rollback triggers are accepted.",
        "",
        "---",
        "",
        "## Benchmark Test Cases & Candidate Translations",
        "",
    ]

    for item in dataset.items:
        out = outputs_by_id.get(item.item_id)
        res = results_by_id.get(item.item_id)

        status_badge = "✅ PASS" if res and res.status == "pass" else "❌ FAIL"
        tags_str = ", ".join(f"`{t}`" for t in item.tags)
        brands_str = ", ".join(f"`{b}`" for b in item.brands) if item.brands else "_None_"
        lines.extend(
            [
                f"### `{item.item_id}`: {item.title}",
                f"- **Status**: {status_badge}",
                f"- **Source Language**: `{item.language or 'unknown'}`",
                f"- **Tags**: {tags_str}",
                f"- **Brands**: {brands_str}",
            ]
        )

        if out:
            lines.append(
                f"- **Latency**: {out.latency_ms:.1f} ms | "
                f"**Tokens**: in={out.input_tokens}, out={out.output_tokens} | "
                f"**Cost**: ${out.estimated_cost_usd:.6f}"
            )

        if res and res.issues:
            lines.extend(
                ["- **Issues Identified**:", *(f"  - ⚠️ {issue}" for issue in res.issues)]
            )

        lines.extend(
            [
                "",
                "| Field | Status | Original Text | Khmer Translation | Protected Tokens |",
                "| :--- | :--- | :--- | :--- | :--- |",
            ]
        )

        for f in item.fields:
            orig = (
                (f.original_text or "_Source Data Unavailable_")
                .replace("|", "\\|")
                .replace("\n", " ")
            )
            status = f"`{f.expected_status}`"
            toks = (
                ", ".join(f"`{t}`" for t in f.protected_tokens) if f.protected_tokens else "_None_"
            )

            if f.expected_status == "source_khmer_available":
                trans = "_[Bypassed: Source-provided Khmer]_"
            elif f.expected_status == "source_data_unavailable":
                trans = "_[Source Data Unavailable]_"
            else:
                raw_trans = (
                    out.translations.get(f.field_name, "_[Missing]_") if out else "_[Missing]_"
                )
                trans = raw_trans.replace("|", "\\|").replace("\n", " ")

            lines.append(f"| `{f.field_name}` | {status} | {orig} | {trans} | {toks} |")

        lines.extend(["", "---", ""])

    content = "\n".join(lines) + "\n"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    return output_path
