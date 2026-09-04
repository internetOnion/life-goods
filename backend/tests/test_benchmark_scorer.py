from lifegoods.translation.benchmark.candidate import (
    CandidateOutput,
    OfflineMockCandidateRunner,
    get_candidate_config,
)
from lifegoods.translation.benchmark.dataset import load_benchmark_dataset
from lifegoods.translation.benchmark.scorer import (
    BenchmarkEvaluationSummary,
    ItemEvaluationResult,
    evaluate_candidate_output,
    run_and_evaluate_benchmark,
)


def test_evaluate_candidate_output_success() -> None:
    dataset = load_benchmark_dataset("v1")
    config = get_candidate_config("gemini-3.8-flash")
    runner = OfflineMockCandidateRunner(config)

    item = dataset.items[0]
    output = runner.run_item(item)
    eval_res = evaluate_candidate_output(item, output)

    assert isinstance(eval_res, ItemEvaluationResult)
    assert eval_res.item_id == item.item_id
    assert eval_res.schema_valid is True
    assert eval_res.token_preservation_valid is True
    assert eval_res.placeholder_integrity_valid is True
    assert eval_res.khmer_script_valid is True
    assert eval_res.latency_within_budget is True
    assert eval_res.status == "pass"
    assert len(eval_res.issues) == 0


def test_evaluate_candidate_output_detects_token_corruption_and_lingering_placeholders() -> None:
    dataset = load_benchmark_dataset("v1")
    item = dataset.items[0]

    # Simulating corrupted output where placeholder is not restored and tokens dropped
    corrupted_output = CandidateOutput(
        item_id=item.item_id,
        candidate_name="test-candidate",
        translations={"product_name": "Broken __LG_TOK_0__ translation"},
        masked_translations={"product_name": "Broken __LG_TOK_0__ translation"},
        token_maps={"product_name": {"__LG_TOK_0__": "Galaxy"}},
        raw_response="{}",
        latency_ms=100.0,
        status="success",
    )

    eval_res = evaluate_candidate_output(item, corrupted_output)
    assert eval_res.status == "fail"
    assert eval_res.placeholder_integrity_valid is False
    assert eval_res.token_preservation_valid is False
    assert any("placeholder" in issue.lower() for issue in eval_res.issues)


def test_evaluate_candidate_output_detects_budget_timeout() -> None:
    dataset = load_benchmark_dataset("v1")
    item = dataset.items[0]

    slow_output = CandidateOutput(
        item_id=item.item_id,
        candidate_name="test-candidate",
        translations={},
        latency_ms=4500.0,  # exceeds 4000ms budget
        status="success",
    )

    eval_res = evaluate_candidate_output(item, slow_output)
    assert eval_res.latency_within_budget is False
    assert any("4000" in issue for issue in eval_res.issues)


def test_evaluate_candidate_output_rejects_non_provider_translations() -> None:
    dataset = load_benchmark_dataset("v1")
    # Item 8 has source-provided Khmer and must not have provider translation
    item = next(it for it in dataset.items if it.item_id == "bm_km_local_08")

    invalid_invoked_output = CandidateOutput(
        item_id=item.item_id,
        candidate_name="test-candidate",
        translations={"product_name": "ទឹកខ្ទិះដូង"},
        input_tokens=100,  # Should be 0 for all-Khmer record
        status="success",
    )

    eval_res = evaluate_candidate_output(item, invalid_invoked_output)
    assert eval_res.status == "fail"
    assert eval_res.schema_valid is False
    assert any("must not invoke provider translation" in issue for issue in eval_res.issues)
    assert any("only non-provider fields but consumed" in issue for issue in eval_res.issues)


def test_aggregate_evaluation_summary() -> None:
    dataset = load_benchmark_dataset("v1")
    config = get_candidate_config("gemini-3.8-flash")
    runner = OfflineMockCandidateRunner(config)

    _outputs, summary = run_and_evaluate_benchmark(runner, dataset)
    assert isinstance(summary, BenchmarkEvaluationSummary)
    assert summary.candidate_name == config.name
    assert summary.benchmark_version == dataset.version
    assert summary.total_items == len(dataset.items)
    assert summary.pass_rate > 0.8
    assert summary.four_second_budget_rate == 1.0
    assert summary.total_estimated_cost_usd > 0
