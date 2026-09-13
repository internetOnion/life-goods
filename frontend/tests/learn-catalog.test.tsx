import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { LEARN_ENTRIES } from "../src/features/learn/entries"
import { LEARN_GUIDES } from "../src/features/learn/guides"
import { LEARN_SOURCES } from "../src/features/learn/sources"
import type { AdditiveRecord, LearnEntry } from "../src/features/learn/types"
import {
    allergenIngredientGroupErrors,
    learnCatalogErrors,
} from "../src/features/learn/validation"
import i18n from "../src/features/learn/translations"
import type { ProductLookup } from "../src/features/product/api"

function renderRoute(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <App lookup={vi.fn<ProductLookup>()} demoMode={false} />
        </MemoryRouter>,
    )
}

describe("structured Learn catalog", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("has a valid bilingual 31-entry catalog in six guides", () => {
        expect(learnCatalogErrors()).toEqual([])
        expect(LEARN_ENTRIES).toHaveLength(31)
        expect(LEARN_GUIDES.map((guide) => guide.entryIds.length)).toEqual([
            8, 3, 4, 5, 4, 7,
        ])
        expect(
            LEARN_SOURCES.every(
                (source) =>
                    source.url === undefined ||
                    source.url.startsWith("https://"),
            ),
        ).toBe(true)
        expect(
            LEARN_SOURCES.find((source) => source.id === "codex-label-2026")
                ?.version,
        ).toBe("CXS 1-1985 (2026 revision)")
    })

    test("validates structured allergen ingredient groups", () => {
        const entry = LEARN_ENTRIES.find(
            (candidate) => candidate.id === "ALLERGEN_LEARN_005",
        )!
        const groups = entry.allergenIngredientGroups!

        expect(groups).toHaveLength(12)
        expect(entry.reviewState).toBe("draft")
        expect(allergenIngredientGroupErrors(entry)).toEqual([])

        const duplicateKey: LearnEntry = {
            ...entry,
            allergenIngredientGroups: [
                groups[0]!,
                { ...groups[1]!, key: groups[0]!.key },
            ],
        }
        expect(allergenIngredientGroupErrors(duplicateKey)).toContain(
            "Learn entry ALLERGEN_LEARN_005 has duplicate allergen group key: milk",
        )

        const emptyExamples: LearnEntry = {
            ...entry,
            allergenIngredientGroups: [{ ...groups[0]!, examples: [] }],
        }
        expect(allergenIngredientGroupErrors(emptyExamples)).toContain(
            "Learn entry ALLERGEN_LEARN_005 allergen group milk has no ingredient examples",
        )

        const missingTranslation: LearnEntry = {
            ...entry,
            allergenIngredientGroups: [
                {
                    ...groups[0]!,
                    examples: [
                        {
                            name: { km: "", en: "Milk powder" },
                        },
                    ],
                },
            ],
        }
        expect(allergenIngredientGroupErrors(missingTranslation)).toContain(
            "Learn entry ALLERGEN_LEARN_005 allergen group milk has an incomplete bilingual example",
        )
    })

    test("rejects an unknown source on the allergen ingredient lesson", () => {
        const entry = LEARN_ENTRIES.find(
            (candidate) => candidate.id === "ALLERGEN_LEARN_005",
        )!
        const originalSourceRefs = entry.sourceRefs

        try {
            entry.sourceRefs = [
                { sourceId: "unknown-allergen-source", section: "Example" },
            ]
            expect(learnCatalogErrors()).toContain(
                "Learn entry ALLERGEN_LEARN_005 references unknown source unknown-allergen-source",
            )
        } finally {
            entry.sourceRefs = originalSourceRefs
        }
    })

    test("keeps an explicit typed contract for a future additive import", () => {
        const example: AdditiveRecord = {
            insNumber: "example-only",
            names: { km: "ឧទាហរណ៍", en: "Example" },
            synonyms: [],
            functionalClasses: [],
            foodCategories: [],
            sourceRef: { sourceId: "codex-gsfa-2025", section: "Example" },
            reviewState: "draft",
        }

        expect(example.reviewState).toBe("draft")
    })

    test("keeps guide pages focused on lesson discovery", () => {
        for (const guide of LEARN_GUIDES) {
            const { unmount } = renderRoute(`/learn/guides/${guide.slug}`)
            const firstEntry = LEARN_ENTRIES.find(
                (entry) => entry.id === guide.entryIds[0],
            )!

            expect(
                screen.getByRole("heading", { name: guide.title.en }),
            ).toHaveFocus()
            expect(screen.queryByRole("table")).not.toBeInTheDocument()
            expect(screen.getAllByRole("listitem")).toHaveLength(
                guide.entryIds.length,
            )
            expect(
                screen.queryByText(firstEntry.summary.en),
            ).not.toBeInTheDocument()
            expect(
                screen.queryByText(firstEntry.body.en),
            ).not.toBeInTheDocument()
            expect(
                screen.queryByText(firstEntry.doesNotImply.en),
            ).not.toBeInTheDocument()

            unmount()
        }
    })

    test("keeps lessons ordered and exposes progress navigation", () => {
        const firstRender = renderRoute("/learn/guides/how-to-read-a-label")
        const firstStep = screen.getAllByRole("listitem")[0]!
        const firstEntry = LEARN_ENTRIES.find(
            (entry) => entry.id === LEARN_GUIDES[0]!.entryIds[0],
        )!
        expect(
            within(firstStep).getByRole("link", {
                name: /Name of the food/,
            }),
        ).toHaveAttribute("href", "/learn/name-of-the-food")
        expect(within(firstStep).getByText("LABEL_001")).toBeVisible()
        expect(
            within(firstStep).queryByText(firstEntry.summary.en),
        ).not.toBeInTheDocument()

        firstRender.unmount()
        const secondRender = renderRoute("/learn/list-of-ingredients")
        expect(screen.getByText("Step 2 of 8")).toBeVisible()
        expect(
            screen.getByRole("link", {
                name: "First lesson",
            }),
        ).toHaveAttribute("href", "/learn/name-of-the-food")
        expect(
            screen.getByRole("link", {
                name: "Lesson 3",
            }),
        ).toHaveAttribute("href", "/learn/net-contents")

        secondRender.unmount()
        renderRoute("/learn/name-of-the-food")
        expect(
            screen.getByRole("navigation", { name: "Lesson navigation" }),
        ).toBeVisible()
        expect(screen.queryByLabelText("First lesson")).not.toBeInTheDocument()
        expect(screen.getByLabelText("Lesson 1")).toHaveAttribute(
            "aria-current",
            "page",
        )
    })

    test("keeps Food Scores sources as underlined plain text", () => {
        renderRoute("/learn/nutri-score")

        const sources = screen.getAllByText(
            "Santé publique France — Nutri-Score (official source)",
        )
        expect(
            sources.every((source) => source.classList.contains("underline")),
        ).toBe(true)
        expect(sources.every((source) => source.closest("a") === null)).toBe(
            true,
        )
    })

    test("keeps the colored reference table on every Food Scores lesson", () => {
        for (const entry of LEARN_ENTRIES.filter(
            (candidate) => candidate.category === "food-scores",
        )) {
            const { unmount } = renderRoute(`/learn/${entry.slug}`)
            const table = screen.getByRole("table", {
                name: `${entry.title.en} — Score levels and meaning`,
            })

            expect(table).toBeVisible()
            expect(within(table).getAllByRole("row")).toHaveLength(
                (entry.facts?.length ?? 0) + 1,
            )
            expect(table.querySelector("tbody th")).toHaveClass("bg-[#e8f2eb]")

            unmount()
        }
    })

    test("renders every coded entry at a stable deep link with source metadata", () => {
        for (const entry of LEARN_ENTRIES) {
            const { unmount } = renderRoute(`/learn/${entry.slug}`)

            expect(
                screen.getByRole("heading", { name: entry.title.en }),
            ).toHaveFocus()
            expect(screen.getByText(entry.id)).toBeVisible()
            expect(
                screen.getByRole("heading", {
                    name: "What this evidence does not prove",
                }),
            ).toBeVisible()
            expect(
                screen.getByRole("heading", {
                    name: "Summary from the source",
                }),
            ).toBeVisible()
            expect(
                screen.getAllByText("Source version", { exact: false })[0],
            ).toBeVisible()

            unmount()
        }
    })
})
