from lifegoods.translation.chunking import chunk_ingredients, join_ingredient_chunks


def test_chunk_ingredients_preserves_nested_brackets_and_delimiters() -> None:
    text = (
        "Whole wheat (42.0%), oat flakes (15.5%), sultanas (10.0%) [sultanas, cottonseed oil], "
        "dried sweetened cranberries (6.0%) [cranberries, sugar, sunflower oil], "
        "toasted sunflower seeds (4.0%), pumpkin seeds (3.0%), salt, vitamins (B1, B2, B6, B12)."
    )

    chunks = chunk_ingredients(text, max_chunk_chars=120)

    assert len(chunks) > 1

    # Verify no chunk splits inside [sultanas, cottonseed oil]
    for chunk in chunks:
        open_sq = chunk.count("[")
        close_sq = chunk.count("]")
        assert open_sq == close_sq, f"Bracket split in chunk: {chunk}"

        open_paren = chunk.count("(")
        close_paren = chunk.count(")")
        assert open_paren == close_paren, f"Paren split in chunk: {chunk}"

    # Rejoining preserves all items
    rejoined = join_ingredient_chunks(chunks)
    assert "vitamins (B1, B2, B6, B12)" in rejoined


def test_module_chunks_long_ingredients_deterministically() -> None:
    from lifegoods.product_lookup.contracts import (
        EnvironmentProjection,
        NutritionProjection,
        OriginalText,
        PackagingProjection,
        ProductIdentityProjection,
        ProductProjection,
        SourceAssessmentsProjection,
        SourceRecordMetadataProjection,
    )
    from lifegoods.translation.contracts import (
        TranslationFieldStatus,
        TranslationOverallStatus,
    )
    from lifegoods.translation.module import KhmerTranslationModule
    from lifegoods.translation.provider import FakeTranslationProvider

    product = ProductProjection(
        identity=ProductIdentityProjection(
            names=[OriginalText(value="Cereal", language="en", source_field="product_name")],
        ),
        front_image=None,
        ingredients=[
            OriginalText(
                value=(
                    "Whole wheat (42.0%), oat flakes (15.5%), "
                    "sultanas (10.0%) [sultanas, cottonseed oil], "
                    "dried sweetened cranberries (6.0%) [cranberries, sugar, sunflower oil], "
                    "toasted sunflower seeds (4.0%), pumpkin seeds (3.0%), salt, "
                    "vitamins (B1, B2, B6, B12)."
                ),
                language="en",
                source_field="ingredients_text_en",
            )
        ],
        additives=[],
        storage_instructions=[],
        nutrition=NutritionProjection(),
        assessments=SourceAssessmentsProjection(),
        categories=[],
        labels=[],
        countries=[],
        packaging=PackagingProjection(),
        environment=EnvironmentProjection(),
        source=SourceRecordMetadataProjection(),
    )

    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "ធញ្ញជាតិ",
            "ingredients_text_chunk_0": "ស្រូវសាលី (__LG_TOK_0__), ស្រូវអូត (__LG_TOK_1__), "
            "ទំពាំងបាយជូរក្រៀម (__LG_TOK_2__) [ទំពាំងបាយជូរក្រៀម, ប្រេងគ្រាប់កប្បាស],",
            "ingredients_text_chunk_1": "ផ្លែឈើក្រៀម (__LG_TOK_0__) [ផ្លែឈើ, ស្ករ, ប្រេងផ្កាឈូករ័ត្ន], "
            "គ្រាប់ផ្កាឈូករ័ត្ន (__LG_TOK_1__)",
            "ingredients_text_chunk_2": "គ្រាប់ល្ពៅ (__LG_TOK_0__), អំបិល, វីតាមីន (B1, B2, B6, B12).",
        }
    )
    # Configure module with low max_ingredient_chunk_chars to force chunking
    module = KhmerTranslationModule(provider=provider, max_ingredient_chunk_chars=120)

    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.COMPLETE
    assert result.fields["ingredients_text"].status == TranslationFieldStatus.GENERATED
    assert "B1" in (result.fields["ingredients_text"].khmer_translation or "")
    assert "B12" in (result.fields["ingredients_text"].khmer_translation or "")
