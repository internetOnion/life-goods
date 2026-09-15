import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

import {
    getAdditiveReference,
    productTranslationKeys,
    translateProduct,
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
        expect(translateTaxonomyValue("km", "en:jar")).toBe("ពាង")
        expect(translateTaxonomyValue("km", "en:glass")).toBe("កញ្ចក់")
        expect(translateTaxonomyValue("km", "en:unknown-value")).toBe(
            "en:unknown-value",
        )
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
            "../src/features/product/cards/PhotosGalleryCard.tsx",
            "../src/features/product/cards/PackagingCard.tsx",
            "../src/features/product/cards/ProductCharacteristicsCard.tsx",
            "../src/features/product/cards/ProvenanceCard.tsx",
            "../src/features/product/cards/RawRecordCard.tsx",
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
