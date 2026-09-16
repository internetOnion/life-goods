import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import type { PackagingComponent as ApiPackagingComponent } from "../src/api/generated"
import { PackagingsTableCard } from "../src/features/product/cards/PackagingsTableCard"
import { translateTaxonomyValue } from "../src/features/product/translations"
import { LocaleProvider } from "../src/i18n/LocaleProvider"

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

    test("shows generated Khmer for an unknown component without a table disclosure", () => {
        const apiComponent: ApiPackagingComponent = {
            shape: "clamping ring",
            material: "plastique et metal",
            recycling: "a recycler",
            shape_field: {
                key: "packaging_component_0_shape",
                selected_original_text: {
                    value: "clamping ring",
                    language: "en",
                    source_field: "packagings[0].shape",
                },
                translation_status: "generated",
                khmer_translation: "ចិញ្ចៀនរឹត",
            },
        }

        window.localStorage.setItem("lifegoods.locale.v1", "km")
        render(
            <LocaleProvider>
                <PackagingsTableCard
                    packagings={[apiComponent]}
                    packagingComponents={[apiComponent]}
                />
            </LocaleProvider>,
        )

        expect(screen.getByText("ចិញ្ចៀនរឹត")).toBeVisible()
        expect(screen.queryByText("clamping ring")).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "បង្ហាញអត្ថបទដើម" }),
        ).not.toBeInTheDocument()
    })

    test("keeps Original Text visible when component translation is unavailable", () => {
        const apiComponent: ApiPackagingComponent = {
            shape: "clamping ring",
            shape_field: {
                key: "packaging_component_0_shape",
                selected_original_text: {
                    value: "clamping ring",
                    language: "en",
                    source_field: "packagings[0].shape",
                },
                translation_status: "translation_unavailable",
                khmer_translation: null,
            },
        }

        window.localStorage.setItem("lifegoods.locale.v1", "km")
        render(
            <LocaleProvider>
                <PackagingsTableCard
                    packagings={[apiComponent]}
                    packagingComponents={[apiComponent]}
                />
            </LocaleProvider>,
        )

        expect(screen.getByText("clamping ring")).toBeVisible()
        expect(
            screen.getByText("មិនអាចបកប្រែជាភាសាខ្មែរ; កំពុងបង្ហាញអត្ថបទដើម"),
        ).toBeVisible()
    })

    test("does not render Original Text disclosure for non-table packaging instructions", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        render(
            <LocaleProvider>
                <PackagingsTableCard
                    packagings={[]}
                    recyclingInstructionItems={[
                        {
                            key: "recycling_instruction_0",
                            selected_original_text: {
                                value: "Recycle in sorting bin",
                                language: "en",
                                source_field: "recycling_instructions",
                            },
                            translation_status: "generated",
                            khmer_translation: "ដាក់ក្នុងធុងតម្រៀបសំរាម",
                        },
                    ]}
                />
            </LocaleProvider>,
        )

        expect(screen.getByText("ដាក់ក្នុងធុងតម្រៀបសំរាម")).toBeVisible()
        expect(
            screen.queryByRole("button", { name: "បង្ហាញអត្ថបទដើម" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Recycle in sorting bin"),
        ).not.toBeInTheDocument()
    })
})
