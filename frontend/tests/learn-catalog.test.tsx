import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { LEARN_ENTRIES } from "../src/features/learn/entries"
import { LEARN_GUIDES } from "../src/features/learn/guides"
import { LEARN_SOURCES } from "../src/features/learn/sources"
import type { AdditiveRecord } from "../src/features/learn/types"
import { learnCatalogErrors } from "../src/features/learn/validation"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"

function renderRoute(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <App lookup={vi.fn<PackageMatchLookup>()} demoMode={false} />
        </MemoryRouter>,
    )
}

describe("structured Learn catalog", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("has a valid bilingual 27-entry catalog in five guides", () => {
        expect(learnCatalogErrors()).toEqual([])
        expect(LEARN_ENTRIES).toHaveLength(27)
        expect(LEARN_GUIDES.map((guide) => guide.entryIds.length)).toEqual([
            8, 4, 4, 4, 7,
        ])
        expect(
            LEARN_SOURCES.every((source) => source.url.startsWith("https://")),
        ).toBe(true)
        expect(
            LEARN_SOURCES.find((source) => source.id === "codex-label-2026")
                ?.version,
        ).toBe("CXS 1-1985 (2026 revision)")
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
                screen.getByText("Source version", { exact: false }),
            ).toBeVisible()

            unmount()
        }
    })
})
