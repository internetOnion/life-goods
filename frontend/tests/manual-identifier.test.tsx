import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"

function renderJourney(lookup: PackageMatchLookup) {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <App lookup={lookup} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("manual identifier journey", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("km")
    })

    test("keeps blank and invalid input local with field-associated Khmer guidance", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        renderJourney(lookup)

        const input = screen.getByRole("textbox", { name: "លេខបាកូដ" })
        expect(
            screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }),
        ).toBeDisabled()

        await user.type(input, "{Enter}")
        expect(input).toHaveAccessibleErrorMessage("សូមបញ្ចូលលេខបាកូដ។")
        expect(input).toHaveFocus()

        await user.type(input, "1234")
        await user.click(screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }))

        expect(input).toHaveAccessibleErrorMessage(
            "ប្រវែងលេខបាកូដនេះមិនត្រូវបានគាំទ្រទេ។",
        )
        expect(input).toHaveFocus()
        expect(lookup).not.toHaveBeenCalled()
    })

    test("uses one language switch and localized bottom navigation placeholders", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        renderJourney(lookup)

        expect(screen.getByRole("link", { name: "ទំព័រដើម" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        await user.click(screen.getByRole("link", { name: "ស្វែងយល់" }))

        expect(screen.getByRole("heading", { name: "ស្វែងយល់" })).toBeVisible()
        expect(screen.getByRole("link", { name: "ស្វែងយល់" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        expect(screen.getAllByRole("button")).toHaveLength(1)
        await user.click(
            screen.getByRole("button", { name: "ប្តូរទៅភាសាអង់គ្លេស" }),
        )
        expect(screen.getByRole("heading", { name: "Learn" })).toBeVisible()
        expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute(
            "aria-current",
            "page",
        )
    })

    test("navigates to a normalized barcode result and calls the backend", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        renderJourney(lookup)

        const input = screen.getByRole("textbox", { name: "លេខបាកូដ" })
        await user.type(input, "4 006381 333931")
        await user.click(screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }))

        expect(
            await screen.findByRole("heading", {
                name: "រកមិនឃើញព័ត៌មានកញ្ចប់",
            }),
        ).toBeVisible()
        expect(lookup).toHaveBeenCalledWith("4006381333931")
        expect(screen.getAllByText("4006381333931").length).toBeGreaterThan(0)
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument()

        await user.click(
            screen.getByRole("button", { name: "ត្រឡប់ទៅទំព័រដើម" }),
        )
        expect(screen.getByRole("textbox", { name: "លេខបាកូដ" })).toHaveValue(
            "4006381333931",
        )
    })
})
