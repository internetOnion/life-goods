from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Sequence
from pathlib import Path

from lifegoods.translation.benchmark.candidate import (
    CandidateRunner,
    GeminiLiveCandidateRunner,
    OfflineMockCandidateRunner,
    get_candidate_config,
)
from lifegoods.translation.benchmark.dataset import load_benchmark_dataset
from lifegoods.translation.benchmark.exporter import export_review_packet, export_summary_json
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
        help="Stable candidate model name (e.g. gemini-3.8-flash, gemini-2.5-flash)",
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
        "--api-key",
        type=str,
        default=None,
        help="Google Gemini API key (defaults to GEMINI_API_KEY environment variable)",
    )
    run_parser.add_argument(
        "--output-dir",
        type=str,
        default="docs/research/translation-benchmark",
        help="Directory to write summary.json and review_packet.md",
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
            api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
            if not api_key:
                sys.stderr.write(
                    "Error: GEMINI_API_KEY environment variable or --api-key argument "
                    "is required for live mode.\n"
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

        out_path = Path(args.output_dir)
        summary_file = out_path / "summary.json"
        packet_file = out_path / "review_packet.md"

        export_summary_json(summary, summary_file)
        export_review_packet(summary, dataset, outputs, packet_file)

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
        print(f"Budget (<=4s) Adherence: {summary.four_second_budget_rate * 100:.1f}%")
        print(
            f"Avg Latency: {summary.avg_latency_ms:.1f} ms (P95: {summary.p95_latency_ms:.1f} ms)"
        )
        print(f"Estimated Cost: ${summary.total_estimated_cost_usd:.6f} USD")
        print("\nArtifacts exported to:")
        print(f"  - {summary_file}")
        print(f"  - {packet_file}")

        return 0

    return 0


if __name__ == "__main__":
    sys.exit(run_benchmark_cli())
