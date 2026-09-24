import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

import { getGs1AllocationRegion } from "@/lib/barcode-country"
import { RECOGNIZED_OFF_COUNTRY_NAMES } from "@/features/product/geographicNames.generated"
import {
    getAdditiveReference,
    productTranslationKeys,
    translateGeographicName,
    translateManufacturingPlaces,
    translateProduct,
    translateLabelValue,
    translateTaxonomyValue,
} from "@/features/product/translations"

const testDirectory = dirname(fileURLToPath(import.meta.url))

describe("Product translation bundle", () => {
    test("has a non-empty English and Khmer value for every typed key", () => {
        expect(productTranslationKeys.length).toBeGreaterThan(0)

        for (const key of productTranslationKeys) {
            expect(translateProduct("en", key), key).not.toBe("")
            expect(translateProduct("km", key), key).not.toBe("")
        }
    })

    test("uses deterministic Khmer reference translations for known values", () => {
        expect(getAdditiveReference("km", "e322")?.name).toBe("លេស៊ីទីន")
        expect(getAdditiveReference("km", "e322")?.functions).toContain(
            "សារធាតុធ្វើឱ្យចូលគ្នា",
        )
        expect(translateTaxonomyValue("km", "en:France")).toBe("បារាំង")
        expect(translateTaxonomyValue("km", "en:Khmer")).toBe("ភាសាខ្មែរ")
        expect(translateTaxonomyValue("km", "en:en:no-gluten")).toBe(
            "គ្មានគ្លុយតែន",
        )
        expect(translateTaxonomyValue("km", "en:jar")).toBe("ដបកែវ")
        expect(translateTaxonomyValue("km", "en:glass")).toBe("កញ្ចក់")
        expect(translateTaxonomyValue("km", "en:unknown-value")).toBe(
            "en:unknown-value",
        )
    })

    test("translates only recognized manufacturing countries in Khmer", () => {
        expect(translateManufacturingPlaces("km", "france")).toBe("បារាំង")
        expect(translateManufacturingPlaces("km", "en:france")).toBe("បារាំង")
        expect(translateManufacturingPlaces("km", "Rouen, France")).toBe(
            "Rouen, បារាំង",
        )
        expect(translateManufacturingPlaces("km", "Rice Land")).toBe(
            "Rice Land",
        )
        expect(translateManufacturingPlaces("km", "en:front")).toBe("en:front")
        expect(translateManufacturingPlaces("en", "Rouen, France")).toBe(
            "Rouen, France",
        )
    })

    test("covers pinned Open Food Facts geography and every GS1 allocation region", () => {
        for (const sourceName of RECOGNIZED_OFF_COUNTRY_NAMES) {
            expect(
                translateGeographicName("km", sourceName),
                sourceName,
            ).toMatch(/[\u1780-\u17ff]/)
        }

        for (let prefix = 0; prefix <= 999; prefix += 1) {
            const barcode = `${String(prefix).padStart(3, "0")}0000000000`
            const region = getGs1AllocationRegion(barcode)
            if (region) {
                expect(translateGeographicName("km", region), region).toMatch(
                    /[\u1780-\u17ff]/,
                )
            }
        }
    })

    test("localizes source variants and combined regions without guessing free text", () => {
        const expected: Record<string, string> = {
            armenia: "អាមេនី",
            belgium: "បែលហ្ស៊ិក",
            cameroon: "កាមេរូន",
            "en:Réunion": "រេអុយញ៉ុង",
            Russia: "រុស្ស៊ី",
            Senegal: "សេណេហ្គាល់",
            Tunisia: "ទុយនីស៊ី",
            Ukraine: "អ៊ុយក្រែន",
            "Belgium / Luxembourg": "បែលហ្ស៊ិក / លុចសំបួ",
            "Chinese Taipei": "ឆាយនីស តៃប៉ិ",
        }
        for (const [source, translated] of Object.entries(expected)) {
            expect(translateGeographicName("km", source), source).toBe(
                translated,
            )
        }
        expect(translateGeographicName("km", "Rice Land")).toBe("Rice Land")
        expect(translateGeographicName("en", "armenia")).toBe("armenia")
        expect(translateGeographicName("km", "en:front")).toBe("en:front")
    })

    test("translates known label taxonomy values and preserves unknown values", () => {
        const expectedLabels: Record<string, string> = {
            "Fair Trade": "ពាណិជ្ជកម្មយុត្តិធម៌",
            Organic: "សរីរាង្គ",
            "Eu Organic": "សរីរាង្គសហភាពអឺរ៉ុប",
            "Non Eu Agriculture": "កសិកម្មក្រៅសហភាពអឺរ៉ុប",
            "Eu Agriculture": "កសិកម្មសហភាពអឺរ៉ុប",
            "Eu Non Eu Agriculture": "កសិកម្មសហភាពអឺរ៉ុប និងក្រៅសហភាពអឺរ៉ុប",
            "Fr Bio 01": "FR-BIO-01 (កសិកម្មសរីរាង្គ)",
            Nutriscore: "Nutri-Score",
            "Nutriscore Grade A": "Nutri-Score កម្រិត A",
            "Nutriscore Grade A New Calculation":
                "Nutri-Score កម្រិត A (ការគណនាថ្មី)",
            "Ab Agriculture Biologique": "សញ្ញា AB – កសិកម្មសរីរាង្គ",
            "Agri Ethique France": "កសិកម្មប្រកបដោយសីលធម៌បារាំង",
            Triman: "សញ្ញា Triman",
            "1% Pour La Planète": "1% សម្រាប់ភពផែនដី",
            "Commerce Équitable": "ពាណិជ្ជកម្មយុត្តិធម៌",
            "Fabriqué En France": "ផលិតនៅប្រទេសបារាំង",
            "Farine De Blé Français": "ម្សៅស្រូវសាលីបារាំង",
            Végétarien: "អាហារបួស",
        }

        for (const [source, expected] of Object.entries(expectedLabels)) {
            expect(translateLabelValue("km", source), source).toBe(expected)
        }

        expect(translateLabelValue("km", "en:fair-trade")).toBe(
            "ពាណិជ្ជកម្មយុត្តិធម៌",
        )
        expect(translateLabelValue("km", "fr:commerce-equitable")).toBe(
            "ពាណិជ្ជកម្មយុត្តិធម៌",
        )
        expect(translateLabelValue("km", "fr:vegetarien")).toBe("អាហារបួស")
        expect(translateLabelValue("km", "en:unreviewed-label")).toBe(
            "en:unreviewed-label",
        )
        expect(translateLabelValue("en", "en:fair-trade")).toBe("en:fair-trade")
    })
})

describe("Khmer Product result English audit", () => {
    test("does not reintroduce known app-owned English UI copy", () => {
        const resultFiles = [
            "../src/features/product/ProductPage.tsx",
            "../src/features/product/cards/ProductHero.tsx",
            "../src/features/product/cards/AllergenCard.tsx",
            "../src/features/product/cards/AdditivesCard.tsx",
            "../src/features/product/cards/IngredientSummaryCard.tsx",
            "../src/features/product/cards/IngredientsAnalysisCard.tsx",
            "../src/features/product/cards/IngredientsCard.tsx",
            "../src/features/product/cards/NutritionCard.tsx",
            "../src/features/product/cards/PackagingsTableCard.tsx",
            "../src/features/product/cards/ProvenanceCard.tsx",
            "../src/features/product/cards/SymbolsCard.tsx",
            "../src/features/product/cards/scores/NutrientLevelsCard.tsx",
        ]
        const forbiddenVisibleCopy = [
            "Source Data Unavailable",
            "Source Image Unavailable",
            "Languages recorded on the label",
            "Photo Archive & Packaging Scans",
            "No package photographs archived in the source record.",
            "High-res original available",
            "Product Characteristics & Classification",
            "Stores / Retailers",
            "Traceability / EMB Codes:",
            "Product Website",
            "Countries Sold",
            "Manufacturing Places",
            "Storage Instructions",
            "Package Languages:",
            "Source analysis from Open Food Facts; not a Life Goods judgment.",
            "Included in ${parentLabel}",
            "benchmark scale:",
            "Current rating:",
            "Level: ${levelVal}",
            "See the",
            '"Copied"',
            '"Copy JSON"',
            '"Hide Inspector"',
            '"Inspect JSON"',
        ]

        for (const relativePath of resultFiles) {
            const source = readFileSync(
                resolve(testDirectory, relativePath),
                "utf8",
            )
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/\/\/.*$/gm, "")
            for (const phrase of forbiddenVisibleCopy) {
                expect(
                    source,
                    `${relativePath} still contains ${phrase}`,
                ).not.toContain(phrase)
            }
        }
    })
})
