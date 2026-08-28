import { fireEvent, render, screen, within } from "@testing-library/react"
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
    return (
        <OpenFoodFactsResult
            candidate={value}
            normalizedIdentifier="4006381333931"
        />
    )
}

describe("OpenFoodFactsResult", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("prioritizes identity, uncertainty, concerns, and nutrition without a verdict", () => {
        render(
            renderResult(
                completeOffCandidate({
                    dataset_version: datasetVersion,
                }),
            ),
        )
        expect(
            screen.getByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        expect(screen.getAllByText("Contains milk").length).toBeGreaterThan(0)
        expect(screen.getAllByText("May contain nuts").length).toBeGreaterThan(
            0,
        )
        expect(
            screen.getAllByText("dataset-2026-08-27").length,
        ).toBeGreaterThan(0)
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
        expect(
            screen.getByRole("columnheader", { name: "per 100 g" }),
        ).toBeVisible()
        expect(screen.getAllByText("Energy (kcal)").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Sugars").length).toBeGreaterThan(0)
        expect(
            screen.getByText("Community data—not yet reviewed by LifeGoods."),
        ).toBeVisible()
        expect(
            screen.queryByText(/^(excellent|positive|negative)$/i),
        ).not.toBeInTheDocument()
    })

    test("shows new additive, manufacturing, storage, and Halal evidence", () => {
        render(renderResult(completeOffCandidate()))
        expect(
            screen.getByRole("heading", {
                name: "Additives listed by the source",
            }),
        ).toBeVisible()
        expect(screen.getByText(/en:e322/)).toBeVisible()
        expect(
            screen.getByRole("heading", {
                name: "Manufacturing place listed by the source",
            }),
        ).toBeVisible()
        expect(screen.getAllByText("Cambodia").length).toBeGreaterThan(0)
        expect(
            screen.getByRole("heading", { name: "Storage instructions" }),
        ).toBeVisible()
        expect(screen.getByText("Keep in a cool, dry place")).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "Halal-related evidence" }),
        ).toBeVisible()
        expect(screen.getByText("The source lists a Halal label")).toBeVisible()
        expect(screen.getAllByText("Not assessed").length).toBe(2)
    })

    test("shows source and attribution once in a compact final block", () => {
        render(renderResult(completeOffCandidate()))
        const sourceSection = screen
            .getByRole("heading", { name: "Source and attribution" })
            .closest("section")!
        expect(within(sourceSection).getByText("Open Food Facts")).toBeVisible()
        expect(
            within(sourceSection).getByText("Open Food Facts contributors"),
        ).toBeVisible()
        expect(
            within(sourceSection).getByRole("link", {
                name: "View source record",
            }),
        ).toHaveAttribute("href", sourceUrl)
        expect(
            within(sourceSection).getByText(
                "ODbL · Database Contents License · CC BY-SA",
            ),
        ).toBeVisible()
        expect(screen.getAllByText("Open Food Facts")).toHaveLength(1)
        expect(screen.queryByText(/^Source: /)).not.toBeInTheDocument()
        expect(screen.queryByText("Listed by source")).not.toBeInTheDocument()
    })

    test("hides empty details and summarizes the missing evidence once", () => {
        render(renderResult(sparseOffCandidate()))
        expect(
            screen.getByRole("heading", { name: "4006381333931" }),
        ).toBeVisible()
        expect(
            screen.queryByRole("heading", { name: "Allergen declarations" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("heading", { name: "Trace declarations" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("heading", { name: "Ingredient text" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("heading", { name: "Nutrition declaration" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Unavailable from Open Food Facts"),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Brand")).not.toBeInTheDocument()
        expect(screen.queryByText("Quantity")).not.toBeInTheDocument()
        expect(
            screen.getByText(/Not included in this community record/),
        ).toBeVisible()
        expect(screen.queryByText(/^none$/i)).not.toBeInTheDocument()
    })

    test("prefers the current interface language and retains alternate names", async () => {
        await i18n.changeLanguage("km")
        render(
            renderResult(
                completeOffCandidate({
                    identity_evidence: [
                        evidence("name", "Chocolate", "en"),
                        evidence("name", "សូកូឡា", "km"),
                        evidence("name", "Chocolat", "fr"),
                    ],
                }),
            ),
        )
        expect(screen.getByRole("heading", { name: "សូកូឡា" })).toBeVisible()
        const supporting = screen
            .getByRole("heading", { name: "ព័ត៌មានកញ្ចប់បន្ថែម" })
            .closest("section")!
        expect(within(supporting).getByText("Chocolate")).toBeVisible()
        expect(within(supporting).getByText("Chocolat")).toBeVisible()
    })

    test("renders Khmer headings and long evidence without truncation", async () => {
        await i18n.changeLanguage("km")
        render(renderResult(completeOffCandidate()))
        expect(
            screen.getByRole("heading", {
                name: "សូកូឡាខ្មៅដែលមានឈ្មោះវែងសម្រាប់សាកល្បងប្លង់",
            }),
        ).toHaveFocus()
        for (const heading of [
            "ការប្រកាសអាលែហ្សែន",
            "ការប្រកាសអាចមានសំណល់",
            "ព័ត៌មានពាក់ព័ន្ធហាឡាល់",
            "អត្ថបទគ្រឿងផ្សំ",
            "សារធាតុបន្ថែមដែលប្រភពបានរាយ",
            "ការប្រកាសអាហារូបត្ថម្ភ",
            "ទីកន្លែងផលិតដែលប្រភពបានរាយ",
            "ការណែនាំអំពីការរក្សាទុក",
            "ប្រភព និងការផ្តល់កិត្តិយស",
        ]) {
            expect(screen.getByRole("heading", { name: heading })).toBeVisible()
        }
        expect(
            screen.getByText(/អត្ថបទគ្រឿងផ្សំវែងសម្រាប់ផ្ទៀងផ្ទាត់/),
        ).toBeVisible()
    })

    test("hides absent and broken reference images", () => {
        const { unmount } = render(
            renderResult(completeOffCandidate({ reference_images: [] })),
        )
        expect(
            screen.queryByRole("img", {
                name: /Reference package image/,
            }),
        ).not.toBeInTheDocument()
        unmount()
        render(renderResult(completeOffCandidate()))
        fireEvent.error(
            screen.getByRole("img", {
                name: "Reference package image for Dark chocolate",
            }),
        )
        expect(
            screen.queryByRole("img", {
                name: /Reference package image/,
            }),
        ).not.toBeInTheDocument()
    })

    test("safely renders complex nutrition records and excludes scores", () => {
        render(
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
            ),
        )
        expect(screen.getAllByText("Energy (kcal)").length).toBeGreaterThan(0)
        expect(screen.getAllByText("550").length).toBeGreaterThan(0)
        expect(screen.queryByText("nova group")).not.toBeInTheDocument()
        expect(screen.queryByText("[object Object]")).not.toBeInTheDocument()
    })
})
