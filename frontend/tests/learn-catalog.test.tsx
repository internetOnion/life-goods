import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { LEARN_ENTRIES } from "../src/features/learn/entries"
import { LEARN_GUIDES } from "../src/features/learn/guides"
import { LEARN_SOURCES } from "../src/features/learn/sources"
import type { AdditiveRecord } from "../src/features/learn/types"
import { learnCatalogErrors } from "../src/features/learn/validation"
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

    test("has a valid bilingual 30-entry catalog in six guides", () => {
        expect(learnCatalogErrors()).toEqual([])
        expect(LEARN_ENTRIES).toHaveLength(30)
        expect(LEARN_GUIDES.map((guide) => guide.entryIds.length)).toEqual([
            8, 3, 4, 4, 4, 7,
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

    test("keeps an explicit typed contract for a future additive import", () => {
        const example: AdditiveRecord = {
            insNumber: "example-only",
            names: { kh: "ឧទាហរណ៍", en: "Example" },
            synonyms: [],
            functionalClasses: [],
            foodCategories: [],
            sourceRef: { sourceId: "codex-gsfa-2025", section: "Example" },
            reviewState: "draft",
        }

        expect(example.reviewState).toBe("draft")
    })

    test("renders every guide with a named semantic comparison table", () => {
        for (const guide of LEARN_GUIDES) {
            const { unmount } = renderRoute(`/learn/guides/${guide.slug}`)

            expect(
                screen.getByRole("heading", { name: guide.title.en }),
            ).toHaveFocus()
            expect(
                screen.getByRole("table", { name: guide.table.caption.en }),
            ).toBeVisible()
            expect(
                screen.getByRole("columnheader", {
                    name: guide.table.itemHeading.en,
                }),
            ).toBeVisible()
            expect(
                screen.getByRole("columnheader", {
                    name: guide.table.sourceHeading.en,
                }),
            ).toBeVisible()
            expect(screen.getAllByRole("row")).toHaveLength(
                guide.entryIds.length + 1,
            )
            expect(screen.getAllByRole("listitem")).toHaveLength(
                guide.entryIds.length,
            )

            unmount()
        }
    })

    test("keeps lessons ordered and exposes progress navigation", () => {
        const firstRender = renderRoute("/learn/guides/how-to-read-a-label")
        const firstStep = screen.getAllByRole("listitem")[0]!
        expect(
            within(firstStep).getByRole("link", {
                name: /Name of the food/,
            }),
        ).toHaveAttribute("href", "/learn/name-of-the-food")
        expect(within(firstStep).getByText("1")).toBeVisible()

        firstRender.unmount()
        const secondRender = renderRoute("/learn/list-of-ingredients")
        expect(screen.getByText("Step 2 of 8")).toBeVisible()
        expect(
            screen.getByRole("link", {
                name: /Previous lesson: Name of the food/,
            }),
        ).toHaveAttribute("href", "/learn/name-of-the-food")
        expect(
            screen.getByRole("link", {
                name: /Next lesson: Net contents/,
            }),
        ).toHaveAttribute("href", "/learn/net-contents")

        secondRender.unmount()
        renderRoute("/learn/name-of-the-food")
        expect(
            screen.getByRole("navigation", { name: "Lesson navigation" }),
        ).toBeVisible()
        expect(screen.getByLabelText("Previous lesson")).toHaveAttribute(
            "aria-disabled",
            "true",
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
