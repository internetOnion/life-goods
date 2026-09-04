import pytest

from lifegoods.translation.benchmark.candidate import (
    CANDIDATE_CONFIGS,
    CandidateModelConfig,
    CandidateOutput,
    OfflineMockCandidateRunner,
    build_candidate_prompt,
    get_candidate_config,
)
from lifegoods.translation.benchmark.dataset import load_benchmark_dataset


def test_candidate_configs_rejects_moving_alias_and_deprecated_models() -> None:
    # Ensure no moving 'latest' or rejected 'gemini-2.0-flash'
    for name, config in CANDIDATE_CONFIGS.items():
        assert "latest" not in name.lower()
        assert "latest" not in config.model_id.lower()
        assert "gemini-2.0-flash" not in config.model_id.lower()

    with pytest.raises(ValueError, match="not approved or contains a moving alias"):
        get_candidate_config("gemini-latest")

    with pytest.raises(ValueError, match="rejected"):
        get_candidate_config("gemini-2.0-flash")


def test_get_valid_candidate_config() -> None:
    config = get_candidate_config("gemini-2.5-flash")
    assert isinstance(config, CandidateModelConfig)
    assert config.model_id == "gemini-2.5-flash"
    assert config.temperature == 0.0
    assert config.input_cost_per_1m > 0
    assert config.output_cost_per_1m > 0


def test_build_candidate_prompt_skips_khmer_and_unavailable_fields() -> None:
    dataset = load_benchmark_dataset("v1")
    # Item 8 is source-provided Khmer
    item_km = next(it for it in dataset.items if it.item_id == "bm_km_local_08")
    prompt_km = build_candidate_prompt(item_km)
    # Since all fields are source Khmer, no fields should be included for translation
    assert len(prompt_km["fields_to_translate"]) == 0

    # Item 9 is sparse missing fields
    item_sparse = next(it for it in dataset.items if it.item_id == "bm_sparse_salt_09")
    prompt_sparse = build_candidate_prompt(item_sparse)
    # Only product_name and categories should be translated;
    # generic_name and ingredients_text are missing
    field_names = [f["field_name"] for f in prompt_sparse["fields_to_translate"]]
    assert "generic_name" not in field_names
    assert "ingredients_text" not in field_names
    assert "product_name" in field_names


def test_offline_mock_candidate_runner() -> None:
    dataset = load_benchmark_dataset("v1")
    config = get_candidate_config("gemini-2.5-flash")
    runner = OfflineMockCandidateRunner(config)

    item = dataset.items[0]
    output = runner.run_item(item)
    assert isinstance(output, CandidateOutput)
    assert output.item_id == item.item_id
    assert output.status == "success"
    assert output.latency_ms > 0
    assert output.input_tokens > 0
    assert output.output_tokens > 0
    assert output.estimated_cost_usd > 0
    assert len(output.translations) > 0
