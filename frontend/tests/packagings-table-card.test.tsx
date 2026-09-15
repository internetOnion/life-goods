import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { PackagingsTableCard } from "../src/features/product/cards/PackagingsTableCard"
import { translateTaxonomyValue } from "../src/features/product/translations"

describe("PackagingsTableCard", () => {
    test("translates packaging taxonomy phrases used by source records", () => {
        expect(translateTaxonomyValue("km", "en:Lid")).toBe("គម្រប")
        expect(translateTaxonomyValue("km", "Clear Glass")).toBe("កញ្ចក់ថ្លា")
        expect(translateTaxonomyValue("km", "Backing")).toBe("ស្រទាប់ខាងក្រោយ")
        expect(translateTaxonomyValue("km", "Non Corrugated Cardboard")).toBe(
            "ក្រដាសកាតុងមិនមានរលក",
        )
        expect(translateTaxonomyValue("km", "82 C Pap")).toBe("ក្រដាស 82 C/PAP")
    })

    test("uses collapsed table borders and shared row hover treatment", () => {
        render(
            <PackagingsTableCard
                packagings={[
                    {
                        shape: "wrapper",
                        material: "paper",
                        recycling: "recycle",
                        weightMeasured: 2,
                    },
                ]}
                packagingText="Paper wrapper"
            />,
        )

        const table = screen.getByRole("table")
        expect(table).toHaveClass("border-collapse")
        expect(
            within(table)
                .getAllByRole("row")
                .slice(1)
                .every((row) => row.classList.contains("table-row-hover")),
        ).toBe(true)
    })

    test("uses itemized components instead of a duplicated packaging list", () => {
        render(
            <PackagingsTableCard
                packagings={[
                    {
                        shape: "jar",
                        material: "glass",
                        recycling: "recycle",
                    },
                ]}
                descriptionItems={[
                    {
                        key: "packaging_description_0",
                        selected_original_text: {
                            value: "Composites,Plastic,Glass,en:Jar",
                            language: "fr",
                            source_field: "packaging_text",
                        },
                        translation_status: "not_requested",
                    },
                ]}
            />,
        )

        expect(
            screen.queryByText("Composites,Plastic,Glass,en:Jar"),
        ).not.toBeInTheDocument()
        expect(screen.getByRole("table")).toBeVisible()
    })

    test("keeps a sentence-style packaging description when it adds context", () => {
        render(
            <PackagingsTableCard
                packagings={[
                    {
                        shape: "bottle",
                        material: "glass",
                        recycling: "recycle",
                    },
                ]}
                packagingText="Glass bottle, with a protective sleeve"
            />,
        )

        expect(
            screen.getByText("Glass bottle, with a protective sleeve"),
        ).toBeVisible()
    })
})
