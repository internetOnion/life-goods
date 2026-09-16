import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test } from "vitest"

import { LocaleProvider } from "../src/i18n/LocaleProvider"
import { NotFoundPage } from "../src/features/not-found/NotFoundPage"

function renderPage(locale: "en" | "km" = "en") {
    window.localStorage.setItem("lifegoods.locale.v1", locale)
    return render(
        <LocaleProvider>
            <MemoryRouter initialEntries={["/nonexistent"]}>
                <NotFoundPage />
            </MemoryRouter>
        </LocaleProvider>,
    )
}

describe("NotFoundPage", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test("renders Khmer not-found state", () => {
        renderPage("km")

        expect(
            screen.getByRole("heading", { name: "រកមិនឃើញទំព័រ" }),
        ).toBeVisible()
        expect(
            screen.getByText(
                "មិនមានទំព័រ Life Goods នៅអាសយដ្ឋាននេះទេ។ ត្រឡប់ទៅទំព័រស្កេនដើម្បីស្វែងរកផលិតផល។",
            ),
        ).toBeVisible()
        expect(
            screen.getByRole("link", { name: "ស្កេនបាកូដ" }),
        ).toHaveAttribute("href", "/")
        expect(document.title).toBe("រកមិនឃើញទំព័រ | Life Goods")
    })

    test("renders English not-found state", () => {
        renderPage("en")

        expect(
            screen.getByRole("heading", { name: "Page not found" }),
        ).toBeVisible()
        expect(
            screen.getByText(
                "There is no Life Goods page at this address. Return to the scanner to look up a Product.",
            ),
        ).toBeVisible()
        expect(
            screen.getByRole("link", { name: "Scan a Barcode" }),
        ).toHaveAttribute("href", "/")
        expect(document.title).toBe("Page not found | Life Goods")
    })
})
