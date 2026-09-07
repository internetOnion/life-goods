from pathlib import Path

from lifegoods.translation.benchmark.candidate import (
    OfflineMockCandidateRunner,
    get_candidate_config,
)
from lifegoods.translation.benchmark.dataset import load_benchmark_dataset
from lifegoods.translation.benchmark.exporter import (
    export_evaluation_report,
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


def test_export_evaluation_report_separates_offline_evidence(tmp_path: Path) -> None:
    dataset = load_benchmark_dataset("v1")
    config = get_candidate_config("gemini-3.8-flash")
    runner = OfflineMockCandidateRunner(config)
    outputs, summary = run_and_evaluate_benchmark(runner, dataset)

    md_path = tmp_path / "evaluation_report.md"
    exported_path = export_evaluation_report(summary, dataset, outputs, md_path)

    assert exported_path.is_file()
    content = exported_path.read_text(encoding="utf-8")
    assert "Deterministic offline verification" in content
    assert "not observed provider performance or charges" in content
    assert "gemini-3.8-flash" in content
    assert "Pass Rate" in content
    assert "Human review is not required" in content
    assert "review checklist" not in content.lower()
    assert "barcode" not in content.lower()
