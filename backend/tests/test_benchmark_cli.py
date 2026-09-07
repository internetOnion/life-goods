from pathlib import Path

from lifegoods.translation.benchmark.cli import run_benchmark_cli


def test_run_benchmark_cli_offline(tmp_path: Path) -> None:
    output_dir = tmp_path / "results"
    # Test default candidate (gemini-3.8-flash)
    exit_code = run_benchmark_cli(
        [
            "run",
            "--mode",
            "offline",
            "--output-dir",
            str(output_dir),
        ]
    )
    assert exit_code == 0
    assert (output_dir / "summary.json").is_file()
    assert (output_dir / "measurements.json").is_file()
    assert (output_dir / "evaluation_report.md").is_file()
    assert not (output_dir / "review_packet.md").exists()
    summary_content = (output_dir / "summary.json").read_text(encoding="utf-8")
    assert '"candidate_name": "gemini-3.8-flash"' in summary_content
    assert '"measurement_mode": "offline"' in summary_content
    assert '"total_input_tokens": null' in summary_content
    assert '"total_estimated_cost_usd": null' in summary_content
    measurements = (output_dir / "measurements.json").read_text(encoding="utf-8")
    assert '"fixture_id": "bm_en_choc_01"' in measurements
    assert '"raw_response"' not in measurements
    assert '"translations"' not in measurements


def test_run_benchmark_cli_rejects_invalid_candidate(tmp_path: Path) -> None:
    output_dir = tmp_path / "results"
    exit_code = run_benchmark_cli(
        [
            "run",
            "--candidate",
            "gemini-latest",
            "--mode",
            "offline",
            "--output-dir",
            str(output_dir),
        ]
    )
    assert exit_code != 0
