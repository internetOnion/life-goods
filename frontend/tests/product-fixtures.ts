import type { ProductProjectionResponse } from "../src/api/generated"
import { unavailableAllergenAnalysis } from "../src/features/product/defaults"
import { adaptSourceRecord } from "../src/features/product/sourceRecord"

export function productResponse(
    sourceRecord: Record<string, unknown> = {},
): ProductProjectionResponse {
    const raw = {
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
        manufacturing_places: "Cambodia",
        last_modified_t: 1787462400,
        ...sourceRecord,
    }
    const meta = {
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
    }
    const presentation = adaptSourceRecord(raw, meta)
    return {
        data: {
            allergen_analysis: unavailableAllergenAnalysis,
            product: {
                identity: {
                    barcode: presentation.identity.barcode,
                    preferred_name: presentation.identity.preferredName
                        ? {
                              value: presentation.identity.preferredName.value,
                              language:
                                  presentation.identity.preferredName.language,
                              source_field:
                                  presentation.identity.preferredName
                                      .sourceField,
                          }
                        : null,
                    names: presentation.identity.names.map((n) => ({
                        value: n.value,
                        language: n.language,
                        source_field: n.sourceField,
                    })),
                    generic_names: presentation.identity.genericNames.map(
                        (n) => ({
                            value: n.value,
                            language: n.language,
                            source_field: n.sourceField,
                        }),
                    ),
                    brands: presentation.identity.brands,
                    quantity: presentation.identity.quantity,
                },
                front_image: presentation.frontImage
                    ? {
                          url: presentation.frontImage.url,
                          language: presentation.frontImage.language,
                          source_field: presentation.frontImage.sourceField,
                      }
                    : null,
                ingredients: presentation.ingredients.map((i) => ({
                    value: i.value,
                    language: i.language,
                    source_field: i.sourceField,
                })),
                additives: presentation.additives,
                storage_instructions: presentation.storageInstructions.map(
                    (s) => ({
                        value: s.value,
                        language: s.language,
                        source_field: s.sourceField,
                    }),
                ),
                nutrition: {
                    basis: presentation.nutrition.basis,
                    serving_size: presentation.nutrition.servingSize,
                    rows: presentation.nutrition.rows.map((r) => ({
                        nutrient: r.nutrient,
                        label: r.label,
                        per_100g: r.per100g,
                        per_serving: r.perServing,
                        value: r.value,
                        unit: r.unit,
                    })),
                },
                assessments: {
                    nutri_score: presentation.assessments.nutriScore
                        ? {
                              grade: presentation.assessments.nutriScore.grade,
                              score: presentation.assessments.nutriScore.score,
                              version:
                                  presentation.assessments.nutriScore.version,
                              source_fields:
                                  presentation.assessments.nutriScore
                                      .sourceFields,
                          }
                        : null,
                    nova: presentation.assessments.nova
                        ? {
                              group: presentation.assessments.nova.group,
                              source_field:
                                  presentation.assessments.nova.sourceField,
                          }
                        : null,
                    green_score: presentation.assessments.greenScore
                        ? {
                              grade: presentation.assessments.greenScore.grade,
                              score: presentation.assessments.greenScore.score,
                              version:
                                  presentation.assessments.greenScore.version,
                              source_fields:
                                  presentation.assessments.greenScore
                                      .sourceFields,
                          }
                        : null,
                },
                categories: presentation.categories,
                labels: presentation.labels,
                countries: presentation.countries,
                packaging: {
                    texts: presentation.packaging.texts.map((t) => ({
                        value: t.value,
                        language: t.language,
                        source_field: t.sourceField,
                    })),
                    recycling_instructions:
                        presentation.packaging.recyclingInstructions.map(
                            (t) => ({
                                value: t.value,
                                language: t.language,
                                source_field: t.sourceField,
                            }),
                        ),
                    components: presentation.packaging.components.map((c) => ({
                        shape: c.shape,
                        material: c.material,
                        recycling: c.recycling,
                        quantity_per_unit: c.quantityPerUnit,
                        weight_measured: c.weightMeasured,
                        number_of_units: c.numberOfUnits,
                    })),
                    materials: presentation.packaging.materials,
                    shapes: presentation.packaging.shapes,
                    recycling: presentation.packaging.recycling,
                },
                environment: {
                    origins: presentation.environment.origins,
                    manufacturing_places:
                        presentation.environment.manufacturingPlaces,
                    carbon_footprint_100g:
                        presentation.environment.carbonFootprint100g,
                    carbon_footprint_from_known_ingredients_100g:
                        presentation.environment
                            .carbonFootprintFromKnownIngredients100g,
                    carbon_footprint_from_meat_or_fish_100g:
                        presentation.environment
                            .carbonFootprintFromMeatOrFish100g,
                },
                source: {
                    name: presentation.source.name,
                    product_url: presentation.source.productUrl,
                    dataset_version: presentation.source.datasetVersion,
                    retrieved_at: presentation.source.retrievedAt,
                    record_language: presentation.source.recordLanguage,
                    languages: presentation.source.languages,
                    creator: presentation.source.creator,
                    created_at: presentation.source.createdAt,
                    last_modified_at: presentation.source.lastModifiedAt,
                    completeness: presentation.source.completeness,
                    data_quality_warnings:
                        presentation.source.dataQualityWarnings,
                },
            },
        },
        meta,
    }
}
