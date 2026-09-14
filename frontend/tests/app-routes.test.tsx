import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, within } from "@testing-library/react"
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
    test("reveals the back-to-top control above the primary navigation", () => {
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 0,
        })
        renderRoute("/")

        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 640,
        })
        fireEvent.scroll(window)

        expect(screen.getByRole("button", { name: "Back to top" })).toHaveClass(
            "bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
        )
    })

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
        expect(
            within(navigation)
                .getAllByRole("link")
                .map((link) => link.textContent),
        ).toEqual(["Scan", "Learn", "Compare", "Concerns"])
        expect(screen.getByRole("link", { name: "Scan" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        expect(screen.getByRole("link", { name: "Learn" })).toBeVisible()
        expect(screen.getByRole("link", { name: "Compare" })).toBeVisible()
        expect(screen.getByRole("link", { name: "Concerns" })).toBeVisible()
        expect(
            within(navigation).queryByRole("link", { name: "Search" }),
        ).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Search" })).toBeVisible()
        expect(screen.getAllByText("Life Goods").length).toBeGreaterThan(0)
        expect(
            screen.queryByText("Read-only Open Food Facts data"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("link", { name: "Data and licenses" }),
        ).not.toBeInTheDocument()
        expect(document.documentElement).toHaveAttribute("lang", "en")
        expect(
            screen.getByRole("button", { name: "Language: English" }),
        ).toBeVisible()
    })

    test("registers search, learn, concerns, and data-and-license routes", () => {
        const { unmount: unmountSearch } = renderRoute("/search")
        expect(screen.getByRole("heading", { name: "Search" })).toHaveFocus()
        expect(
            screen.queryByRole("navigation", { name: "Primary navigation" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Language: English" }),
        ).not.toBeInTheDocument()
        unmountSearch()

        const { unmount: unmountLearn } = renderRoute("/learn")
        expect(screen.getByRole("heading", { name: "Learn" })).toHaveFocus()
        expect(
            screen.queryByRole("button", { name: "Language: English" }),
        ).not.toBeInTheDocument()
        unmountLearn()

        const { unmount: unmountLearnArticle } = renderRoute(
            "/learn/list-of-ingredients",
        )
        expect(
            screen.queryByRole("navigation", { name: "Primary navigation" }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("navigation", { name: "Lesson navigation" }),
        ).toBeVisible()
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 640,
        })
        fireEvent.scroll(window)
        expect(screen.getByRole("button", { name: "Back to top" })).toHaveClass(
            "bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
        )
        unmountLearnArticle()

        const { unmount: unmountStandaloneArticle } = renderRoute(
            "/learn/law-on-food-safety",
        )
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 640,
        })
        fireEvent.scroll(window)
        expect(screen.getByRole("button", { name: "Back to top" })).toHaveClass(
            "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]",
        )
        unmountStandaloneArticle()

        const { unmount: unmountConcerns } = renderRoute("/concerns")
        expect(
            screen.getByRole("heading", { name: "Dietary & Allergy Concerns" }),
        ).toHaveFocus()
        const concernsNavigation = screen.getByRole("navigation", {
            name: "Primary navigation",
        })
        expect(concernsNavigation).toHaveAttribute("data-glass-surface", "")
        expect(
            within(concernsNavigation).getByRole("link", {
                name: "Concerns",
            }),
        ).toHaveAttribute("aria-current", "page")
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
        const sourceDetails = screen
            .getByText("https://world.openfoodfacts.org/data")
            .closest("dl")
        expect(sourceDetails).toHaveClass("border-t")
        expect(sourceDetails).not.toHaveClass("border-y")
        const reuseTerms = screen
            .getByRole("heading", { name: "Reuse terms" })
            .nextElementSibling
        expect(reuseTerms).toHaveClass("border-t")
        expect(reuseTerms).not.toHaveClass("border-y")
    })

    test("opens the full recent Product views page", () => {
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([
                {
                    identifier: "3017620422003",
                    name: "Nutella Spread 400g",
                    genericName: "Hazelnut spread",
                    brand: "Ferrero",
                    quantity: "400 g",
                    manufacturingPlace: "France",
                    packaging: "Glass jar",
                    labels: ["Vegetarian"],
                    timestamp: 1,
                },
            ]),
        )

        renderRoute("/search/recent")

        expect(
            screen.getByRole("heading", { name: "Products you viewed" }),
        ).toHaveFocus()
        expect(screen.getByText("Nutella Spread 400g")).toBeVisible()
        expect(screen.getByText("Ferrero")).toBeVisible()
        expect(screen.getByText("Hazelnut spread")).toBeVisible()
        expect(screen.getByText("400 g")).toBeVisible()
        expect(screen.getByText("Glass jar")).toBeVisible()
        expect(screen.getByText("Vegetarian")).toBeVisible()
        expect(screen.getByText("France")).toBeVisible()
        expect(screen.getByText("3017620422003")).toBeVisible()
        expect(screen.queryByRole("img")).not.toBeInTheDocument()
        expect(
            screen.queryByRole("navigation", { name: "Primary navigation" }),
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

    test("marks Compare as current in the bottom navigation on /compare", () => {
        renderRoute("/compare")

        expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()
    })
})
