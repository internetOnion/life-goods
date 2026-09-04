from pathlib import Path

from lifegoods.translation.benchmark.cli import run_benchmark_cli


def test_run_benchmark_cli_offline(tmp_path: Path) -> None:
    output_dir = tmp_path / "results"
    exit_code = run_benchmark_cli(
        [
            "run",
            "--candidate",
            "gemini-2.5-flash",
            "--mode",
            "offline",
            "--output-dir",
            str(output_dir),
        ]
    )
    assert exit_code == 0
    assert (output_dir / "summary.json").is_file()
    assert (output_dir / "review_packet.md").is_file()


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
