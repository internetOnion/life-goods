import { describe, expect, test } from "vitest"

import { LEARN_ENTRIES } from "../src/features/learn/entries"
import { LEARN_GUIDES } from "../src/features/learn/guides"
import { LEARN_SOURCES } from "../src/features/learn/sources"
import { learnTranslations } from "../src/features/learn/translations"
import { translateProduct } from "../src/features/product/translations"

const productSourceCopyKeys = [
    "sourceDataUnavailableDetail",
    "photoAttribution",
    "sourceAssessments",
    "openFoodFactsSourceAssessments",
    "sourcePackageLabel",
    "showSourceEvidence",
    "hideSourceEvidence",
    "viewWordingAndSourceContext",
    "nutritionSource",
    "dataSourceCitation",
    "attribution",
    "sourceImageUnavailable",
    "sourceAnalysisDisclaimer",
    "noPackagePhotographs",
] as const

const productEnglishSourceCopy: Record<
    (typeof productSourceCopyKeys)[number],
    string
> = {
    sourceDataUnavailableDetail:
        "The Source Record did not include this information.",
    photoAttribution: "Photo attribution",
    sourceAssessments: "Source Assessments",
    openFoodFactsSourceAssessments: "Open Food Facts Source Assessments",
    sourcePackageLabel: "Source: Package Label Declaration",
    showSourceEvidence: "Show source evidence",
    hideSourceEvidence: "Hide source evidence",
    viewWordingAndSourceContext: "View wording and source context",
    nutritionSource:
        "Source: Nutrition facts table transcribed from the physical product package.",
    dataSourceCitation: "Data Source & Citation",
    attribution: "Attribution",
    sourceImageUnavailable: "Source Image Unavailable",
    sourceAnalysisDisclaimer:
        "Source analysis from Open Food Facts; not a Life Goods judgment.",
    noPackagePhotographs:
        "No package photographs archived in the source record.",
}

describe("Khmer source-marker UI copy", () => {
    test("removes the source marker from Product UI copy", () => {
        for (const key of productSourceCopyKeys) {
            expect(translateProduct("km", key), key).not.toContain("ប្រភព")
        }
    })

    test("keeps the corresponding English Product copy unchanged", () => {
        for (const key of productSourceCopyKeys) {
            expect(translateProduct("en", key), key).toBe(
                productEnglishSourceCopy[key],
            )
        }
    })

    test("removes the source marker from Learn UI metadata only", () => {
        const learnUiCopy = [
            learnTranslations.km.learn.searchPlaceholder,
            learnTranslations.km.learn.categoriesHint,
            learnTranslations.km.learn.startHereHint,
            learnTranslations.km.learn.supportingTitle,
            learnTranslations.km.learn.supportingHint,
            learnTranslations.km.learn.simulatedDisclosure,
            learnTranslations.km.learn.sourceSummaryTitle,
            learnTranslations.km.learn.sourceSummaryHint,
            learnTranslations.km.learn.keyPointsTitle,
            learnTranslations.km.learn.sourceDocumentsTitle,
            learnTranslations.km.learn.versionLabel,
            learnTranslations.km.learn.topics.evidence,
            ...LEARN_GUIDES.flatMap((guide) =>
                guide.table ? [guide.table.sourceHeading.km] : [],
            ),
            ...LEARN_SOURCES.map((source) => source.jurisdiction.km),
            ...LEARN_ENTRIES.flatMap((entry) =>
                (entry.facts ?? []).map((fact) => fact.label.km),
            ),
        ]

        expect(learnUiCopy.every((copy) => !copy.includes("ប្រភព"))).toBe(true)

        const preservedProse = LEARN_ENTRIES.find(
            (entry) => entry.id === "HALAL_LEARN_002",
        )?.body.km
        expect(preservedProse).toContain("ប្រភព")
    })

    test("keeps English Learn source terminology unchanged", () => {
        expect(learnTranslations.en.learn.searchPlaceholder).toBe(
            "search by topic, title, or source",
        )
        expect(learnTranslations.en.learn.supportingTitle).toBe(
            "Sources and standards",
        )
        expect(learnTranslations.en.learn.sourceSummaryTitle).toBe(
            "Summary from the source",
        )
        expect(learnTranslations.en.learn.sourceDocumentsTitle).toBe(
            "Sources and documents",
        )
        expect(learnTranslations.en.learn.versionLabel).toBe("Source version")
        expect(
            LEARN_GUIDES.find((guide) => guide.table)?.table?.sourceHeading.en,
        ).toBe("Source")
        expect(
            LEARN_SOURCES.find(
                (source) => source.id === "nutri-score-sante-publique-france",
            )?.jurisdiction.en,
        ).toBe("Educational reference")
    })
})
