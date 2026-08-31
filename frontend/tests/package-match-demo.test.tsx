import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { createPackageMatchLookup } from "../src/features/package-match/api"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"
import { completeOffCandidate, packageMatches } from "./package-match-fixtures"

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }))

vi.mock("../src/features/package-match/barcodeScanner", () => ({
    barcodeScanner: { start: startMock },
}))

function renderJourney(
    lookup: PackageMatchLookup,
    demoMode: boolean,
    path = "/search",
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

describe("demo Package Match journey", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
        startMock.mockReset()
        startMock.mockResolvedValue({ stop: vi.fn() })
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia: vi.fn() },
        })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })
    })

    afterEach(() => vi.unstubAllGlobals())

    test("shows the complete demo result after manual identifier entry", async () => {
        const user = userEvent.setup()
        renderJourney(createPackageMatchLookup(true), true)

        await user.type(
            screen.getByRole("searchbox", { name: "Search Products" }),
            "42104964",
        )

        expect(
            await screen.findByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        expect(
            screen.getByRole("status", { name: "Demo data is active" }),
        ).toHaveTextContent(
            "This content is for demonstration only and is not real package information.",
        )
        expect(screen.getAllByText("42104964").length).toBeGreaterThan(0)
    })

    test("shows the complete demo result after a camera scan", async () => {
        const user = userEvent.setup()
        renderJourney(createPackageMatchLookup(true), true, "/")

        await user.click(screen.getByRole("button", { name: "Start camera" }))
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        const onResult = startMock.mock.calls[0]?.[1] as
            ((value: string) => void) | undefined
        expect(onResult).toBeDefined()

        act(() => onResult!("737628064502"))

        expect(
            await screen.findByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        expect(
            screen.getByRole("status", { name: "Demo data is active" }),
        ).toBeVisible()
        expect(screen.getAllByText("737628064502").length).toBeGreaterThan(0)
    })

    test("does not label a normal Package Match result as demo data", async () => {
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockResolvedValue(packageMatches(completeOffCandidate()))
        const user = userEvent.setup()
        renderJourney(lookup, false)

        await user.type(
            screen.getByRole("searchbox", { name: "Search Products" }),
            "4006381333931",
        )

        expect(
            await screen.findByRole("heading", { name: "Dark chocolate" }),
        ).toBeVisible()
        expect(
            screen.queryByRole("status", { name: "Demo data is active" }),
        ).not.toBeInTheDocument()
    })
})
