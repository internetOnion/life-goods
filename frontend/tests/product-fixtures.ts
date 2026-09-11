import type { ProductLookupResponse } from "../src/api/generated"
import { unavailableAllergenAnalysis } from "../src/features/product/defaults"

export function productResponse(
    sourceRecord: ProductLookupResponse["data"]["source_record"] = {},
): ProductLookupResponse {
    return {
        data: {
            allergen_analysis: unavailableAllergenAnalysis,
            source_record: {
                code: "4006381333931",
                product_name_en: "Dark Chocolate",
                brands: "Example Foods",
                quantity: "100 g",
                lang: "en",
                selected_images: {
                    front: {
                        display: {
                            en: "https://images.openfoodfacts.org/front.jpg",
                        },
                    },
                },
                ingredients_text_en: "Cocoa mass, sugar, cocoa butter",
                categories_tags: ["en:chocolate"],
                labels_tags: ["en:organic"],
                countries_tags: ["en:cambodia"],
                nutriments: {
                    "energy-kcal_100g": 598,
                    "energy-kcal_unit": "kcal",
                    fat_100g: 43,
                    fat_unit: "g",
                    "nova-group_100g": 4,
                },
                nutriscore_grade: "d",
                environmental_score_grade: "c",
                packaging_text_en: "Paper wrapper",
                origins_tags: ["en:cambodia"],
                last_modified_t: 1787462400,
                ...sourceRecord,
            },
        },
        meta: {
            lookup: { barcode: "4006381333931" },
            source: {
                name: "Open Food Facts",
                product_url:
                    "https://world.openfoodfacts.org/product/4006381333931",
            },
            dataset: {
                version: "off-2026-08-27",
                retrieved_at: "2026-08-27T08:00:00Z",
            },
        },
    }
}
