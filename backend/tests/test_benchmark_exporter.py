from pathlib import Path

from lifegoods.translation.benchmark.candidate import (
    OfflineMockCandidateRunner,
    get_candidate_config,
)
from lifegoods.translation.benchmark.dataset import load_benchmark_dataset
from lifegoods.translation.benchmark.exporter import (
    export_review_packet,
    export_summary_json,
)
from lifegoods.translation.benchmark.scorer import run_and_evaluate_benchmark


def test_export_summary_json(tmp_path: Path) -> None:
    dataset = load_benchmark_dataset("v1")
    config = get_candidate_config("gemini-3.8-flash")
    runner = OfflineMockCandidateRunner(config)
    _outputs, summary = run_and_evaluate_benchmark(runner, dataset)

    json_path = tmp_path / "summary.json"
    exported_path = export_summary_json(summary, json_path)

    assert exported_path.is_file()
    content = exported_path.read_text(encoding="utf-8")
    assert '"candidate_name": "gemini-3.8-flash"' in content
    assert '"pass_rate":' in content
    assert '"barcode"' not in content.lower()


def test_export_review_packet_markdown(tmp_path: Path) -> None:
    dataset = load_benchmark_dataset("v1")
    config = get_candidate_config("gemini-3.8-flash")
    runner = OfflineMockCandidateRunner(config)
    outputs, summary = run_and_evaluate_benchmark(runner, dataset)

    md_path = tmp_path / "review_packet.md"
    exported_path = export_review_packet(summary, dataset, outputs, md_path)

    assert exported_path.is_file()
    content = exported_path.read_text(encoding="utf-8")
    # Must include required Product boundary disclaimer
    assert (
        "does NOT claim, represent, or imply that individual live "
        "Product translations are human-reviewed" in content
    )
    # Must include quantitative thresholds and metrics
    assert "gemini-3.8-flash" in content
    assert "Pass Rate" in content
    assert "Average Latency" in content
    assert "Estimated Cost" in content
    # Must include human review checklist
    assert "Khmer meaning is faithful" in content
    assert "Product and brand names remain in their intended original form" in content
    # Must be sanitized (no barcode or shopper data)
    assert "barcode" not in content.lower()
