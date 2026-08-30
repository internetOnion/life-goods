import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import type { PackageMatchEvidenceResponse } from "../src/api/generated"
import { OpenFoodFactsResult } from "../src/features/package-match/OpenFoodFactsResult"
import type { OpenFoodFactsCandidate } from "../src/features/package-match/types"
import i18n from "../src/i18n"
import {
    completeOffCandidate,
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

function completeMockCandidate(): OpenFoodFactsCandidate {
    const candidate = completeOffCandidate()
    return {
        ...candidate,
        identity_evidence: [
            ...(candidate.identity_evidence ?? []),
            evidence("category", "Chocolate confectionery", "en"),
        ],
        label_evidence: (candidate.label_evidence ?? []).map((item) =>
            item.field === "nutrition"
                ? {
                      ...item,
                      value: {
                          energy_kcal_100g: 550,
                          energy_kcal_100g_unit: "kcal",
                          fat_100g: 35,
                          fat_100g_unit: "g",
                          sugars_100g: 23.4,
                          sugars_100g_unit: "g",
                          energy_kcal_serving: 275,
                          energy_kcal_serving_unit: "kcal",
                          fat_serving: 17.5,
                          fat_serving_unit: "g",
                          sugars_serving: 11.7,
                          sugars_serving_unit: "g",
                      },
                  }
                : item,
        ),
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

    test("renders the seven requested sections with complete mock data", () => {
        render(renderResult(completeMockCandidate()))

        expect(
            screen.getByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        for (const heading of [
            "Evidence Snapshot",
            "Allergens",
            "Product information",
            "Ingredients",
            "Nutrition facts",
            "Storage instructions",
            "Source and attribution",
        ]) {
            expect(screen.getByRole("heading", { name: heading })).toBeVisible()
        }

        const summary = screen
            .getByRole("heading", { name: "Dark chocolate" })
            .closest("section")!
        expect(
            within(summary).getByRole("img", {
                name: "Reference package image for Dark chocolate",
            }),
        ).toBeVisible()
        expect(within(summary).getByText("100 g")).toBeVisible()
        expect(within(summary).getByText("Made in")).toBeVisible()
        expect(within(summary).getByText("Cambodia")).toBeVisible()
        const snapshot = screen
            .getByRole("heading", { name: "Evidence Snapshot" })
            .closest("section")!
        expect(within(snapshot).getByText("Declared concerns")).toBeVisible()
        expect(within(snapshot).getByText("Contains milk")).toBeVisible()
        expect(within(snapshot).getByText("Evidence gaps")).toBeVisible()
        expect(within(snapshot).getByText("Source and review")).toBeVisible()

        const productInformation = screen
            .getByRole("heading", { name: "Product information" })
            .closest("section")!
        expect(
            within(productInformation).getByText("Chocolate confectionery"),
        ).toBeVisible()
        expect(
            within(productInformation).getByText("4006381333931"),
        ).toBeVisible()

        const ingredients = screen
            .getByRole("heading", { name: "Ingredients" })
            .closest("section")!
        expect(
            within(ingredients).getAllByRole("listitem").length,
        ).toBeGreaterThan(1)

        expect(
            screen.getByRole("columnheader", { name: "per 100 g" }),
        ).toBeVisible()
        expect(
            screen.getByRole("columnheader", { name: "per serving" }),
        ).toBeVisible()
        expect(screen.getByText("Keep in a cool, dry place")).toBeVisible()
    })

    test("shows unavailable information in every affected section", () => {
        render(renderResult(sparseOffCandidate()))

        expect(
            screen.getByRole("heading", { name: "Information not mentioned" }),
        ).toHaveFocus()
        for (const heading of [
            "Allergens",
            "Product information",
            "Ingredients",
            "Nutrition facts",
            "Storage instructions",
            "Source and attribution",
        ]) {
            expect(screen.getByRole("heading", { name: heading })).toBeVisible()
        }
        expect(
            screen.getAllByText("Information not mentioned").length,
        ).toBeGreaterThan(5)
        expect(screen.queryByText(/^none$/i)).not.toBeInTheDocument()
    })

    test("uses a placeholder when the reference image is absent or broken", () => {
        const { unmount } = render(
            renderResult(completeOffCandidate({ reference_images: [] })),
        )
        expect(
            screen.getByRole("img", {
                name: "Reference package image unavailable",
            }),
        ).toBeVisible()

        unmount()
        render(renderResult(completeOffCandidate()))
        fireEvent.error(
            screen.getByRole("img", {
                name: "Reference package image for Dark chocolate",
            }),
        )
        expect(
            screen.getByRole("img", {
                name: "Reference package image unavailable",
            }),
        ).toBeVisible()
    })

    test("keeps Source and Attribution limited to source, attribution, and record link", () => {
        render(renderResult(completeMockCandidate()))
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
            within(sourceSection).queryByText("Retrieved"),
        ).not.toBeInTheDocument()
        expect(
            within(sourceSection).queryByText("ODbL"),
        ).not.toBeInTheDocument()
        expect(within(sourceSection).getAllByRole("link")).toHaveLength(1)
    })

    test("prefers the current interface language and retains ingredient evidence", async () => {
        await i18n.changeLanguage("km")
        render(renderResult(completeMockCandidate()))
        expect(
            screen.getByRole("heading", {
                name: "សូកូឡាខ្មៅដែលមានឈ្មោះវែងសម្រាប់សាកល្បងប្លង់",
            }),
        ).toHaveFocus()
        expect(screen.getByRole("heading", { name: "អាលែហ្សែន" })).toBeVisible()
        expect(screen.getByRole("heading", { name: "គ្រឿងផ្សំ" })).toBeVisible()
        expect(
            screen.getByText(/អត្ថបទគ្រឿងផ្សំវែងសម្រាប់ផ្ទៀងផ្ទាត់/),
        ).toBeVisible()
    })
})
