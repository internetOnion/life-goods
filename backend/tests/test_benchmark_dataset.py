from lifegoods.translation.benchmark.dataset import (
    BenchmarkDataset,
    load_benchmark_dataset,
)


def test_load_v1_benchmark_dataset() -> None:
    dataset = load_benchmark_dataset("v1")
    assert isinstance(dataset, BenchmarkDataset)
    assert dataset.version == "v1"
    assert len(dataset.items) > 0


def test_benchmark_dataset_contains_required_languages() -> None:
    dataset = load_benchmark_dataset("v1")
    languages = {item.language for item in dataset.items if item.language is not None}
    assert {"en", "fr", "th", "vi", "zh", "km", "und"}.issubset(languages)


def test_benchmark_dataset_contains_required_fields() -> None:
    dataset = load_benchmark_dataset("v1")
    all_fields: set[str] = set()
    for item in dataset.items:
        for field in item.fields:
            all_fields.add(field.field_name)
    assert {"product_name", "generic_name", "ingredients_text", "categories"}.issubset(all_fields)

    expanded_records = [item.source_record for item in dataset.items if item.source_record]
    assert any("storage_conditions_en" in record for record in expanded_records)
    assert any("packaging_text_en" in record for record in expanded_records)
    assert any("recycling_instructions_en" in record for record in expanded_records)
    assert any("categories_tags" in record for record in expanded_records)


def test_benchmark_dataset_contains_edge_cases() -> None:
    dataset = load_benchmark_dataset("v1")
    tags = {tag for item in dataset.items for tag in item.tags}
    assert "brand" in tags
    assert "e_number" in tags
    assert "units_and_quantities" in tags
    assert "adversarial" in tags
    assert "long_ingredients" in tags
    assert "source_khmer" in tags
    assert "sparse_missing" in tags
    assert "mixed_script" in tags
    assert "irregular" in tags
    assert "brand_only" in tags
    assert "partial" in tags
    assert "unavailable" in tags


def test_benchmark_dataset_is_sanitized_no_barcodes_or_pii() -> None:
    dataset = load_benchmark_dataset("v1")
    for item in dataset.items:
        # IDs must follow benchmark naming convention (e.g. bm_...) and not be raw retail Barcodes
        assert item.item_id.startswith("bm_")
        assert not item.item_id.isdigit()
        # Item representation should not contain retail Barcode patterns or Shopper data
        assert "barcode" not in item.model_dump()
