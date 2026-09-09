import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { ProductLookup } from "../src/features/product/api"
import { productResponse } from "./product-fixtures"

function renderRoute(path: string, lookup = vi.fn<ProductLookup>()) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[path]}>
                <App lookup={lookup} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("Life Goods routes", () => {
    test("keeps the core shopper journey visible in the shared shell", () => {
        renderRoute("/")

        expect(
            screen.getByRole("heading", { level: 1, name: "Scan a Barcode" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Private camera scanning" }),
        ).toBeVisible()
        const navigation = screen.getByRole("navigation", {
            name: "Primary navigation",
        })
        expect(navigation).toBeVisible()
        expect(screen.getByRole("link", { name: "Scan" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        expect(screen.getByRole("link", { name: "Learn" })).toBeVisible()
        expect(screen.getByRole("link", { name: "Concerns" })).toBeVisible()
        expect(
            within(navigation).queryByRole("link", { name: "Search" }),
        ).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Search" })).toBeVisible()
        expect(screen.getAllByText("Life Goods").length).toBeGreaterThan(0)
        expect(document.documentElement).toHaveAttribute("lang", "en")
    })

    test("registers search, learn, concerns, and data-and-license routes", () => {
        const { unmount: unmountSearch } = renderRoute("/search")
        expect(screen.getByRole("heading", { name: "Search" })).toHaveFocus()
        expect(
            screen.queryByRole("navigation", { name: "Primary navigation" }),
        ).not.toBeInTheDocument()
        unmountSearch()

        const { unmount: unmountLearn } = renderRoute("/learn")
        expect(screen.getByRole("heading", { name: "Learn" })).toHaveFocus()
        unmountLearn()

        const { unmount: unmountConcerns } = renderRoute("/concerns")
        expect(
            screen.getByRole("heading", { name: "Dietary & Allergy Concerns" }),
        ).toHaveFocus()
        unmountConcerns()

        const { unmount: unmountAllergies } = renderRoute("/allergies")
        expect(
            screen.getByRole("heading", { name: "Dietary & Allergy Concerns" }),
        ).toHaveFocus()
        unmountAllergies()

        renderRoute("/data-and-licenses")
        expect(
            screen.getByRole("heading", { name: "Data and licenses" }),
        ).toHaveFocus()
        expect(
            screen.getByText("https://world.openfoodfacts.org/data"),
        ).toHaveClass("font-bold")
        expect(
            screen.queryByRole("link", {
                name: "https://world.openfoodfacts.org/data",
            }),
        ).not.toBeInTheDocument()
    })

    test("loads the Product route through Product Lookup", async () => {
        const lookup = vi
            .fn<ProductLookup>()
            .mockResolvedValue(productResponse())
        renderRoute("/products/4006381333931", lookup)

        expect(
            await screen.findByRole("heading", { name: "Dark Chocolate" }),
        ).toHaveFocus()
        expect(lookup).toHaveBeenCalledWith("4006381333931")
    })

    test("renders an explicit not-found route", () => {
        renderRoute("/not-a-route")
        expect(
            screen.getByRole("heading", { name: "Page not found" }),
        ).toHaveFocus()
    })

    test("clicking search bar from scanner navigates without activating text entry", async () => {
        const user = userEvent.setup()
        renderRoute("/")
        const searchLink = screen.getByRole("link", { name: "Search" })
        await user.click(searchLink)
        expect(
            screen.getByRole("textbox", { name: "Search" }),
        ).not.toHaveFocus()
    })

    test("clicking Learn in the bottom navigation opens the guide grid", async () => {
        const user = userEvent.setup()
        renderRoute("/")

        await user.click(screen.getByRole("link", { name: "Learn" }))

        expect(
            screen.getByRole("heading", { name: "Label-reading guides" }),
        ).toBeVisible()
        expect(
            screen.getByRole("link", { name: /How to read a food label/ }),
        ).toBeVisible()
        expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute(
            "aria-current",
            "page",
        )
    })
})
