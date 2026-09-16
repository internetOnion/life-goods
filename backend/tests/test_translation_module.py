from lifegoods.product_lookup.contracts import (
    EnvironmentProjection,
    NutritionProjection,
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
from lifegoods.translation.module import TRANSLATION_CONFIG_VERSION, KhmerTranslationModule
from lifegoods.translation.provider import FakeTranslationProvider


def _empty_product() -> ProductProjection:
    return ProductProjection(
        identity=ProductIdentityProjection(),
        front_image=None,
        ingredients=[],
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


def test_empty_product_returns_source_data_unavailable_without_provider_calls() -> None:
    provider = FakeTranslationProvider()
    module = KhmerTranslationModule(provider=provider)

    result = module.translate_product(_empty_product(), target_language="km")

    assert result.overall_status == TranslationOverallStatus.NOT_NEEDED
    assert provider.call_count == 0

    assert result.fields["product_name"].status == TranslationFieldStatus.SOURCE_DATA_UNAVAILABLE
    assert result.fields["product_name"].khmer_translation is None
    assert result.fields["generic_name"].status == TranslationFieldStatus.SOURCE_DATA_UNAVAILABLE
    assert (
        result.fields["ingredients_text"].status == TranslationFieldStatus.SOURCE_DATA_UNAVAILABLE
    )
    assert result.fields["categories"].status == TranslationFieldStatus.SOURCE_DATA_UNAVAILABLE


def test_source_provided_khmer_bypasses_provider() -> None:
    from lifegoods.product_lookup.contracts import OriginalText

    product = _empty_product()
    product.identity.names = [
        OriginalText(value="ទឹកដោះគោកូនដូង", language="km", source_field="product_name_km"),
        OriginalText(value="Coconut Milk", language="en", source_field="product_name_en"),
    ]
    product.identity.generic_names = [
        OriginalText(value="ទឹកខ្ទិះដូងសុទ្ធ", language="und", source_field="generic_name"),
    ]

    provider = FakeTranslationProvider()
    module = KhmerTranslationModule(provider=provider)

    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.NOT_NEEDED
    assert provider.call_count == 0

    assert result.fields["product_name"].status == TranslationFieldStatus.SOURCE_KHMER_AVAILABLE
    assert result.fields["product_name"].selected_original_text is not None
    assert result.fields["product_name"].selected_original_text.value == "ទឹកដោះគោកូនដូង"
    assert result.fields["product_name"].khmer_translation is None

    assert result.fields["generic_name"].status == TranslationFieldStatus.SOURCE_KHMER_AVAILABLE
    assert result.fields["generic_name"].selected_original_text is not None
    assert result.fields["generic_name"].selected_original_text.value == "ទឹកខ្ទិះដូងសុទ្ធ"
    assert result.fields["generic_name"].khmer_translation is None


def test_translate_fields_with_token_protection_and_restoration() -> None:
    from lifegoods.product_lookup.contracts import OriginalText

    product = _empty_product()
    product.identity.brands = ["Galaxy"]
    product.identity.names = [
        OriginalText(
            value="Galaxy Smooth Milk Chocolate Bar",
            language="en",
            source_field="product_name_en",
        ),
    ]
    product.identity.generic_names = [
        OriginalText(
            value="Milk chocolate with caramel (10%) and sea salt (0.5%)",
            language="en",
            source_field="generic_name_en",
        ),
    ]
    product.ingredients = [
        OriginalText(
            value="Sugar, skimmed milk powder (14%), emulsifier (E322, E476).",
            language="en",
            source_field="ingredients_text_en",
        ),
    ]
    product.categories = ["Snacks", "Chocolates"]
    product.categories_text.original_texts = [
        OriginalText(value="Snacks, Chocolates", language="en", source_field="categories"),
    ]
    from lifegoods.product_lookup.contracts import TranslatableTextItem
    product.category_items = [
        TranslatableTextItem(
            key="category_0",
            original_texts=[
                OriginalText(value="Snacks", language="en", source_field="categories")
            ],
            selected_original_text=OriginalText(
                value="Snacks", language="en", source_field="categories"
            ),
        ),
        TranslatableTextItem(
            key="category_1",
            original_texts=[
                OriginalText(value="Chocolates", language="en", source_field="categories")
            ],
            selected_original_text=OriginalText(
                value="Chocolates", language="en", source_field="categories"
            ),
        ),
    ]

    # Provide canned response that includes the placeholders
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "__LG_TOK_0__ របារសូកូឡាទឹកដោះគោរលោង",
            "generic_name": ("សូកូឡាទឹកដោះគោជាមួយការ៉ាមែល (__LG_TOK_0__) និងអំបិលសមុទ្រ (__LG_TOK_1__)"),
            "ingredients_text": (
                "ស្ករ ម្សៅទឹកដោះគោគ្មានជាតិខ្លាញ់ (__LG_TOK_0__) "
                "សារធាតុ emulsifier (__LG_TOK_1__, __LG_TOK_2__)។"
            ),
            "category_0": "អាហារសម្រន់",
            "category_1": "សូកូឡា",
        }
    )

    module = KhmerTranslationModule(provider=provider)

    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.COMPLETE
    assert provider.call_count == 1
    assert provider.last_request is not None

    # Verify provider received masked placeholders rather than raw brands/numbers
    assert "__LG_TOK_0__" in provider.last_request.fields["product_name"]
    assert "Galaxy" not in provider.last_request.fields["product_name"]
    assert "10%" not in provider.last_request.fields["generic_name"]

    # Verify returned result has tokens restored
    name_outcome = result.fields["product_name"]
    assert name_outcome.status == TranslationFieldStatus.GENERATED
    assert name_outcome.khmer_translation == "Galaxy របារសូកូឡាទឹកដោះគោរលោង"

    generic_outcome = result.fields["generic_name"]
    assert generic_outcome.status == TranslationFieldStatus.GENERATED
    assert "10%" in (generic_outcome.khmer_translation or "")
    assert "0.5%" in (generic_outcome.khmer_translation or "")

    ing_outcome = result.fields["ingredients_text"]
    assert ing_outcome.status == TranslationFieldStatus.GENERATED
    assert "14%" in (ing_outcome.khmer_translation or "")
    assert "E322" in (ing_outcome.khmer_translation or "")
    assert "E476" in (ing_outcome.khmer_translation or "")

    cat_outcome = result.fields["categories"]
    assert cat_outcome.status == TranslationFieldStatus.GENERATED
    assert cat_outcome.khmer_translation == "អាហារសម្រន់, សូកូឡា"

    # Verify hashes and token maps
    assert len(result.content_hash) == 64
    assert len(result.config_fingerprint) == 64
    assert "product_name" in result.token_maps


def test_partial_translation_survives_when_one_field_fails_validation() -> None:
    from lifegoods.product_lookup.contracts import OriginalText

    product = _empty_product()
    product.identity.brands = ["Galaxy"]
    product.identity.names = [
        OriginalText(value="Galaxy Chocolate Bar", language="en", source_field="product_name_en"),
    ]
    product.identity.generic_names = [
        OriginalText(value="Milk chocolate (10%)", language="en", source_field="generic_name_en"),
    ]

    # Canned response: product_name is valid, but generic_name drops placeholder __LG_TOK_0__
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "__LG_TOK_0__ សូកូឡា",
            "generic_name": "សូកូឡាទឹកដោះគោគ្មានភាគរយ",  # dropped __LG_TOK_0__ (10%)
            "unexpected_injected_field": "HACKED",
        }
    )
    module = KhmerTranslationModule(provider=provider)

    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.PARTIAL

    # Valid field survived
    assert result.fields["product_name"].status == TranslationFieldStatus.GENERATED
    assert result.fields["product_name"].khmer_translation == "Galaxy សូកូឡា"

    # Corrupted field failed gracefully
    assert result.fields["generic_name"].status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE
    assert result.fields["generic_name"].khmer_translation is None
    assert "Missing tokens: 10%" in (result.fields["generic_name"].failure_reason or "")

    # Unexpected field was rejected
    assert "unexpected_injected_field" not in result.fields


def test_non_khmer_output_fails_validation() -> None:
    from lifegoods.product_lookup.contracts import OriginalText

    product = _empty_product()
    product.identity.names = [
        OriginalText(value="Chocolate Bar", language="en", source_field="product_name_en"),
    ]

    # Provider responded in English without Khmer script
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "Chocolate Bar English Only",
        }
    )
    module = KhmerTranslationModule(provider=provider)

    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.UNAVAILABLE
    assert result.fields["product_name"].status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE
    assert "Khmer script" in (result.fields["product_name"].failure_reason or "")


def test_brand_only_product_name_preserves_original_text_without_provider_call() -> None:
    from lifegoods.product_lookup.contracts import OriginalText

    product = _empty_product()
    product.identity.brands = ["Coca-Cola"]
    product.identity.names = [
        OriginalText(value="Coca-Cola 330ml", language="en", source_field="product_name_en"),
    ]

    provider = FakeTranslationProvider()
    result = KhmerTranslationModule(provider).translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.NOT_NEEDED
    assert result.fields["product_name"].status == TranslationFieldStatus.ORIGINAL_TEXT_PRESERVED
    assert result.fields["product_name"].khmer_translation is None
    assert provider.call_count == 0


def test_oversized_output_fails_bounds_check() -> None:
    from lifegoods.product_lookup.contracts import OriginalText

    product = _empty_product()
    product.identity.names = [
        OriginalText(value="Snack", language="en", source_field="product_name_en"),
    ]

    # Provider hallucinated a massive repeated string
    huge_text = "អាហារសម្រន់ " * 400
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": huge_text,
        }
    )
    module = KhmerTranslationModule(provider=provider)

    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.UNAVAILABLE
    assert result.fields["product_name"].status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE
    assert "bounds" in (result.fields["product_name"].failure_reason or "").lower()


def test_khmer_translation_module_end_to_end_with_gemini_adapter() -> None:
    import json

    import httpx2 as httpx

    from lifegoods.product_lookup.contracts import (
        OriginalText,
    )
    from lifegoods.translation.gemini import GeminiTranslationAdapter

    product = _empty_product()
    product.identity.barcode = "8850123456789"
    product.identity.brands = ["Oishi"]
    product.identity.names = [
        OriginalText(
            value="Oishi Green Tea 500ml",
            language="en",
            source_field="product_name_en",
        ),
    ]
    product.ingredients = [
        OriginalText(
            value="Green tea 85%, sugar 5%, vitamin C 0.5%.",
            language="en",
            source_field="ingredients_text_en",
        ),
    ]
    product.source.dataset_version = "off-2026-09-01"

    captured_requests: list[httpx.Request] = []

    def handle_request(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        resp_data = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    {
                                        "translations": {
                                            "product_name": "__LG_TOK_0__ តែបៃតង __LG_TOK_1__",
                                            "ingredients_text": (
                                                "តែបៃតង __LG_TOK_0__, ស្ករ __LG_TOK_1__, "
                                                "វីតាមីនសេ __LG_TOK_2__។"
                                            ),
                                        }
                                    },
                                    ensure_ascii=False,
                                )
                            }
                        ]
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 65,
                "candidatesTokenCount": 35,
            },
        }
        return httpx.Response(200, json=resp_data)

    http_client = httpx.Client(transport=httpx.MockTransport(handle_request))
    adapter = GeminiTranslationAdapter(
        api_key="mock-api-key",
        model="gemini-3.8-flash",
        http_client=http_client,
    )

    module = KhmerTranslationModule(provider=adapter)
    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.COMPLETE
    assert result.fields["product_name"].status == TranslationFieldStatus.GENERATED
    assert result.fields["product_name"].khmer_translation == "Oishi តែបៃតង 500ml"

    assert result.fields["ingredients_text"].status == TranslationFieldStatus.GENERATED
    assert "85%" in (result.fields["ingredients_text"].khmer_translation or "")
    assert "0.5%" in (result.fields["ingredients_text"].khmer_translation or "")

    assert result.provenance is not None
    assert result.provenance.provider == "google"
    assert result.provenance.model == "gemini-3.8-flash"
    assert result.provenance.machine_generated is True

    # Critical privacy assertion: Barcode and Dataset Snapshot never passed to provider
    assert len(captured_requests) == 1
    req_body = captured_requests[0].content.decode("utf-8")
    assert "8850123456789" not in req_body
    assert "off-2026-09-01" not in req_body


def test_storage_instruction_items_translation_and_partial_survival() -> None:
    from lifegoods.product_lookup.contracts import OriginalText, StorageInstructionItem

    product = _empty_product()
    product.identity.names = [
        OriginalText(value="Milk", language="en", source_field="product_name_en"),
    ]
    product.storage_instruction_items = [
        StorageInstructionItem(
            key="storage_instruction_0",
            original_texts=[
                OriginalText(
                    value="Keep refrigerated at 4°C",
                    language="en",
                    source_field="conservation_conditions_en",
                ),
            ],
            selected_original_text=OriginalText(
                value="Keep refrigerated at 4°C",
                language="en",
                source_field="conservation_conditions_en",
            ),
        ),
        StorageInstructionItem(
            key="storage_instruction_1",
            original_texts=[
                OriginalText(
                    value="Consume within 3 days",
                    language="en",
                    source_field="storage_conditions_en",
                ),
            ],
            selected_original_text=OriginalText(
                value="Consume within 3 days",
                language="en",
                source_field="storage_conditions_en",
            ),
        ),
    ]

    # Provider translates product_name and storage_instruction_0, but drops storage_instruction_1
    provider = FakeTranslationProvider(
        canned_translations={
            "product_name": "ទឹកដោះគោ",
            "storage_instruction_0": "រក្សាទុកក្នុងទូរទឹកកកនៅសីតុណ្ហភាព __LG_TOK_0__",
        }
    )
    module = KhmerTranslationModule(provider=provider)
    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.PARTIAL

    assert result.fields["product_name"].status == TranslationFieldStatus.GENERATED
    assert result.fields["product_name"].khmer_translation == "ទឹកដោះគោ"

    assert result.fields["storage_instruction_0"].status == TranslationFieldStatus.GENERATED
    assert (
        result.fields["storage_instruction_0"].khmer_translation
        == "រក្សាទុកក្នុងទូរទឹកកកនៅសីតុណ្ហភាព 4°C"
    )

    assert (
        result.fields["storage_instruction_1"].status
        == TranslationFieldStatus.TRANSLATION_UNAVAILABLE
    )
    assert result.fields["storage_instruction_1"].khmer_translation is None


def test_category_items_translated_and_legacy_categories_assembled_on_complete() -> None:
    from lifegoods.product_lookup.contracts import OriginalText, TranslatableTextItem

    product = _empty_product()
    product.category_items = [
        TranslatableTextItem(
            key="category_0",
            original_texts=[
                OriginalText(value="Chocolate", language="en", source_field="categories"),
            ],
            selected_original_text=OriginalText(
                value="Chocolate", language="en", source_field="categories"
            ),
        ),
        TranslatableTextItem(
            key="category_1",
            original_texts=[
                OriginalText(value="Snacks", language="en", source_field="categories"),
            ],
            selected_original_text=OriginalText(
                value="Snacks", language="en", source_field="categories"
            ),
        ),
    ]
    product.categories_text.original_texts = [
        OriginalText(value="Chocolate, Snacks", language="en", source_field="categories"),
    ]

    provider = FakeTranslationProvider(
        canned_translations={
            "category_0": "សូកូឡា",
            "category_1": "អាហារសម្រន់",
        }
    )
    module = KhmerTranslationModule(provider=provider)
    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.COMPLETE
    assert result.fields["category_0"].status == TranslationFieldStatus.GENERATED
    assert result.fields["category_0"].khmer_translation == "សូកូឡា"

    assert result.fields["category_1"].status == TranslationFieldStatus.GENERATED
    assert result.fields["category_1"].khmer_translation == "អាហារសម្រន់"

    # Legacy field assembled
    assert result.fields["categories"].status == TranslationFieldStatus.GENERATED
    assert result.fields["categories"].khmer_translation == "សូកូឡា, អាហារសម្រន់"


def test_category_items_partial_leaves_legacy_categories_unavailable() -> None:
    from lifegoods.product_lookup.contracts import OriginalText, TranslatableTextItem

    product = _empty_product()
    product.category_items = [
        TranslatableTextItem(
            key="category_0",
            original_texts=[
                OriginalText(value="Chocolate", language="en", source_field="categories"),
            ],
            selected_original_text=OriginalText(
                value="Chocolate", language="en", source_field="categories"
            ),
        ),
        TranslatableTextItem(
            key="category_1",
            original_texts=[
                OriginalText(value="Snacks", language="en", source_field="categories"),
            ],
            selected_original_text=OriginalText(
                value="Snacks", language="en", source_field="categories"
            ),
        ),
    ]
    product.categories_text.original_texts = [
        OriginalText(value="Chocolate, Snacks", language="en", source_field="categories"),
    ]

    # Provider translates category_0 but drops category_1
    provider = FakeTranslationProvider(
        canned_translations={
            "category_0": "សូកូឡា",
        }
    )
    module = KhmerTranslationModule(provider=provider)
    result = module.translate_product(product, target_language="km")

    assert result.overall_status == TranslationOverallStatus.PARTIAL
    assert result.fields["category_0"].status == TranslationFieldStatus.GENERATED
    assert result.fields["category_0"].khmer_translation == "សូកូឡា"

    assert result.fields["category_1"].status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE
    assert result.fields["category_1"].khmer_translation is None

    # Legacy field is unavailable because not every required item has usable Khmer text
    assert result.fields["categories"].status == TranslationFieldStatus.TRANSLATION_UNAVAILABLE
    assert result.fields["categories"].khmer_translation is None


def test_configuration_version_v1() -> None:
    module = KhmerTranslationModule(provider=None)
    assert module._config_version == TRANSLATION_CONFIG_VERSION
