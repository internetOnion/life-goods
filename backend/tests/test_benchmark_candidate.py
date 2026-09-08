import pytest

from lifegoods.translation.benchmark.candidate import (
    CANDIDATE_CONFIGS,
    CandidateModelConfig,
    CandidateOutput,
    OfflineMockCandidateRunner,
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
    config_38 = get_candidate_config("gemini-3.8-flash")
    assert isinstance(config_38, CandidateModelConfig)
    assert config_38.model_id == "gemini-3.8-flash"
    assert config_38.temperature == 0.0
    assert config_38.input_cost_per_1m == 0.75
    assert config_38.output_cost_per_1m == 3.75

    with pytest.raises(KeyError, match="Unknown candidate model"):
        get_candidate_config("gemini-2.5-flash")


def test_offline_mock_candidate_runner() -> None:
    dataset = load_benchmark_dataset("v1")
    config = get_candidate_config("gemini-3.8-flash")
    runner = OfflineMockCandidateRunner(config)

    item = dataset.items[0]
    output = runner.run_item(item)
    assert isinstance(output, CandidateOutput)
    assert output.item_id == item.item_id
    assert output.status == "success"
    assert output.latency_ms > 0
    assert output.measurement_mode == "offline"
    assert output.input_tokens is None
    assert output.output_tokens is None
    assert output.thinking_tokens is None
    assert output.estimated_cost_usd is None
    assert output.provider_calls == 1
    assert output.cached_provider_calls == 0
    assert output.cached_latency_ms is not None
    assert len(output.translations) > 0


def test_offline_runner_exercises_expanded_production_payload() -> None:
    dataset = load_benchmark_dataset("v1")
    config = get_candidate_config("gemini-3.8-flash")
    runner = OfflineMockCandidateRunner(config)

    item = dataset.items[0].model_copy(
        update={
            "source_record": {
                "storage_conditions_en": "Keep chilled at 4°C",
                "packaging_text_en": "PET 1 bottle",
                "recycling_instructions_en": "Remove the cap",
                "categories_tags": ["en:snacks"],
                "labels_tags": ["en:organic"],
                "countries_tags": ["en:cambodia"],
            }
        }
    )

    output = runner.run_item(item)

    assert output.overall_status == "complete"
    assert output.field_statuses["storage_instruction_0"] == "generated"
    assert output.field_statuses["packaging_description_0"] == "generated"
    assert output.field_statuses["recycling_instruction_0"] == "generated"
    assert any(name.startswith("category_") for name in output.field_statuses)
    assert output.taxonomy_reference_counts == {
        "categories": 1,
        "additives": 0,
        "labels": 1,
        "countries": 1,
        "packaging_materials": 0,
        "packaging_shapes": 0,
        "packaging_recycling_terms": 0,
    }
