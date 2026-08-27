import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"

import type { PackageMatchEvidenceResponse } from "../src/api/generated"
import { OpenFoodFactsResult } from "../src/features/package-match/OpenFoodFactsResult"
import type { OpenFoodFactsCandidate } from "../src/features/package-match/types"
import i18n from "../src/i18n"
import {
    completeOffCandidate,
    datasetVersion,
    sparseOffCandidate,
} from "./package-match-fixtures"

const retrievedAt = "2026-08-24T10:00:00Z"
const sourceUrl = "https://world.openfoodfacts.org/product/4006381333931"

function evidence(
    field: string,
    value: unknown,
    language: string | null = null,
): PackageMatchEvidenceResponse {
    return {
        field,
        value,
        language,
        observed_at: null,
        retrieved_at: retrievedAt,
        source_field: field,
        source_name: "Open Food Facts",
        source_url: sourceUrl,
    }
}

function renderResult(value: OpenFoodFactsCandidate) {
    return render(
        <OpenFoodFactsResult
            candidate={value}
            normalizedIdentifier="4006381333931"
        />,
    )
}

describe("OpenFoodFactsResult", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("renders complete community evidence without a score or verdict", () => {
        renderResult(
            completeOffCandidate({
                dataset_version_id: "dataset-2026-08-27",
                dataset_retrieved_at: "2026-08-27T08:00:00Z",
                dataset_activated_at: "2026-08-27T09:00:00Z",
                dataset_source_url: datasetVersion.source_url,
                dataset_sha256: datasetVersion.sha256,
            }),
        )

        expect(
            screen.getByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        expect(screen.getByText("Contains milk")).toBeVisible()
        expect(screen.getByText("May contain nuts")).toBeVisible()
        expect(screen.getByText("dataset-2026-08-27")).toBeVisible()
        expect(screen.getByText(/Open Food Facts data as of/)).toBeVisible()
        expect(screen.getByText("Dataset activated")).toBeVisible()
        expect(
            screen.getByText("Dataset integrity hash (SHA-256)"),
        ).toBeVisible()
        expect(screen.getByText("a".repeat(64))).toBeVisible()
        expect(
            screen.getByRole("link", { name: "Open the dataset source" }),
        ).toHaveAttribute("href", datasetVersion.source_url)
        expect(screen.getByText("Example Foods")).toBeVisible()
        expect(screen.getByText("100 g")).toBeVisible()
        const packagingLanguagesSection = screen
            .getByRole("heading", { name: "Packaging languages" })
            .closest("section")
        const countriesSection = screen
            .getByRole("heading", { name: "Countries listed by the source" })
            .closest("section")
        expect(packagingLanguagesSection).not.toBeNull()
        expect(countriesSection).not.toBeNull()
        expect(
            within(packagingLanguagesSection!).getByText("Khmer"),
        ).toBeVisible()
        expect(within(countriesSection!).getByText("Cambodia")).toBeVisible()
        expect(
            screen.getByText(/This deliberately long ingredient statement/),
        ).toBeVisible()
        expect(screen.getByText("550")).toBeVisible()
        expect(screen.getByText("23.4")).toBeVisible()
        expect(screen.getByText("Energy (kcal) · per 100 g")).toBeVisible()
        expect(screen.getByText("Sugars · per 100 g")).toBeVisible()
        expect(
            screen.getByText(
                "Community data from Open Food Facts—not yet reviewed by this project.",
            ),
        ).toBeVisible()
        expect(
            screen.queryByText(/^(excellent|positive|negative)$/i),
        ).not.toBeInTheDocument()
    })

    test("exposes field-level provenance for selected identity evidence", () => {
        renderResult(completeOffCandidate())

        for (const [label, sourceField] of [
            ["Package name", "product_name_en"],
            ["Brand", "brands"],
            ["Quantity", "quantity"],
            ["Checked barcode", "code"],
        ] as const) {
            const summary = screen.getByText(`Source details for ${label}`)
            const disclosure = summary.closest("details")
            expect(disclosure).not.toBeNull()
            fireEvent.click(summary)
            expect(within(disclosure!).getByText(sourceField)).toBeVisible()
            expect(within(disclosure!).getByRole("link")).toHaveAttribute(
                "href",
                sourceUrl,
            )
        }
    })

    test("labels sparse fields as unavailable rather than none", () => {
        renderResult(sparseOffCandidate())

        expect(
            screen.getAllByText("Unavailable from Open Food Facts").length,
        ).toBeGreaterThan(4)
        expect(
            screen.getByRole("heading", {
                name: "Package name unavailable from Open Food Facts",
            }),
        ).toBeVisible()
        expect(screen.queryByText(/^none$/i)).not.toBeInTheDocument()
    })

    test("prefers the current interface language and retains alternate names", async () => {
        await i18n.changeLanguage("km")
        renderResult(
            completeOffCandidate({
                identity_evidence: [
                    evidence("name", "Chocolate", "en"),
                    evidence("name", "សូកូឡា", "km"),
                    evidence("name", "Chocolat", "fr"),
                ],
            }),
        )

        expect(screen.getByRole("heading", { name: "សូកូឡា" })).toBeVisible()
        expect(screen.getByText("Chocolate")).toBeVisible()
        expect(screen.getByText("Chocolat")).toBeVisible()
    })

    test("presents every evidence group with readable Khmer metadata", async () => {
        await i18n.changeLanguage("km")
        renderResult(completeOffCandidate())

        expect(
            screen.getByRole("heading", {
                name: "សូកូឡាខ្មៅដែលមានឈ្មោះវែងសម្រាប់សាកល្បងប្លង់",
            }),
        ).toHaveFocus()
        for (const heading of [
            "ឈ្មោះផ្សេងៗពីប្រភព",
            "អត្ថបទគ្រឿងផ្សំ",
            "ការប្រកាសអាលែហ្សែន",
            "ការប្រកាសអាចមានសំណល់",
            "ការប្រកាសអាហារូបត្ថម្ភ",
            "ភាសាលើកញ្ចប់",
            "ប្រទេសដែលបានរាយក្នុងប្រភព",
            "ប្រភព និងការផ្តល់កិត្តិយស",
        ]) {
            expect(screen.getByRole("heading", { name: heading })).toBeVisible()
        }
        expect(
            screen.getByText(
                "ម៉ាសកាកាវ ស្ករ ប៊ឺកាកាវ និងអត្ថបទគ្រឿងផ្សំវែងសម្រាប់ផ្ទៀងផ្ទាត់ថាខ្លឹមសារសំខាន់មិនត្រូវបានកាត់ឱ្យខ្លី។",
            ),
        ).toBeVisible()
        const packagingLanguagesSection = screen
            .getByRole("heading", { name: "ភាសាលើកញ្ចប់" })
            .closest("section")
        const countriesSection = screen
            .getByRole("heading", {
                name: "ប្រទេសដែលបានរាយក្នុងប្រភព",
            })
            .closest("section")
        expect(packagingLanguagesSection).not.toBeNull()
        expect(countriesSection).not.toBeNull()
        expect(
            within(packagingLanguagesSection!).getByText("ខ្មែរ"),
        ).toBeVisible()
        expect(within(countriesSection!).getByText("កម្ពុជា")).toBeVisible()
        expect(screen.getByText("ថាមពល (kcal) · ក្នុង ១០០ ក្រាម")).toBeVisible()
        expect(screen.getByText("ស្ករ · ក្នុង ១០០ ក្រាម")).toBeVisible()
    })

    test("renders an explicit fallback when the reference image is absent", () => {
        renderResult(completeOffCandidate({ reference_images: [] }))

        expect(
            screen.getByRole("img", {
                name: "Reference package image unavailable",
            }),
        ).toBeVisible()
    })

    test("does not repeat the source name in an unnamed image description", () => {
        const image = completeOffCandidate().reference_images[0]
        renderResult(
            sparseOffCandidate({
                reference_images: image ? [image] : [],
            }),
        )

        expect(
            screen.getByRole("img", {
                name: "Reference package image from Open Food Facts",
            }),
        ).toBeVisible()
    })

    test("replaces a broken reference image with the same honest fallback", () => {
        renderResult(completeOffCandidate())

        fireEvent.error(
            screen.getByRole("img", {
                name: "Reference package image for Dark chocolate from Open Food Facts",
            }),
        )
        expect(
            screen.getByRole("img", {
                name: "Reference package image unavailable",
            }),
        ).toBeVisible()
    })

    test("safely renders complex nutrition records and string lists", () => {
        renderResult(
            completeOffCandidate({
                label_evidence: [
                    evidence("nutrition", {
                        energy_kcal_100g: 550,
                        nova_group: 4,
                        serving_notes: ["per 100 g", "prepared"],
                        unavailable_nested_value: { amount: 2 },
                    }),
                    evidence("allergen_tags", ["en:milk", "en:soy"]),
                ],
            }),
        )

        expect(screen.getByText("Energy (kcal) · per 100 g")).toBeVisible()
        expect(screen.getByText("per 100 g, prepared")).toBeVisible()
        expect(screen.getByText("en:milk")).toBeVisible()
        expect(screen.queryByText("nova group")).not.toBeInTheDocument()
        expect(screen.queryByText("[object Object]")).not.toBeInTheDocument()
    })

    test("keeps original metadata tags and nutrition keys inspectable", async () => {
        const user = userEvent.setup()
        renderResult(completeOffCandidate())

        const languageSummary = screen.getByText(
            "Source details for Packaging languages",
        )
        const languageDetails = languageSummary.closest("details")
        expect(languageDetails).not.toBeNull()
        await user.click(languageSummary)
        expect(
            within(languageDetails!).getByText("en:english, en:khmer"),
        ).toBeVisible()

        const nutritionSummary = screen.getByText(
            "Source details for Declared value",
        )
        const nutritionDetails = nutritionSummary.closest("details")
        expect(nutritionDetails).not.toBeNull()
        await user.click(nutritionSummary)
        expect(
            within(nutritionDetails!).getByText(
                "energy_kcal_100g: 550; sugars_100g: 23.4",
            ),
        ).toBeVisible()
    })

    test("keeps reference images same-origin with keyboard-focusable provenance", async () => {
        const user = userEvent.setup()
        renderResult(completeOffCandidate())

        expect(
            screen.getByRole("img", {
                name: "Reference package image for Dark chocolate from Open Food Facts",
            }),
        ).toHaveAttribute(
            "src",
            "/api/v1/open-food-facts-images?url=https%3A%2F%2Fimages.openfoodfacts.org%2Fimages%2Fproducts%2F400%2Freference.jpg",
        )

        const summary = screen.getByText("Reference image source details")
        const imageDetails = summary.closest("details")
        expect(imageDetails).not.toBeNull()
        summary.focus()
        expect(summary).toHaveFocus()
        expect(summary.tagName).toBe("SUMMARY")
        await user.click(summary)
        expect(imageDetails).toHaveAttribute("open")
        const imageSourceLink = within(imageDetails!).getByRole("link", {
            name: "Open the source page for this reference image",
        })
        expect(
            within(imageDetails!).getByText("selected_images.front.display.en"),
        ).toBeVisible()
        expect(within(imageDetails!).getByText("English")).toBeVisible()
        expect(imageSourceLink).toHaveAttribute("href", sourceUrl)
    })

    test("closes the reading order with source attribution and retrieval context", () => {
        renderResult(completeOffCandidate())

        expect(
            screen.getAllByText("Open Food Facts contributors").length,
        ).toBeGreaterThan(0)
        expect(
            screen.getByText("ODbL · Database Contents License · CC BY-SA"),
        ).toBeVisible()
        expect(
            screen.getByRole("link", { name: "View source record" }),
        ).toHaveAttribute("href", sourceUrl)
        expect(screen.getAllByText(/Aug 24, 2026/).length).toBeGreaterThan(0)
    })
})
