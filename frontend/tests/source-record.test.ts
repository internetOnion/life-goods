import { describe, expect, test } from "vitest"

import type {
    ProductLookupMetaResponse,
    ProductLookupResponse,
} from "../src/api/generated"
import { adaptSourceRecord } from "../src/features/product/sourceRecord"

const meta = {
    lookup: { barcode: "4006381333931" },
    source: {
        name: "Open Food Facts",
        product_url: "https://world.openfoodfacts.org/product/4006381333931",
    },
    dataset: {
        version: "off-2026-08-27",
        retrieved_at: "2026-08-27T08:00:00Z",
    },
} satisfies ProductLookupMetaResponse

function response(
    sourceRecord: ProductLookupResponse["data"]["source_record"],
): ProductLookupResponse {
    return { data: { source_record: sourceRecord }, meta }
}

describe("raw Open Food Facts Source Record presentation adapter", () => {
    test("projects a complete Source Record without allergen, safety, or Halal inference", () => {
        const complete = response({
            code: "4006381333931",
            product_name: "Dark Chocolate",
            product_name_en: "Dark Chocolate",
            product_name_km: "សូកូឡាខ្មៅ",
            product_name_th: "ดาร์กช็อกโกแลต",
            product_name_vi: "Sô-cô-la đen",
            product_name_zh: "黑巧克力",
            brands: "Example Foods, Example Brand",
            quantity: "100 g",
            selected_images: {
                front: {
                    display: {
                        en: "https://images.openfoodfacts.org/front_en.jpg",
                        km: "https://images.openfoodfacts.org/front_km.jpg",
                    },
                },
            },
            ingredients_text: "Cocoa mass, sugar, cocoa butter",
            ingredients_text_en: "Cocoa mass, sugar, cocoa butter",
            ingredients_text_km: "ម៉ាសកាកាវ ស្ករ ប៊ឺកាកាវ",
            allergens_tags: ["en:milk"],
            traces_tags: ["en:nuts"],
            additives_tags: ["en:e322", "en:e330"],
            labels_tags: ["en:halal", "en:organic"],
            manufacturing_places: "Cambodia",
            nutriments: {
                "energy-kcal_100g": 598,
                fat_100g: 43,
                "nutrition-score-fr_100g": 18,
                "nova-group_100g": 4,
            },
            nutrition_data_per: "100g",
            serving_size: "25 g",
            lang: "en",
            languages_tags: ["en:english", "en:khmer"],
            countries_tags: ["en:cambodia", "en:thailand"],
            last_modified_t: 1787462400,
        })

        const presentation = adaptSourceRecord(complete)

        expect(presentation.identity).toMatchObject({
            barcode: "4006381333931",
            preferredName: {
                value: "Dark Chocolate",
                language: "en",
                sourceField: "product_name",
            },
            brands: ["Example Foods", "Example Brand"],
            quantity: "100 g",
        })
        expect(presentation.identity.names).toHaveLength(5)
        expect(presentation.frontImage).toEqual({
            url: "https://images.openfoodfacts.org/front_en.jpg",
            language: "en",
            sourceField: "selected_images.front.display.en",
        })
        expect(presentation.ingredients).toEqual([
            {
                value: "Cocoa mass, sugar, cocoa butter",
                language: "en",
                sourceField: "ingredients_text",
            },
            {
                value: "ម៉ាសកាកាវ ស្ករ ប៊ឺកាកាវ",
                language: "km",
                sourceField: "ingredients_text_km",
            },
        ])
        expect(presentation.nutrition.rows).toEqual([
            {
                nutrient: "energy-kcal",
                label: "Energy",
                per100g: 598,
                perServing: undefined,
                value: undefined,
                unit: undefined,
            },
            {
                nutrient: "fat",
                label: "Fat",
                per100g: 43,
                perServing: undefined,
                value: undefined,
                unit: undefined,
            },
        ])
        expect(presentation.assessments).toEqual({
            nutriScore: {
                grade: undefined,
                score: 18,
                version: undefined,
                sourceFields: ["nutrition-score-fr_100g"],
            },
            nova: { group: 4, sourceField: "nova-group_100g" },
        })
        expect(presentation.labels).toEqual(["halal", "organic"])
        expect(presentation.additives).toEqual(["e322", "e330"])
        expect(presentation).not.toHaveProperty("allergens")
        expect(presentation).not.toHaveProperty("halal")
        expect(presentation.source).toMatchObject({
            name: "Open Food Facts",
            datasetVersion: "off-2026-08-27",
            retrievedAt: "2026-08-27T08:00:00Z",
        })
    })

    test("leaves sparse fields empty or undefined for Source Data Unavailable", () => {
        const sparse = {
            code: "8850000000003",
            product_name_th: "ขนมตัวอย่าง",
            brands: "",
            quantity: null,
            selected_images: {},
            ingredients_text: "",
            labels_tags: [],
            nutriments: {},
            languages_tags: ["en:thai"],
            countries_tags: [],
            lang: "th",
            nutriscore_grade: "unknown",
            environmental_score_grade: "not-applicable",
        }

        const presentation = adaptSourceRecord(sparse)

        expect(presentation.identity.preferredName).toEqual({
            value: "ขนมตัวอย่าง",
            language: "th",
            sourceField: "product_name_th",
        })
        expect(presentation.identity.brands).toEqual([])
        expect(presentation.identity.quantity).toBeUndefined()
        expect(presentation.frontImage).toBeUndefined()
        expect(presentation.ingredients).toEqual([])
        expect(presentation.nutrition.rows).toEqual([])
        expect(presentation.assessments).toEqual({})
        expect(presentation.source.name).toBeUndefined()
    })

    test("reads nutrition from the current schema 1004 aggregate without recalculation", () => {
        const presentation = adaptSourceRecord({
            code: "3017620422003",
            schema_version: 1004,
            nutrition: {
                aggregated_set: {
                    per: "100g",
                    nutrients: {
                        "energy-kcal": {
                            value: 539,
                            unit: "kcal",
                            source: "manufacturer",
                        },
                        fat: {
                            value: 30.9,
                            unit: "g",
                            source: "manufacturer",
                        },
                    },
                },
            },
        })

        expect(presentation.nutrition).toMatchObject({
            basis: "100g",
            rows: [
                {
                    nutrient: "energy-kcal",
                    per100g: 539,
                    unit: "kcal",
                },
                { nutrient: "fat", per100g: 30.9, unit: "g" },
            ],
        })
    })

    test("keeps multilingual names and ingredient Original Text distinct", () => {
        const multilingual = {
            code: "3017620422003",
            lang: "fr",
            product_name: "Pâte à tartiner",
            product_name_fr: "Pâte à tartiner",
            product_name_en: "Hazelnut spread",
            product_name_km: "ក្រែមហាសែលណាត់",
            generic_name_fr: "Pâte à tartiner aux noisettes",
            generic_name_en: "Cocoa and hazelnut spread",
            ingredients_text_fr: "Sucre, noisettes, cacao",
            ingredients_text_en: "Sugar, hazelnuts, cocoa",
            selected_images: {
                front: {
                    display: {
                        en: "https://images.openfoodfacts.org/en.jpg",
                        fr: "https://images.openfoodfacts.org/fr.jpg",
                    },
                },
            },
        }

        const presentation = adaptSourceRecord(multilingual, meta)

        expect(
            presentation.identity.names.map(({ value, language }) => ({
                value,
                language,
            })),
        ).toEqual([
            { value: "Pâte à tartiner", language: "fr" },
            { value: "Hazelnut spread", language: "en" },
            { value: "ក្រែមហាសែលណាត់", language: "km" },
        ])
        expect(presentation.identity.genericNames).toHaveLength(2)
        expect(presentation.ingredients.map((item) => item.language)).toEqual([
            "fr",
            "en",
        ])
        expect(presentation.frontImage?.language).toBe("fr")
        expect(presentation.source.name).toBe("Open Food Facts")
    })

    test("safely ignores irregular JsonValue shapes instead of exposing a raw dump", () => {
        const irregular = {
            code: ["not", "a", "Barcode"],
            lang: { unexpected: true },
            product_name: 42,
            product_name_debug: "must not become Original Text",
            ingredients_text_en: { text: "not a string" },
            selected_images: ["not", "an", "object"],
            image_front_url: "javascript:alert(1)",
            brands: ["Valid Brand", 5, null],
            categories_tags: ["en:snacks", false, { bad: "value" }],
            nutriments: ["not", "an", "object"],
            packagings: [null, "wrong", { material: ["wrong"] }],
            ecoscore_grade: { invalid: true },
            nova_group: false,
            completeness: "80%",
            last_modified_t: "not-a-time",
            raw_private_field: { should: "not leak" },
        }

        expect(() => adaptSourceRecord(irregular)).not.toThrow()
        const presentation = adaptSourceRecord(irregular)

        expect(presentation.identity.barcode).toBeUndefined()
        expect(presentation.identity.names).toEqual([])
        expect(presentation.identity.brands).toEqual(["Valid Brand"])
        expect(presentation.categories).toEqual(["snacks"])
        expect(presentation.frontImage).toBeUndefined()
        expect(presentation.nutrition.rows).toEqual([])
        expect(presentation.packaging.components).toEqual([])
        expect(presentation.assessments).toEqual({})
        expect(presentation.source.lastModifiedAt).toBeUndefined()
        expect(JSON.stringify(presentation)).not.toContain("raw_private_field")
        expect(JSON.stringify(presentation)).not.toContain("should not leak")
    })

    test("projects data-rich nutrition, packaging, environment, and Source Assessments directly", () => {
        const dataRich = {
            code: "737628064502",
            lang: "en",
            product_name_en: "Oat drink",
            generic_name_en: "UHT oat beverage",
            categories_tags: ["en:plant-based-beverages", "en:oat-drinks"],
            labels: "No added sugar, Recyclable packaging",
            countries: "Cambodia, France",
            packaging_text_en: "Carton with plastic cap",
            recycling_instructions_to_discard_en: "Flatten and recycle",
            packaging_materials_tags: ["en:paperboard", "en:plastic"],
            packaging_shapes_tags: ["en:carton"],
            packaging_recycling_tags: ["en:recycle"],
            packagings: [
                {
                    shape: "en:bottle",
                    material: "en:plastic",
                    recycling: "en:recycle",
                    quantity_per_unit: "1 L",
                    weight_measured: "32",
                    number_of_units: 1,
                },
                {
                    shape: "en:bottle",
                    material: "en:plastic",
                    recycling: "en:recycle",
                    quantity_per_unit: "1 L",
                    weight_measured: "32",
                    number_of_units: 1,
                },
            ],
            origins_tags: ["en:finland"],
            manufacturing_places: "Phnom Penh",
            carbon_footprint_100g: 21.5,
            carbon_footprint_from_known_ingredients_100g: "18.2",
            nutriments: {
                "energy-kj_100g": 190,
                "energy-kj_unit": "kJ",
                fat_100g: 1.5,
                fat_serving: 3.75,
                fiber_100g: 0,
                proteins_100g: 1.1,
                "vitamin-b12_100g": 0.00000038,
                "vitamin-b12_unit": "g",
            },
            nutrition_data_per: "100g",
            serving_size: "250 ml",
            nutriscore_grade: "b",
            nutriscore_score: 2,
            nutriscore_version: "2023",
            nova_group: 3,
            environmental_score_grade: "c",
            environmental_score_score: 48,
            environmental_score_version: "2025",
            creator: "off-contributor",
            created_t: 1704067200,
            completeness: 0.82,
            data_quality_warnings_tags: [
                "en:nutrition-value-very-high-for-category",
            ],
            images: { selected: { front: { en: { rev: 7 } } } },
        }

        const dataRichMeta = {
            ...meta,
            lookup: { barcode: "737628064502" },
            source: {
                ...meta.source,
                product_url:
                    "https://world.openfoodfacts.org/product/737628064502",
            },
        } satisfies ProductLookupMetaResponse
        const presentation = adaptSourceRecord(dataRich, dataRichMeta)

        expect(presentation.categories).toEqual([
            "plant based beverages",
            "oat drinks",
        ])
        expect(presentation.nutrition).toMatchObject({
            basis: "100g",
            servingSize: "250 ml",
        })
        expect(
            presentation.nutrition.rows.find((row) => row.nutrient === "fat"),
        ).toMatchObject({
            per100g: 1.5,
            perServing: 3.75,
        })
        expect(
            presentation.nutrition.rows.find((row) => row.nutrient === "fiber")
                ?.per100g,
        ).toBe(0)
        expect(presentation.assessments).toEqual({
            nutriScore: {
                grade: "b",
                score: 2,
                version: "2023",
                sourceFields: [
                    "nutriscore_grade",
                    "nutriscore_score",
                    "nutriscore_version",
                ],
            },
            nova: { group: 3, sourceField: "nova_group" },
            greenScore: {
                grade: "c",
                score: 48,
                version: "2025",
                sourceFields: [
                    "environmental_score_grade",
                    "environmental_score_score",
                    "environmental_score_version",
                ],
            },
        })
        expect(presentation.packaging).toMatchObject({
            materials: ["paperboard", "plastic"],
            shapes: ["carton"],
            recycling: ["recycle"],
            components: [
                {
                    shape: "bottle",
                    material: "plastic",
                    recycling: "recycle",
                    quantityPerUnit: "1 L",
                    weightMeasured: "32",
                    numberOfUnits: 1,
                },
            ],
        })
        expect(presentation.environment).toEqual({
            origins: ["finland"],
            manufacturingPlaces: ["Phnom Penh"],
            carbonFootprint100g: 21.5,
            carbonFootprintFromKnownIngredients100g: "18.2",
            carbonFootprintFromMeatOrFish100g: undefined,
        })
        expect(presentation.frontImage).toEqual({
            url: "https://images.openfoodfacts.org/images/products/737/628/064/502/front_en.7.400.jpg",
            language: "en",
            sourceField: "images.selected.front.en.rev",
        })
        expect(presentation.source).toMatchObject({
            creator: "off-contributor",
            createdAt: "2024-01-01T00:00:00.000Z",
            completeness: 0.82,
            dataQualityWarnings: ["nutrition value very high for category"],
        })
    })
})
