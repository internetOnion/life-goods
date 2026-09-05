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
            language="kh",
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
        ("ក្រែមហាសែលណាត់", "kh"),
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
    assert product.source.data_quality_warnings == [
        "nutrition value very high for category"
    ]


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
        product.ingredients_text.selected_original_text.value
        == "Cocoa mass, sugar, cocoa butter"
    )

    # 4. Categories
    assert product.categories_text.translation_status == "not_requested"
    assert product.categories_text.khmer_translation is None
    assert product.categories_text.selected_original_text is not None
    assert "Chocolate" in product.categories_text.selected_original_text.value
