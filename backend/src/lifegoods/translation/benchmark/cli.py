from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Sequence
from pathlib import Path

from lifegoods.core.settings import Settings
from lifegoods.translation.benchmark.candidate import (
    CandidateRunner,
    GeminiLiveCandidateRunner,
    OfflineMockCandidateRunner,
    get_candidate_config,
)
from lifegoods.translation.benchmark.dataset import load_benchmark_dataset
from lifegoods.translation.benchmark.exporter import (
    export_evaluation_report,
    export_measurements_json,
    export_summary_json,
)
from lifegoods.translation.benchmark.scorer import run_and_evaluate_benchmark


def run_benchmark_cli(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="lifegoods.translation.benchmark.cli",
        description="Life Goods Packaged-Food Khmer Translation Benchmark & Evaluation Harness",
    )
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    run_parser = subparsers.add_parser("run", help="Execute benchmark evaluation")
    run_parser.add_argument(
        "--candidate",
        type=str,
        default="gemini-3.8-flash",
        help="Exact production model name (gemini-3.8-flash)",
    )
    run_parser.add_argument(
        "--version",
        type=str,
        default="v1",
        help="Benchmark dataset version (default: v1)",
    )
    run_parser.add_argument(
        "--mode",
        choices=["offline", "live"],
        default="offline",
        help=(
            "Execution mode: 'offline' uses recorded fixtures for CI; "
            "'live' requires API credentials"
        ),
    )
    run_parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help=(
            "Directory to write artifacts (defaults to the issue-100 directory for the mode)"
        ),
    )

    args = parser.parse_args(argv)

    if args.subcommand == "run":
        try:
            config = get_candidate_config(args.candidate)
        except (ValueError, KeyError) as e:
            sys.stderr.write(f"Error: {e}\n")
            return 1

        try:
            dataset = load_benchmark_dataset(args.version)
        except FileNotFoundError as e:
            sys.stderr.write(f"Error: {e}\n")
            return 1

        runner: CandidateRunner
        if args.mode == "live":
            api_key = os.environ.get("GEMINI_API_KEY") or Settings().gemini_api_key
            if not api_key:
                sys.stderr.write(
                    "Error: GEMINI_API_KEY or LIFEGOODS_GEMINI_API_KEY is required "
                    "for live mode.\n"
                )
                return 1
            runner = GeminiLiveCandidateRunner(config, api_key)
        else:
            runner = OfflineMockCandidateRunner(config)

        print(
            f"Running benchmark '{args.version}' against candidate '{config.name}' "
            f"(mode: {args.mode})..."
        )
        outputs, summary = run_and_evaluate_benchmark(runner, dataset)

        out_path = (
            Path(args.output_dir)
            if args.output_dir
            else Path("docs/research/translation-benchmark/issue-100") / args.mode
        )
        summary_file = out_path / "summary.json"
        measurements_file = out_path / "measurements.json"
        report_file = out_path / "evaluation_report.md"

        export_summary_json(summary, summary_file)
        export_measurements_json(outputs, measurements_file)
        export_evaluation_report(summary, dataset, outputs, report_file)

        print("\n=== Benchmark Evaluation Results ===")
        print(f"Candidate: {summary.candidate_name}")
        print(f"Version: {summary.benchmark_version}")
        print(
            f"Items: {summary.total_items} "
            f"(Passed: {summary.passed_items}, Failed: {summary.failed_items})"
        )
        print(f"Pass Rate: {summary.pass_rate * 100:.1f}%")
        print(f"Schema Validity: {summary.schema_validity_rate * 100:.1f}%")
        print(f"Token Preservation: {summary.token_preservation_rate * 100:.1f}%")
        print(f"Budget (<=12s) Adherence: {summary.twelve_second_budget_rate * 100:.1f}%")
        p95 = f"{summary.p95_latency_ms:.1f} ms" if summary.p95_latency_ms else "not reported"
        print(f"Avg Latency: {summary.avg_latency_ms:.1f} ms (P95: {p95})")
        cost = (
            f"${summary.total_estimated_cost_usd:.6f} USD"
            if summary.total_estimated_cost_usd is not None
            else "unavailable"
        )
        print(f"Estimated Cost: {cost}")
        print("\nArtifacts exported to:")
        print(f"  - {summary_file}")
        print(f"  - {measurements_file}")
        print(f"  - {report_file}")

        return 0

    return 0


if __name__ == "__main__":
    sys.exit(run_benchmark_cli())
