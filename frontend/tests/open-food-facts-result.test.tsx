import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import type {
    PackageMatchCandidateResponse,
    PackageMatchEvidenceResponse,
} from "../src/api/generated"
import { OpenFoodFactsResult } from "../src/features/package-match/OpenFoodFactsResult"
import i18n from "../src/i18n"

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

function candidate(
    overrides: Partial<PackageMatchCandidateResponse> = {},
): PackageMatchCandidateResponse {
    return {
        external_record_id: "4006381333931",
        identity_evidence: [
            evidence("name", "Dark chocolate", "en"),
            evidence("brands", ["Example Foods"]),
            evidence("quantity", "100 g"),
        ],
        is_current: true,
        label_evidence: [
            evidence("ingredient_text", "Cocoa mass, sugar", "en"),
            evidence("allergen_declaration", "Contains milk", "en"),
            evidence("trace_declaration", "May contain nuts", "en"),
            evidence("nutrition", { energy_kcal_100g: 550, sugars_100g: 23.4 }),
            evidence("packaging_languages", ["en", "km"]),
            evidence("countries_sold", ["Cambodia", "France"]),
        ],
        package_variant_id: null,
        product_id: null,
        reference_images: [
            {
                attribution: "Open Food Facts contributors",
                language: "en",
                license_name: "CC BY-SA",
                role: "front",
                source_field: "selected_images.front.display.en",
                source_name: "Open Food Facts",
                source_url: sourceUrl,
                url: "https://images.openfoodfacts.org/reference.jpg",
            },
        ],
        retrieved_at: retrievedAt,
        source: {
            attribution: "Open Food Facts contributors",
            base_url: "https://world.openfoodfacts.org",
            contents_license: "Database Contents License",
            database_license: "ODbL",
            image_license: "CC BY-SA",
            name: "Open Food Facts",
            record_url: sourceUrl,
            source_type: "COMMUNITY_DATABASE",
            terms_version: null,
        },
        source_kind: "OPEN_FOOD_FACTS",
        source_revision: "1787462400",
        ...overrides,
    }
}

function renderResult(value: PackageMatchCandidateResponse) {
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
        renderResult(candidate())

        expect(
            screen.getByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        expect(screen.getByText("Contains milk")).toBeVisible()
        expect(screen.getByText("May contain nuts")).toBeVisible()
        expect(screen.getByText("550")).toBeVisible()
        expect(screen.getByText("23.4")).toBeVisible()
        expect(
            screen.getByText(/not yet reviewed by the LifeGoods project/),
        ).toBeVisible()
        expect(
            screen.queryByText(/^(excellent|positive|negative)$/i),
        ).not.toBeInTheDocument()
    })

    test("exposes field-level provenance for selected identity evidence", () => {
        renderResult(candidate())

        for (const [label, sourceField] of [
            ["Package name", "name"],
            ["Brand", "brands"],
            ["Quantity", "quantity"],
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
        renderResult(
            candidate({
                identity_evidence: [evidence("name", "Sparse package", "en")],
                label_evidence: [],
                reference_images: [],
            }),
        )

        expect(
            screen.getAllByText("Unavailable evidence from Open Food Facts")
                .length,
        ).toBeGreaterThan(4)
        expect(screen.queryByText(/^none$/i)).not.toBeInTheDocument()
    })

    test("prefers the current interface language and retains alternate names", async () => {
        await i18n.changeLanguage("km")
        renderResult(
            candidate({
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

    test("renders an explicit fallback when the reference image is absent", () => {
        renderResult(candidate({ reference_images: [] }))

        expect(
            screen.getByRole("img", {
                name: "Reference package image unavailable",
            }),
        ).toBeVisible()
    })

    test("replaces a broken reference image with the same honest fallback", () => {
        renderResult(candidate())

        fireEvent.error(
            screen.getByRole("img", {
                name: "Reference package image from Open Food Facts",
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
            candidate({
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

        expect(screen.getByText("energy kcal 100g")).toBeVisible()
        expect(screen.getByText("per 100 g, prepared")).toBeVisible()
        expect(screen.getByText("en:milk")).toBeVisible()
        expect(screen.queryByText("[object Object]")).not.toBeInTheDocument()
    })
})
