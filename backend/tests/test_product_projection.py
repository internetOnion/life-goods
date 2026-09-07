from datetime import UTC, datetime

from lifegoods.product_lookup import (
    DatasetSnapshotResponse,
    GradedSourceAssessment,
    NovaSourceAssessment,
    NutritionRow,
    OriginalText,
    PackagingComponent,
    ProductLookupMetadataResponse,
    ProductLookupMetaResponse,
    SourceAttributionResponse,
    SourceImage,
)
from lifegoods.product_lookup.projection import project_source_record

META = ProductLookupMetaResponse(
    lookup=ProductLookupMetadataResponse(barcode="4006381333931"),
    source=SourceAttributionResponse(
        name="Open Food Facts",
        product_url="https://world.openfoodfacts.org/product/4006381333931",
    ),
    dataset=DatasetSnapshotResponse(
        version="off-2026-08-27",
        retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
    ),
)


def test_projects_complete_source_record_without_inference() -> None:
    complete = {
        "code": "4006381333931",
        "product_name": "Dark Chocolate",
        "product_name_en": "Dark Chocolate",
        "product_name_km": "សូកូឡាខ្មៅ",
        "product_name_th": "ดาร์กช็อกโกแลต",
        "product_name_vi": "Sô-cô-la đen",
        "product_name_zh": "黑巧克力",
        "brands": "Example Foods, Example Brand",
        "quantity": "100 g",
        "selected_images": {
            "front": {
                "display": {
                    "en": "https://images.openfoodfacts.org/front_en.jpg",
                    "km": "https://images.openfoodfacts.org/front_km.jpg",
                },
            },
        },
        "ingredients_text": "Cocoa mass, sugar, cocoa butter",
        "ingredients_text_en": "Cocoa mass, sugar, cocoa butter",
        "ingredients_text_km": "ម៉ាសកាកាវ ស្ករ ប៊ឺកាកាវ",
        "allergens_tags": ["en:milk"],
        "traces_tags": ["en:nuts"],
        "additives_tags": ["en:e322", "en:e330"],
        "labels_tags": ["en:halal", "en:organic"],
        "manufacturing_places": "Cambodia",
        "nutriments": {
            "energy-kcal_100g": 598,
            "fat_100g": 43,
            "nutrition-score-fr_100g": 18,
            "nova-group_100g": 4,
        },
        "nutrition_data_per": "100g",
        "serving_size": "25 g",
        "lang": "en",
        "languages_tags": ["en:english", "en:khmer"],
        "countries_tags": ["en:cambodia", "en:thailand"],
        "last_modified_t": 1787462400,
    }

    product = project_source_record(complete, meta=META)

    assert product.identity.barcode == "4006381333931"
    assert product.identity.preferred_name == OriginalText(
        value="Dark Chocolate",
        language="en",
        source_field="product_name",
    )
    assert product.identity.brands == ["Example Foods", "Example Brand"]
    assert product.identity.quantity == "100 g"
    assert len(product.identity.names) == 5
    assert product.front_image == SourceImage(
        url="https://images.openfoodfacts.org/front_en.jpg",
        language="en",
        source_field="selected_images.front.display.en",
    )
    assert product.ingredients == [
        OriginalText(
            value="Cocoa mass, sugar, cocoa butter",
            language="en",
            source_field="ingredients_text",
        ),
        OriginalText(
            value="ម៉ាសកាកាវ ស្ករ ប៊ឺកាកាវ",
            language="km",
            source_field="ingredients_text_km",
        ),
    ]
    assert product.nutrition.rows[0] == NutritionRow(
        nutrient="energy-kcal",
        label="Energy",
        per_100g=598,
        per_serving=None,
        value=None,
        unit=None,
    )
    assert product.nutrition.rows[1] == NutritionRow(
        nutrient="fat",
        label="Fat",
        per_100g=43,
        per_serving=None,
        value=None,
        unit=None,
    )
    assert product.assessments.nutri_score == GradedSourceAssessment(
        grade=None,
        score=18,
        version=None,
        source_fields=["nutrition-score-fr_100g"],
    )
    assert product.assessments.nova == NovaSourceAssessment(
        group=4,
        source_field="nova-group_100g",
    )
    assert product.labels == ["halal", "organic"]
    assert product.additives == ["e322", "e330"]
    assert not hasattr(product, "allergens")
    assert not hasattr(product, "halal")
    assert product.source.name == "Open Food Facts"
    assert product.source.dataset_version == "off-2026-08-27"
    assert product.source.retrieved_at == "2026-08-27T08:00:00Z"


def test_sparse_source_record_leaves_unavailable_fields_none_or_empty() -> None:
    sparse = {
        "code": "8850000000003",
        "product_name_th": "ขนมตัวอย่าง",
        "brands": "",
        "quantity": None,
        "selected_images": {},
        "ingredients_text": "",
        "labels_tags": [],
        "nutriments": {},
        "languages_tags": ["en:thai"],
        "countries_tags": [],
        "lang": "th",
        "nutriscore_grade": "unknown",
        "environmental_score_grade": "not-applicable",
    }

    product = project_source_record(sparse)

    assert product.identity.preferred_name == OriginalText(
        value="ขนมตัวอย่าง",
        language="th",
        source_field="product_name_th",
    )
    assert product.identity.brands == []
    assert product.identity.quantity is None
    assert product.front_image is None
    assert product.ingredients == []
    assert product.nutrition.rows == []
    assert product.assessments.nutri_score is None
    assert product.assessments.nova is None
    assert product.assessments.green_score is None
    assert product.source.name is None


def test_reads_schema_1004_aggregate_nutrition_without_recalculation() -> None:
    record = {
        "code": "3017620422003",
        "schema_version": 1004,
        "nutrition": {
            "aggregated_set": {
                "per": "100g",
                "nutrients": {
                    "energy-kcal": {
                        "value": 539,
                        "unit": "kcal",
                        "source": "manufacturer",
                    },
                    "fat": {
                        "value": 30.9,
                        "unit": "g",
                        "source": "manufacturer",
                    },
                },
            },
        },
    }

    product = project_source_record(record)

    assert product.nutrition.basis == "100g"
    assert product.nutrition.rows == [
        NutritionRow(
            nutrient="energy-kcal",
            label="Energy",
            per_100g=539,
            unit="kcal",
        ),
        NutritionRow(
            nutrient="fat",
            label="Fat",
            per_100g=30.9,
            unit="g",
        ),
    ]


def test_keeps_multilingual_names_and_ingredients_distinct() -> None:
    multilingual = {
        "code": "3017620422003",
        "lang": "fr",
        "product_name": "Pâte à tartiner",
        "product_name_fr": "Pâte à tartiner",
        "product_name_en": "Hazelnut spread",
        "product_name_km": "ក្រែមហាសែលណាត់",
        "generic_name_fr": "Pâte à tartiner aux noisettes",
        "generic_name_en": "Cocoa and hazelnut spread",
        "ingredients_text_fr": "Sucre, noisettes, cacao",
        "ingredients_text_en": "Sugar, hazelnuts, cocoa",
        "selected_images": {
            "front": {
                "display": {
                    "en": "https://images.openfoodfacts.org/en.jpg",
                    "fr": "https://images.openfoodfacts.org/fr.jpg",
                },
            },
        },
    }

    product = project_source_record(multilingual, meta=META)

    assert [(name.value, name.language) for name in product.identity.names] == [
        ("Pâte à tartiner", "fr"),
        ("Hazelnut spread", "en"),
        ("ក្រែមហាសែលណាត់", "km"),
    ]
    assert len(product.identity.generic_names) == 2
    assert [item.language for item in product.ingredients] == ["fr", "en"]
    assert product.front_image is not None
    assert product.front_image.language == "fr"
    assert product.source.name == "Open Food Facts"


def test_safely_ignores_irregular_json_shapes() -> None:
    irregular = {
        "code": ["not", "a", "Barcode"],
        "lang": {"unexpected": True},
        "product_name": 42,
        "product_name_debug": "must not become Original Text",
        "ingredients_text_en": {"text": "not a string"},
        "selected_images": ["not", "an", "object"],
        "image_front_url": "javascript:alert(1)",
        "brands": ["Valid Brand", 5, None],
        "categories_tags": ["en:snacks", False, {"bad": "value"}],
        "nutriments": ["not", "an", "object"],
        "packagings": [None, "wrong", {"material": ["wrong"]}],
        "ecoscore_grade": {"invalid": True},
        "nova_group": False,
        "completeness": "80%",
        "last_modified_t": "not-a-time",
        "raw_private_field": {"should": "not leak"},
    }

    product = project_source_record(irregular)

    assert product.identity.barcode is None
    assert product.identity.names == []
    assert product.identity.brands == ["Valid Brand"]
    assert product.categories == ["snacks"]
    assert product.front_image is None
    assert product.nutrition.rows == []
    assert product.packaging.components == []
    assert product.assessments.nutri_score is None
    assert product.assessments.nova is None
    assert product.assessments.green_score is None
    assert product.source.last_modified_at is None
    serialized = product.model_dump_json()
    assert "raw_private_field" not in serialized
    assert "should not leak" not in serialized


def test_projects_data_rich_record_directly() -> None:
    data_rich = {
        "code": "737628064502",
        "lang": "en",
        "product_name_en": "Oat drink",
        "generic_name_en": "UHT oat beverage",
        "categories_tags": ["en:plant-based-beverages", "en:oat-drinks"],
        "labels": "No added sugar, Recyclable packaging",
        "countries": "Cambodia, France",
        "packaging_text_en": "Carton with plastic cap",
        "recycling_instructions_to_discard_en": "Flatten and recycle",
        "packaging_materials_tags": ["en:paperboard", "en:plastic"],
        "packaging_shapes_tags": ["en:carton"],
        "packaging_recycling_tags": ["en:recycle"],
        "packagings": [
            {
                "shape": "en:bottle",
                "material": "en:plastic",
                "recycling": "en:recycle",
                "quantity_per_unit": "1 L",
                "weight_measured": "32",
                "number_of_units": 1,
            },
            {
                "shape": "en:bottle",
                "material": "en:plastic",
                "recycling": "en:recycle",
                "quantity_per_unit": "1 L",
                "weight_measured": "32",
                "number_of_units": 1,
            },
        ],
        "origins_tags": ["en:finland"],
        "manufacturing_places": "Phnom Penh",
        "carbon_footprint_100g": 21.5,
        "carbon_footprint_from_known_ingredients_100g": "18.2",
        "nutriments": {
            "energy-kj_100g": 190,
            "energy-kj_unit": "kJ",
            "fat_100g": 1.5,
            "fat_serving": 3.75,
            "fiber_100g": 0,
            "proteins_100g": 1.1,
            "vitamin-b12_100g": 0.00000038,
            "vitamin-b12_unit": "g",
        },
        "nutrition_data_per": "100g",
        "serving_size": "250 ml",
        "nutriscore_grade": "b",
        "nutriscore_score": 2,
        "nutriscore_version": "2023",
        "nova_group": 3,
        "environmental_score_grade": "c",
        "environmental_score_score": 48,
        "environmental_score_version": "2025",
        "creator": "off-contributor",
        "created_t": 1704067200,
        "completeness": 0.82,
        "data_quality_warnings_tags": [
            "en:nutrition-value-very-high-for-category",
        ],
        "images": {"selected": {"front": {"en": {"rev": 7}}}},
    }

    data_rich_meta = ProductLookupMetaResponse(
        lookup=ProductLookupMetadataResponse(barcode="737628064502"),
        source=SourceAttributionResponse(
            name="Open Food Facts",
            product_url="https://world.openfoodfacts.org/product/737628064502",
        ),
        dataset=DatasetSnapshotResponse(
            version="off-2026-08-27",
            retrieved_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
        ),
    )

    product = project_source_record(data_rich, meta=data_rich_meta)

    assert product.categories == ["plant based beverages", "oat drinks"]
    assert product.nutrition.basis == "100g"
    assert product.nutrition.serving_size == "250 ml"
    fat_row = next(r for r in product.nutrition.rows if r.nutrient == "fat")
    assert fat_row.per_100g == 1.5
    assert fat_row.per_serving == 3.75
    fiber_row = next(r for r in product.nutrition.rows if r.nutrient == "fiber")
    assert fiber_row.per_100g == 0
    assert product.assessments.nutri_score == GradedSourceAssessment(
        grade="b",
        score=2,
        version="2023",
        source_fields=[
            "nutriscore_grade",
            "nutriscore_score",
            "nutriscore_version",
        ],
    )
    assert product.assessments.nova == NovaSourceAssessment(
        group=3,
        source_field="nova_group",
    )
    assert product.assessments.green_score == GradedSourceAssessment(
        grade="c",
        score=48,
        version="2025",
        source_fields=[
            "environmental_score_grade",
            "environmental_score_score",
            "environmental_score_version",
        ],
    )
    assert product.packaging.materials == ["paperboard", "plastic"]
    assert product.packaging.shapes == ["carton"]
    assert product.packaging.recycling == ["recycle"]
    assert product.packaging.components == [
        PackagingComponent(
            shape="bottle",
            material="plastic",
            recycling="recycle",
            quantity_per_unit="1 L",
            weight_measured="32",
            number_of_units=1,
        )
    ]
    assert product.environment.origins == ["finland"]
    assert product.environment.manufacturing_places == ["Phnom Penh"]
    assert product.environment.carbon_footprint_100g == 21.5
    assert product.environment.carbon_footprint_from_known_ingredients_100g == "18.2"
    assert product.environment.carbon_footprint_from_meat_or_fish_100g is None
    assert product.front_image == SourceImage(
        url="https://images.openfoodfacts.org/images/products/737/628/064/502/front_en.7.400.jpg",
        language="en",
        source_field="images.selected.front.en.rev",
    )
    assert product.source.creator == "off-contributor"
    assert product.source.created_at == "2024-01-01T00:00:00Z"
    assert product.source.completeness == 0.82
    assert product.source.data_quality_warnings == ["nutrition value very high for category"]


def test_projection_populates_translatable_semantic_fields_with_not_requested_status() -> None:
    complete = {
        "code": "4006381333931",
        "product_name": "Dark Chocolate",
        "product_name_en": "Dark Chocolate",
        "product_name_km": "សូកូឡាខ្មៅ",
        "generic_name": "Chocolate Confectionery",
        "generic_name_en": "Chocolate Confectionery",
        "ingredients_text": "Cocoa mass, sugar, cocoa butter",
        "ingredients_text_en": "Cocoa mass, sugar, cocoa butter",
        "categories": "Chocolate, Snacks",
        "categories_tags": ["en:chocolate", "en:snacks"],
        "lang": "en",
    }

    product = project_source_record(complete, meta=META)

    # 1. Product name
    assert product.identity.name.translation_status == "not_requested"
    assert product.identity.name.khmer_translation is None
    assert product.identity.name.selected_original_text is not None
    assert product.identity.name.selected_original_text.value == "សូកូឡាខ្មៅ"  # source Khmer preferred
    assert len(product.identity.name.original_texts) >= 2

    # 2. Generic name
    assert product.identity.generic_name.translation_status == "not_requested"
    assert product.identity.generic_name.khmer_translation is None
    assert product.identity.generic_name.selected_original_text is not None
    assert product.identity.generic_name.selected_original_text.value == "Chocolate Confectionery"

    # 3. Ingredients text
    assert product.ingredients_text.translation_status == "not_requested"
    assert product.ingredients_text.khmer_translation is None
    assert product.ingredients_text.selected_original_text is not None
    assert (
        product.ingredients_text.selected_original_text.value == "Cocoa mass, sugar, cocoa butter"
    )

    # 4. Categories
    assert product.categories_text.translation_status == "not_requested"
    assert product.categories_text.khmer_translation is None
    assert product.categories_text.selected_original_text is not None
    assert "Chocolate" in product.categories_text.selected_original_text.value


def test_projection_populates_storage_instruction_items_with_grouping_and_deduplication() -> None:
    # 1. Missing storage conditions -> empty items
    empty_record = {"code": "4006381333931"}
    empty_product = project_source_record(empty_record, meta=META)
    assert empty_product.storage_instruction_items == []
    assert empty_product.storage_instructions == []

    # 2. Localized variants of the same statement grouped into one item
    localized_record = {
        "code": "4006381333931",
        "conservation_conditions": "Keep in a cool, dry place",
        "conservation_conditions_en": "Keep in a cool, dry place",
        "conservation_conditions_km": "រក្សាទុកកន្លែងត្រជាក់ និងស្ងួត",
        "conservation_conditions_fr": "Conserver dans un endroit frais et sec",
        "lang": "en",
    }
    localized_product = project_source_record(localized_record, meta=META)
    assert len(localized_product.storage_instruction_items) == 1
    item = localized_product.storage_instruction_items[0]
    assert item.key == "storage_instruction_0"
    assert item.translation_status == "not_requested"
    assert item.khmer_translation is None
    # Source Khmer preferred
    assert item.selected_original_text is not None
    assert item.selected_original_text.value == "រក្សាទុកកន្លែងត្រជាក់ និងស្ងួត"
    assert item.selected_original_text.source_field == "conservation_conditions_km"
    # Legacy field preserved
    assert len(localized_product.storage_instructions) >= 3

    # 3. Distinct statements kept separate
    distinct_record = {
        "code": "4006381333931",
        "conservation_conditions": "Keep in a cool, dry place",
        "storage_conditions": "Refrigerate after opening",
        "lang": "en",
    }
    distinct_product = project_source_record(distinct_record, meta=META)
    assert len(distinct_product.storage_instruction_items) == 2
    assert distinct_product.storage_instruction_items[0].key == "storage_instruction_0"
    assert distinct_product.storage_instruction_items[0].selected_original_text is not None
    assert (
        distinct_product.storage_instruction_items[0].selected_original_text.value
        == "Keep in a cool, dry place"
    )
    assert distinct_product.storage_instruction_items[1].key == "storage_instruction_1"
    assert distinct_product.storage_instruction_items[1].selected_original_text is not None
    assert (
        distinct_product.storage_instruction_items[1].selected_original_text.value
        == "Refrigerate after opening"
    )

    # 4. Exact duplicates across source fields collapsed into one item while retaining provenance
    duplicate_record = {
        "code": "4006381333931",
        "conservation_conditions": "Keep in a cool, dry place",
        "storage_conditions": "Keep in a cool, dry place",
        "lang": "en",
    }
    dup_product = project_source_record(duplicate_record, meta=META)
    assert len(dup_product.storage_instruction_items) == 1
    dup_item = dup_product.storage_instruction_items[0]
    assert dup_item.key == "storage_instruction_0"
    assert dup_item.selected_original_text is not None
    assert dup_item.selected_original_text.value == "Keep in a cool, dry place"
    # Provenance retained from both fields
    source_fields = {t.source_field for t in dup_item.original_texts}
    assert "conservation_conditions" in source_fields
    assert "storage_conditions" in source_fields


def test_projection_populates_category_items_with_item_boundaries_and_provenance() -> None:
    # 1. Missing categories -> empty category_items
    empty_product = project_source_record({}, meta=META)
    assert empty_product.category_items == []
    assert empty_product.categories == []
    assert empty_product.categories_text.original_texts == []

    # 2. Taxonomy-only record -> empty category_items, but legacy categories list preserved
    taxonomy_only_record = {
        "code": "4006381333931",
        "categories_tags": ["en:chocolate", "en:snacks"],
    }
    tax_product = project_source_record(taxonomy_only_record, meta=META)
    assert tax_product.category_items == []
    assert tax_product.categories == ["chocolate", "snacks"]
    assert tax_product.categories_text.original_texts == []

    # 3. Human-readable categories -> ordered items with deterministic keys
    record = {
        "code": "4006381333931",
        "categories": "Chocolate, Snacks",
        "categories_tags": ["en:chocolate", "en:snacks"],
        "lang": "en",
    }
    product = project_source_record(record, meta=META)
    assert len(product.category_items) == 2

    item0 = product.category_items[0]
    assert item0.key == "category_0"
    assert item0.translation_status == "not_requested"
    assert item0.khmer_translation is None
    assert item0.selected_original_text is not None
    assert item0.selected_original_text.value == "Chocolate"
    assert item0.selected_original_text.language == "en"
    assert item0.selected_original_text.source_field == "categories"

    item1 = product.category_items[1]
    assert item1.key == "category_1"
    assert item1.translation_status == "not_requested"
    assert item1.khmer_translation is None
    assert item1.selected_original_text is not None
    assert item1.selected_original_text.value == "Snacks"
    assert item1.selected_original_text.language == "en"
    assert item1.selected_original_text.source_field == "categories"

    # Legacy fields preserved
    assert product.categories == ["Chocolate", "Snacks"]
    assert len(product.categories_text.original_texts) >= 1

    # 4. Punctuation inside items preserved intact
    punct_record = {
        "code": "4006381333931",
        "categories": "Dark Chocolate (70%), Snacks & Confectionery, Ready-to-eat / canned",
        "lang": "en",
    }
    punct_product = project_source_record(punct_record, meta=META)
    assert len(punct_product.category_items) == 3
    assert punct_product.category_items[0].selected_original_text is not None
    assert punct_product.category_items[0].selected_original_text.value == "Dark Chocolate (70%)"
    assert punct_product.category_items[1].selected_original_text is not None
    assert punct_product.category_items[1].selected_original_text.value == "Snacks & Confectionery"
    assert punct_product.category_items[2].selected_original_text is not None
    assert punct_product.category_items[2].selected_original_text.value == "Ready-to-eat / canned"

    # 5. Source Khmer categories
    khmer_record = {
        "code": "4006381333931",
        "categories": "សូកូឡា, អាហារសម្រន់",
        "lang": "km",
    }
    khmer_product = project_source_record(khmer_record, meta=META)
    assert len(khmer_product.category_items) == 2
    assert khmer_product.category_items[0].selected_original_text is not None
    assert khmer_product.category_items[0].selected_original_text.value == "សូកូឡា"
    assert khmer_product.category_items[1].selected_original_text is not None
    assert khmer_product.category_items[1].selected_original_text.value == "អាហារសម្រន់"


def test_category_items_multi_language_extraction_and_exact_duplicate_collapse() -> None:
    record = {
        "code": "4006381333931",
        "categories": "Chocolate, Snacks",
        "categories_en": "Chocolate, Snacks",
        "categories_fr": "Chocolats, Snacks, Biscuits",
        "categories_km": "សូកូឡា",
        "lang": "en",
    }
    product = project_source_record(record, meta=META)

    # 5 distinct items:
    # category_0: "Chocolate" (from categories & categories_en)
    # category_1: "Snacks" (from categories, categories_en & categories_fr - collapsed)
    # category_2: "Chocolats" (from categories_fr - distinct from Chocolate)
    # category_3: "Biscuits" (from categories_fr)
    # category_4: "សូកូឡា" (from categories_km - distinct, no inferred equivalence)
    assert len(product.category_items) == 5

    cat0 = product.category_items[0]
    assert cat0.key == "category_0"
    assert cat0.selected_original_text is not None
    assert cat0.selected_original_text.value == "Chocolate"
    assert len(cat0.original_texts) == 2
    source_fields_0 = {t.source_field for t in cat0.original_texts}
    assert source_fields_0 == {"categories", "categories_en"}

    cat1 = product.category_items[1]
    assert cat1.key == "category_1"
    assert cat1.selected_original_text is not None
    assert cat1.selected_original_text.value == "Snacks"
    assert len(cat1.original_texts) == 3
    source_fields_1 = {t.source_field for t in cat1.original_texts}
    assert source_fields_1 == {"categories", "categories_en", "categories_fr"}

    cat2 = product.category_items[2]
    assert cat2.key == "category_2"
    assert cat2.selected_original_text is not None
    assert cat2.selected_original_text.value == "Chocolats"
    assert cat2.selected_original_text.language == "fr"

    cat3 = product.category_items[3]
    assert cat3.key == "category_3"
    assert cat3.selected_original_text is not None
    assert cat3.selected_original_text.value == "Biscuits"
    assert cat3.selected_original_text.language == "fr"

    cat4 = product.category_items[4]
    assert cat4.key == "category_4"
    assert cat4.selected_original_text is not None
    assert cat4.selected_original_text.value == "សូកូឡា"
    assert cat4.selected_original_text.language == "km"


def test_taxonomy_references_empty_and_default() -> None:
    product = project_source_record({}, meta=META)
    assert hasattr(product, "taxonomy_references")
    tax = product.taxonomy_references
    assert tax.categories == []
    assert tax.additives == []
    assert tax.labels == []
    assert tax.countries == []
    assert tax.packaging_materials == []
    assert tax.packaging_shapes == []
    assert tax.packaging_recycling_terms == []
    assert tax.packaging_recycling == []


def test_taxonomy_references_all_groups_and_namespaces() -> None:
    record = {
        "code": "737628064502",
        "categories_tags": [
            "en:plant-based-beverages",
            "fr:boissons-vegetales",
            "de:pflanzliche-getranke",
        ],
        "additives_tags": ["en:e330", "en:e322"],
        "labels_tags": ["en:organic", "fr:agriculture-biologique", "km:សរីរាង្គ"],
        "countries_tags": ["en:cambodia", "en:france", "th:ประเทศไทย"],
        "packaging_materials_tags": ["en:paperboard", "en:plastic"],
        "packaging_shapes_tags": ["en:carton", "en:bottle"],
        "packaging_recycling_tags": ["en:recycle", "fr:a-recycler"],
    }
    product = project_source_record(record, meta=META)
    tax = product.taxonomy_references

    # Categories
    assert len(tax.categories) == 3
    assert tax.categories[0].id == "en:plant-based-beverages"
    assert tax.categories[0].identifier == "en:plant-based-beverages"
    assert tax.categories[0].source_field == "categories_tags"
    assert tax.categories[1].id == "fr:boissons-vegetales"
    assert tax.categories[1].source_field == "categories_tags"
    assert tax.categories[2].id == "de:pflanzliche-getranke"
    assert tax.categories[2].source_field == "categories_tags"

    # Additives
    assert len(tax.additives) == 2
    assert tax.additives[0].id == "en:e330"
    assert tax.additives[0].source_field == "additives_tags"
    assert tax.additives[1].id == "en:e322"
    assert tax.additives[1].source_field == "additives_tags"

    # Labels
    assert len(tax.labels) == 3
    assert tax.labels[0].id == "en:organic"
    assert tax.labels[0].source_field == "labels_tags"
    assert tax.labels[1].id == "fr:agriculture-biologique"
    assert tax.labels[1].source_field == "labels_tags"
    assert tax.labels[2].id == "km:សរីរាង្គ"
    assert tax.labels[2].source_field == "labels_tags"

    # Countries
    assert len(tax.countries) == 3
    assert tax.countries[0].id == "en:cambodia"
    assert tax.countries[0].source_field == "countries_tags"
    assert tax.countries[1].id == "en:france"
    assert tax.countries[1].source_field == "countries_tags"
    assert tax.countries[2].id == "th:ประเทศไทย"
    assert tax.countries[2].source_field == "countries_tags"

    # Packaging materials
    assert len(tax.packaging_materials) == 2
    assert tax.packaging_materials[0].id == "en:paperboard"
    assert tax.packaging_materials[0].source_field == "packaging_materials_tags"
    assert tax.packaging_materials[1].id == "en:plastic"
    assert tax.packaging_materials[1].source_field == "packaging_materials_tags"

    # Packaging shapes
    assert len(tax.packaging_shapes) == 2
    assert tax.packaging_shapes[0].id == "en:carton"
    assert tax.packaging_shapes[0].source_field == "packaging_shapes_tags"
    assert tax.packaging_shapes[1].id == "en:bottle"
    assert tax.packaging_shapes[1].source_field == "packaging_shapes_tags"

    # Packaging recycling terms
    assert len(tax.packaging_recycling_terms) == 2
    assert tax.packaging_recycling_terms[0].id == "en:recycle"
    assert tax.packaging_recycling_terms[0].source_field == "packaging_recycling_tags"
    assert tax.packaging_recycling_terms[1].id == "fr:a-recycler"
    assert tax.packaging_recycling_terms[1].source_field == "packaging_recycling_tags"
    # Alias
    assert tax.packaging_recycling == tax.packaging_recycling_terms


def test_taxonomy_references_multiple_source_fields_and_deduplication() -> None:
    record = {
        "code": "737628064502",
        # categories: tags has primary, hierarchy adds broader tag and has duplicates
        "categories_tags": ["en:oat-drinks"],
        "categories_hierarchy": ["en:beverages", "en:plant-based-beverages", "en:oat-drinks"],
        # additives: tags and hierarchy and original_tags
        "additives_tags": ["en:e330"],
        "additives_hierarchy": ["en:e330", "en:e322"],
        "additives_original_tags": ["en:e300"],
        # labels: tags and hierarchy
        "labels_tags": ["en:organic"],
        "labels_hierarchy": ["en:organic", "en:fair-trade"],
        # countries: tags and hierarchy
        "countries_tags": ["en:cambodia"],
        "countries_hierarchy": ["en:cambodia", "en:france"],
        # packaging materials: tags + packagings_materials (dict) + packagings list
        "packaging_materials_tags": ["en:paperboard"],
        "packagings_materials": {"en:plastic": 1, "all": 2},
        "packagings": [
            {
                "material": "en:glass",
                "shape": "en:bottle",
                "recycling": "en:recycle-glass",
            },
            {
                "material": "en:paperboard",  # duplicate from packaging_materials_tags
                "shape": "en:box",
                "recycling": "en:recycle",
            },
        ],
        "packaging_shapes_tags": ["en:carton"],
        "packaging_recycling_tags": ["en:recycle"],
    }
    product = project_source_record(record, meta=META)
    tax = product.taxonomy_references

    # Categories: oat-drinks from tags, then beverages and plant-based from hierarchy
    cat_ids = [(r.id, r.source_field) for r in tax.categories]
    assert cat_ids == [
        ("en:oat-drinks", "categories_tags"),
        ("en:beverages", "categories_hierarchy"),
        ("en:plant-based-beverages", "categories_hierarchy"),
    ]

    # Additives: e330 from tags, e322 from hierarchy, e300 from original_tags
    add_ids = [(r.id, r.source_field) for r in tax.additives]
    assert add_ids == [
        ("en:e330", "additives_tags"),
        ("en:e322", "additives_hierarchy"),
        ("en:e300", "additives_original_tags"),
    ]

    # Labels: organic from tags, fair-trade from hierarchy
    lbl_ids = [(r.id, r.source_field) for r in tax.labels]
    assert lbl_ids == [
        ("en:organic", "labels_tags"),
        ("en:fair-trade", "labels_hierarchy"),
    ]

    # Countries: cambodia from tags, france from hierarchy
    cnt_ids = [(r.id, r.source_field) for r in tax.countries]
    assert cnt_ids == [
        ("en:cambodia", "countries_tags"),
        ("en:france", "countries_hierarchy"),
    ]

    # Packaging materials: paperboard from tags, plastic from packagings_materials,
    # and glass from packagings.material
    mat_ids = [(r.id, r.source_field) for r in tax.packaging_materials]
    assert mat_ids == [
        ("en:paperboard", "packaging_materials_tags"),
        ("en:plastic", "packagings_materials"),
        ("en:glass", "packagings.material"),
    ]

    # Packaging shapes: carton from tags, bottle from packagings.shape, box from packagings.shape
    shp_ids = [(r.id, r.source_field) for r in tax.packaging_shapes]
    assert shp_ids == [
        ("en:carton", "packaging_shapes_tags"),
        ("en:bottle", "packagings.shape"),
        ("en:box", "packagings.shape"),
    ]

    # Packaging recycling terms: recycle from tags, recycle-glass from packagings.recycling
    rec_ids = [(r.id, r.source_field) for r in tax.packaging_recycling_terms]
    assert rec_ids == [
        ("en:recycle", "packaging_recycling_tags"),
        ("en:recycle-glass", "packagings.recycling"),
    ]


def test_taxonomy_references_no_slugification_from_display_labels() -> None:
    # A record with human-readable presentation labels but NO taxonomy tags
    record = {
        "code": "1234567890128",
        "categories": "Snacks, Chocolates",
        "labels": "Organic, Fair Trade",
        "countries": "Cambodia, France",
        "additives": "Citric acid",
        "packaging": "Plastic bottle",
    }
    product = project_source_record(record, meta=META)
    tax = product.taxonomy_references

    # Existing fields are populated
    assert product.categories == ["Snacks", "Chocolates"]
    assert product.labels == ["Organic", "Fair Trade"]
    assert product.countries == ["Cambodia", "France"]
    assert product.additives == ["Citric acid"]

    # Taxonomy references are NOT invented by slugifying display labels
    assert tax.categories == []
    assert tax.labels == []
    assert tax.countries == []
    assert tax.additives == []
    assert tax.packaging_materials == []
    assert tax.packaging_shapes == []
    assert tax.packaging_recycling_terms == []


def test_taxonomy_references_taxonomy_only_record() -> None:
    # A record containing ONLY taxonomy tags and no human-readable category strings
    record = {
        "code": "4006381333931",
        "categories_tags": ["en:chocolate", "en:snacks"],
        "labels_tags": ["en:organic"],
    }
    product = project_source_record(record, meta=META)

    # Taxonomy references preserve exact identifiers
    assert len(product.taxonomy_references.categories) == 2
    assert product.taxonomy_references.categories[0].id == "en:chocolate"
    assert product.taxonomy_references.categories[0].source_field == "categories_tags"
    assert product.taxonomy_references.categories[1].id == "en:snacks"
    assert product.taxonomy_references.categories[1].source_field == "categories_tags"

    # Category items remain empty and no original texts for categories_text
    assert product.category_items == []
    assert product.categories_text.original_texts == []
    assert product.categories_text.translation_status == "not_requested"
    assert product.categories == ["chocolate", "snacks"]


def test_taxonomy_references_irregular_and_sparse_records() -> None:
    record = {
        "code": "987654321098",
        # comma-separated string in tags
        "categories_tags": "en:beverages, fr:boissons , , en:sodas",
        # unprefixed identifier and weird casing / whitespace
        "additives_tags": ["  E330  ", "e322", None, ""],
        # packaging with None fields and irregular types
        "packagings": [
            {"material": None, "shape": "en:can", "recycling": ""},
            {"material": "en:aluminium", "shape": "", "recycling": "en:recycle"},
            "not-a-dict",
        ],
    }
    product = project_source_record(record, meta=META)
    tax = product.taxonomy_references

    assert [r.id for r in tax.categories] == ["en:beverages", "fr:boissons", "en:sodas"]
    assert [r.id for r in tax.additives] == ["E330", "e322"]
    assert [r.id for r in tax.packaging_shapes] == ["en:can"]
    assert [r.id for r in tax.packaging_materials] == ["en:aluminium"]
    assert [r.id for r in tax.packaging_recycling_terms] == ["en:recycle"]
