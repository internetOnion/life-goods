import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"

function renderJourney(lookup: PackageMatchLookup) {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <App lookup={lookup} />
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

    test("normalizes a formatted identifier once and announces no Package Match", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "លេខបាកូដ" }),
            "4 006381 333931",
        )
        await user.click(screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }))

        expect(
            await screen.findByRole("heading", {
                name: "រកមិនឃើញព័ត៌មានកញ្ចប់",
            }),
        ).toBeVisible()
        expect(screen.getByText("4006381333931")).toBeVisible()
        expect(lookup).toHaveBeenCalledWith("4006381333931")
        expect(screen.getByRole("status")).toHaveTextContent(
            "រកមិនឃើញព័ត៌មានកញ្ចប់",
        )
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    })

    test("prevents duplicate submission while announcing progress", async () => {
        const user = userEvent.setup()
        let resolveLookup:
            | ((value: Awaited<ReturnType<PackageMatchLookup>>) => void)
            | undefined
        const lookup = vi.fn<PackageMatchLookup>().mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveLookup = resolve
                }),
        )
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "លេខបាកូដ" }),
            "4006381333931",
        )
        const submit = screen.getByRole("button", { name: "ពិនិត្យបាកូដ" })
        await user.dblClick(submit)

        expect(lookup).toHaveBeenCalledTimes(1)
        expect(screen.getByRole("status")).toHaveTextContent("កំពុងពិនិត្យ")
        expect(submit).toBeDisabled()

        resolveLookup?.({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        await waitFor(() =>
            expect(screen.getByText("4006381333931")).toBeVisible(),
        )
    })

    test("distinguishes temporary failure and retries the preserved identifier", async () => {
        const user = userEvent.setup()
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockRejectedValueOnce(new Error("unavailable"))
            .mockResolvedValueOnce({
                normalized_identifier: "4006381333931",
                scheme: "EAN_13",
                candidates: [],
            })
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "លេខបាកូដ" }),
            "4006381333931",
        )
        await user.click(screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }))

        expect(
            await screen.findByRole("heading", {
                name: "មិនអាចពិនិត្យបានឥឡូវនេះ",
            }),
        ).toBeVisible()
        expect(screen.getByText("4006381333931")).toBeVisible()
        await user.click(screen.getByRole("button", { name: "ព្យាយាមម្ដងទៀត" }))

        expect(
            await screen.findByRole("heading", {
                name: "រកមិនឃើញព័ត៌មានកញ្ចប់",
            }),
        ).toBeVisible()
        expect(lookup).toHaveBeenCalledTimes(2)
    })

    test("switches language without clearing input or outcome", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        renderJourney(lookup)

        const input = screen.getByRole("textbox", { name: "លេខបាកូដ" })
        await user.type(input, "4006381333931")
        await user.click(screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }))
        await screen.findByText("4006381333931")
        await user.click(screen.getByRole("button", { name: "English" }))

        expect(
            screen.getByRole("heading", {
                name: "No package information found",
            }),
        ).toBeVisible()
        await user.click(
            screen.getByRole("button", { name: "Try another barcode" }),
        )
        expect(
            screen.getByRole("textbox", { name: "Barcode number" }),
        ).toHaveValue("4006381333931")
    })

    test("preserves loading and failure state across language changes", async () => {
        const user = userEvent.setup()
        let rejectLookup: ((reason: Error) => void) | undefined
        const lookup = vi.fn<PackageMatchLookup>().mockImplementation(
            () =>
                new Promise((_resolve, reject) => {
                    rejectLookup = reject
                }),
        )
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "លេខបាកូដ" }),
            "4006381333931",
        )
        await user.click(screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }))
        await user.click(screen.getByRole("button", { name: "English" }))

        expect(screen.getByRole("status")).toHaveTextContent(
            "Checking package information",
        )
        expect(
            screen.getByRole("textbox", { name: "Barcode number" }),
        ).toHaveValue("4006381333931")

        rejectLookup?.(new Error("unavailable"))
        expect(
            await screen.findByRole("heading", {
                name: "Could not check right now",
            }),
        ).toBeVisible()
        await user.click(screen.getByRole("button", { name: "ខ្មែរ" }))
        expect(
            screen.getByRole("heading", { name: "មិនអាចពិនិត្យបានឥឡូវនេះ" }),
        ).toBeVisible()
        expect(screen.getByText("4006381333931")).toBeVisible()
    })
})
