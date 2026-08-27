import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"

function renderRoute(
    path: string,
    lookup = vi.fn<PackageMatchLookup>(),
    demoMode = false,
) {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[path]}>
                <App lookup={lookup} demoMode={demoMode} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("app routes and shell", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test.each([
        ["/", "Scan with the camera"],
        ["/search", "Search"],
        ["/learn", "Learn"],
        ["/history", "History"],
        ["/allergies", "Allergies"],
    ])("registers the ordinary route %s", (path, heading) => {
        renderRoute(path)

        expect(screen.getByRole("heading", { name: heading })).toBeVisible()
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()
    })

    test("keeps the rectangular language switch above the capture camera", () => {
        const captureRender = renderRoute(
            "/capture/new?step=front",
            vi.fn<PackageMatchLookup>(),
            true,
        )

        const captureNavigation = screen.getByRole("navigation", {
            name: "Primary navigation",
        })
        const languageSwitch = screen.getByRole("button", {
            name: "Switch to Khmer",
        })
        expect(languageSwitch).toBeInTheDocument()
        expect(languageSwitch).toHaveClass("h-11", "w-14", "rounded-lg")
        expect(captureNavigation.querySelector("button")).toBeNull()

        captureRender.unmount()
        const placeholderRender = renderRoute("/capture/new")
        expect(
            screen.getByRole("button", { name: "Switch to Khmer" }),
        ).toHaveClass("h-11", "w-14", "rounded-lg")

        placeholderRender.unmount()
        renderRoute("/learn")

        const ordinaryNavigation = screen.getByRole("navigation", {
            name: "Primary navigation",
        })
        expect(ordinaryNavigation.querySelector("button")).toBeNull()

        renderRoute("/captures/capture-123")

        const captureResultNavigation = screen
            .getAllByRole("navigation", {
                name: "Primary navigation",
            })
            .at(-1)
        expect(captureResultNavigation?.querySelector("button")).toBeNull()
        expect(
            screen.getByRole("button", { name: "Switch to Khmer" }),
        ).toHaveClass("size-11", "rounded-full")
    })

    test("preserves the existing History placeholder", () => {
        renderRoute("/history")

        expect(
            screen.getByText(
                "Current-session scan history is not available in this version yet. LifeGoods does not require an account.",
            ),
        ).toBeVisible()
    })

    test("keeps bottom navigation and provides localized exit on new capture", async () => {
        const user = userEvent.setup()
        renderRoute("/capture/new")

        expect(
            screen.getByRole("heading", { name: "New Package Capture" }),
        ).toHaveFocus()
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()

        await user.click(
            screen.getByRole("button", { name: "Exit Package Capture" }),
        )
        expect(
            screen.getByRole("heading", { name: "Scan with the camera" }),
        ).toBeVisible()
    })

    test("keeps bottom navigation and returns capture results to capture start", async () => {
        const user = userEvent.setup()
        renderRoute("/captures/capture-123")

        expect(
            screen.getByRole("heading", { name: "Package Capture result" }),
        ).toHaveFocus()
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()

        await user.click(
            screen.getByRole("button", { name: "Back to Package Capture" }),
        )
        expect(
            screen.getByRole("heading", { name: "New Package Capture" }),
        ).toBeVisible()
    })

    test("keeps bottom navigation on Package Match result routes", async () => {
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        renderRoute("/results/4006381333931", lookup)

        expect(
            await screen.findByRole("heading", {
                name: "No package information found",
            }),
        ).toBeVisible()
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()
    })

    test("renders an explicit not-found page without redirecting", () => {
        renderRoute("/not-a-route")

        expect(
            screen.getByRole("heading", { name: "Page not found" }),
        ).toHaveFocus()
        expect(
            screen.getByRole("link", { name: "Go to Home" }),
        ).toHaveAttribute("href", "/")
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()
    })

    test("treats unmatched focused-route descendants as ordinary not-found routes", () => {
        renderRoute("/captures/capture-123/extra")

        expect(
            screen.getByRole("heading", { name: "Page not found" }),
        ).toBeVisible()
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()
    })

    test("keeps Khmer as the default and updates the document language", async () => {
        await i18n.changeLanguage("km")
        renderRoute("/learn")

        expect(screen.getByRole("heading", { name: "ស្វែងយល់" })).toBeVisible()
        expect(document.documentElement).toHaveAttribute("lang", "km")
    })
})
