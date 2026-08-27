import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { client } from "../src/api/generated/client.gen"
import { App } from "../src/app/App"
import type {
    PackageMatchCandidateResponse,
    PackageMatchesResponse,
} from "../src/api/generated"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import { lookupPackageMatches } from "../src/features/package-match/api"
import i18n from "../src/i18n"
import {
    completeOffCandidate,
    packageMatches,
    sparseOffCandidate,
} from "./package-match-fixtures"

function renderJourney(lookup: PackageMatchLookup) {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    })
    return {
        ...render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <App lookup={lookup} />
                </MemoryRouter>
            </QueryClientProvider>,
        ),
        queryClient,
    }
}

describe("manual identifier journey", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    beforeEach(async () => {
        await i18n.changeLanguage("km")
    })

    test("keeps blank and invalid input local with field-associated Khmer guidance", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        renderJourney(lookup)

        const input = screen.getByRole("textbox", { name: "លេខបាកូដ" })
        const showHintButton = screen.getByRole("button", {
            name: "បង្ហាញព័ត៌មានអំពីលេខបាកូដ",
        })
        expect(
            screen.queryByText(
                "គាំទ្រលេខ GTIN, EAN និង UPC ដែលមាន ៨, ១២, ១៣ ឬ ១៤ ខ្ទង់។ អ្នកអាចដាក់ដកឃ្លា ឬសញ្ញាដកបាន។",
            ),
        ).not.toBeInTheDocument()

        await user.click(showHintButton)
        expect(
            screen.getByText(
                "គាំទ្រលេខ GTIN, EAN និង UPC ដែលមាន ៨, ១២, ១៣ ឬ ១៤ ខ្ទង់។ អ្នកអាចដាក់ដកឃ្លា ឬសញ្ញាដកបាន។",
            ),
        ).toBeVisible()
        expect(input).toHaveAttribute("aria-describedby", "identifier-hint")
        await user.click(
            screen.getByRole("button", {
                name: "លាក់ព័ត៌មានអំពីលេខបាកូដ",
            }),
        )
        expect(
            screen.queryByText(
                "គាំទ្រលេខ GTIN, EAN និង UPC ដែលមាន ៨, ១២, ១៣ ឬ ១៤ ខ្ទង់។ អ្នកអាចដាក់ដកឃ្លា ឬសញ្ញាដកបាន។",
            ),
        ).not.toBeInTheDocument()
        expect(input).not.toHaveAttribute("aria-describedby")

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

    test("uses an active-language flag on home and keeps other routes headerless", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        renderJourney(lookup)

        expect(screen.queryByRole("banner")).not.toBeInTheDocument()
        expect(
            screen.queryByRole("link", { name: "ទៅទំព័រដើម LifeGoods" }),
        ).not.toBeInTheDocument()
        const languageSwitch = screen.getByRole("button", {
            name: "ប្តូរទៅភាសាអង់គ្លេស",
        })
        const flag = languageSwitch.querySelector('[data-language-flag="km"]')
        const input = screen.getByRole("textbox", { name: "លេខបាកូដ" })
        const submit = screen.getByRole("button", { name: "ពិនិត្យបាកូដ" })
        expect(languageSwitch.closest("form")).toBe(input.closest("form"))
        expect(languageSwitch.closest("form")).toContainElement(submit)
        expect(
            languageSwitch.compareDocumentPosition(submit) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
        expect(languageSwitch).toHaveClass("size-11", "border-0", "p-0")
        expect(flag).toBeInTheDocument()
        expect(flag).toHaveClass("size-full")
        expect(flag?.parentElement).toHaveClass(
            "size-9",
            "overflow-hidden",
            "rounded-full",
            "border",
        )

        expect(screen.getByRole("link", { name: "ទំព័រដើម" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        await user.click(languageSwitch)
        expect(
            screen
                .getByRole("button", { name: "Switch to Khmer" })
                .querySelector('[data-language-flag="en"]'),
        ).toBeInTheDocument()

        await user.click(screen.getByRole("link", { name: "Learn" }))

        expect(screen.getByRole("heading", { name: "Learn" })).toBeVisible()
        expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        expect(screen.queryByRole("banner")).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Switch to Khmer" }),
        ).not.toBeInTheDocument()
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
        ).toHaveFocus()
        expect(screen.getByRole("status")).toHaveTextContent(
            "រកមិនឃើញព័ត៌មានកញ្ចប់",
        )
        expect(lookup).toHaveBeenCalledWith("4006381333931")
        expect(screen.getAllByText("4006381333931").length).toBeGreaterThan(0)
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
        expect(screen.queryByRole("banner")).not.toBeInTheDocument()
        expect(screen.getByRole("dialog")).toHaveAccessibleName(
            "លទ្ធផលពិនិត្យបាកូដ",
        )
        expect(document.querySelector("[inert]")).toBeInTheDocument()
        expect(document.body).toHaveClass("overflow-hidden")
        expect(
            screen.queryByRole("button", { name: "ប្តូរទៅភាសាអង់គ្លេស" }),
        ).not.toBeInTheDocument()

        await user.click(
            screen.getByRole("button", { name: "សាកល្បងបាកូដផ្សេង" }),
        )
        const restoredInput = screen.getByRole("textbox", {
            name: "លេខបាកូដ",
        })
        expect(restoredInput).toHaveValue("4006381333931")
        expect(restoredInput).toHaveFocus()
        expect(document.body).not.toHaveClass("overflow-hidden")
    })

    test("renders a complete OFF match through the English journey", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify(packageMatches(completeOffCandidate())),
                {
                    status: 200,
                    headers: { "content-type": "application/json" },
                },
            ),
        )
        vi.stubGlobal("fetch", fetchMock)
        client.setConfig({
            baseUrl: "https://lifegoods.test",
            fetch: fetchMock,
        })
        renderJourney(lookupPackageMatches)

        await user.type(
            screen.getByRole("textbox", { name: "Barcode number" }),
            "4 006381 333931",
        )
        await user.click(screen.getByRole("button", { name: "Check barcode" }))

        expect(
            await screen.findByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        expect(screen.getByRole("status")).toHaveTextContent(
            "Open Food Facts package information is available",
        )
        const request = fetchMock.mock.calls[0]?.[0]
        expect(request).toBeInstanceOf(Request)
        expect((request as Request).url).toBe(
            "https://lifegoods.test/api/v1/package-matches?identifier=4006381333931",
        )
        expect(
            screen.getByText(
                "Community data from Open Food Facts—not yet reviewed by this project.",
            ),
        ).toBeVisible()
    })

    test("traps modal focus, closes with Escape, and restores barcode focus", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        renderJourney(lookup)

        const input = screen.getByRole("textbox", { name: "Barcode number" })
        await user.type(input, "4006381333931")
        await user.click(screen.getByRole("button", { name: "Check barcode" }))
        await screen.findByRole("heading", {
            name: "No package information found",
        })

        const lastAction = screen.getByRole("button", {
            name: "Try another barcode",
        })
        lastAction.focus()
        await user.tab()
        expect(
            screen.getByRole("button", { name: "Close result" }),
        ).toHaveFocus()

        await user.keyboard("{Escape}")
        const restoredInput = screen.getByRole("textbox", {
            name: "Barcode number",
        })
        expect(restoredInput).toHaveValue("4006381333931")
        expect(restoredInput).toHaveFocus()
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("keeps a sparse OFF match explicit while changing interface language", async () => {
        const user = userEvent.setup()
        const sparseCandidate = sparseOffCandidate({
            external_record_id: "8850000000003",
        })
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockResolvedValue(packageMatches(sparseCandidate))
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "លេខបាកូដ" }),
            "8850000000003",
        )
        await user.click(screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }))

        expect(
            await screen.findByRole("heading", {
                name: "មិនមានឈ្មោះកញ្ចប់ពី Open Food Facts",
            }),
        ).toHaveFocus()
        expect(
            screen.getAllByText("មិនមានពី Open Food Facts").length,
        ).toBeGreaterThan(4)

        await i18n.changeLanguage("en")
        expect(
            await screen.findByRole("heading", {
                name: "Package name unavailable from Open Food Facts",
            }),
        ).toBeVisible()
        expect(lookup).toHaveBeenCalledTimes(1)
    })

    test("presents the available identifiers for a reviewed catalog candidate", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        const reviewedCandidate: PackageMatchCandidateResponse = {
            ...completeOffCandidate(),
            source_kind: "REVIEWED_CATALOG",
            product_id: "product-1",
            package_variant_id: "variant-1",
        }
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockResolvedValue(packageMatches(reviewedCandidate))
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "Barcode number" }),
            "4006381333931",
        )
        await user.click(screen.getByRole("button", { name: "Check barcode" }))

        expect(
            await screen.findByRole("heading", {
                name: "A LifeGoods catalog record is available",
            }),
        ).toHaveFocus()
        expect(screen.getByText("product-1")).toBeVisible()
        expect(screen.getByText("variant-1")).toBeVisible()
        expect(
            screen.getByText(
                "This record does not yet contain a display name, image, quantity, or label evidence. Missing information does not mean the package makes no declaration.",
            ),
        ).toBeVisible()
        expect(
            screen.queryByText(
                "Community data from Open Food Facts—not yet reviewed by this project.",
            ),
        ).not.toBeInTheDocument()
    })

    test("asks the shopper to choose when several Package Matches are available", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        const reviewedCandidate: PackageMatchCandidateResponse = {
            ...completeOffCandidate(),
            source_kind: "REVIEWED_CATALOG",
            product_id: "product-1",
            package_variant_id: "variant-1",
            identity_evidence: [],
            label_evidence: [],
            reference_images: [],
        }
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [reviewedCandidate, completeOffCandidate()],
        })
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "Barcode number" }),
            "4006381333931",
        )
        await user.click(screen.getByRole("button", { name: "Check barcode" }))

        expect(
            await screen.findByRole("heading", {
                name: "Several Package Matches were found",
            }),
        ).toHaveFocus()
        expect(screen.getByText("LifeGoods reviewed catalog")).toBeVisible()
        expect(screen.getByText("Open Food Facts community data")).toBeVisible()

        await user.click(
            screen.getByRole("button", {
                name: /Dark chocolate Open Food Facts community data/,
            }),
        )
        expect(
            await screen.findByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        await user.click(
            screen.getByRole("button", { name: "Back to all candidates" }),
        )
        expect(
            screen.getByRole("heading", {
                name: "Several Package Matches were found",
            }),
        ).toHaveFocus()
        expect(lookup).toHaveBeenCalledTimes(1)
    })

    test("announces temporary failure and recovery in Khmer", async () => {
        const user = userEvent.setup()
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockRejectedValueOnce(new Error("provider unavailable"))
            .mockResolvedValueOnce(packageMatches(sparseOffCandidate()))
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "លេខបាកូដ" }),
            "4 006381 333931",
        )
        await user.click(screen.getByRole("button", { name: "ពិនិត្យបាកូដ" }))

        expect(
            await screen.findByRole("heading", {
                name: "មិនអាចពិនិត្យបានឥឡូវនេះ",
            }),
        ).toHaveFocus()
        expect(screen.getByRole("status")).toHaveTextContent(
            "មិនអាចពិនិត្យបានឥឡូវនេះ",
        )
        await user.click(screen.getByRole("button", { name: "ព្យាយាមម្ដងទៀត" }))
        expect(
            await screen.findByRole("heading", {
                name: "មិនមានឈ្មោះកញ្ចប់ពី Open Food Facts",
            }),
        ).toHaveFocus()
        expect(lookup).toHaveBeenNthCalledWith(1, "4006381333931")
        expect(lookup).toHaveBeenNthCalledWith(2, "4006381333931")
    })

    test("announces retry loading and preserves the normalized identifier", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        let resolveRetry: ((value: PackageMatchesResponse) => void) | undefined
        const retryResponse = new Promise<PackageMatchesResponse>((resolve) => {
            resolveRetry = resolve
        })
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockRejectedValueOnce(new Error("provider unavailable"))
            .mockReturnValueOnce(retryResponse)
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "Barcode number" }),
            "4 006381 333931",
        )
        await user.click(screen.getByRole("button", { name: "Check barcode" }))

        expect(
            await screen.findByRole("heading", {
                name: "Could not check right now",
            }),
        ).toHaveFocus()
        expect(screen.getByRole("status")).toHaveTextContent(
            "Could not check right now",
        )
        expect(screen.getAllByText("4006381333931").length).toBeGreaterThan(0)

        await user.click(screen.getByRole("button", { name: "Retry" }))
        expect(
            await screen.findByRole("heading", {
                name: "Checking package information…",
            }),
        ).toHaveFocus()
        expect(screen.getByRole("status")).toHaveTextContent(
            "Checking package information…",
        )

        expect(resolveRetry).toBeDefined()
        resolveRetry!(packageMatches(completeOffCandidate()))
        expect(
            await screen.findByRole("heading", { name: "Dark chocolate" }),
        ).toHaveFocus()
        expect(lookup).toHaveBeenNthCalledWith(1, "4006381333931")
        expect(lookup).toHaveBeenNthCalledWith(2, "4006381333931")
    })

    test("returns to a focused temporary failure when retry also fails", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        let rejectRetry: ((error: Error) => void) | undefined
        const retryResponse = new Promise<PackageMatchesResponse>(
            (_resolve, reject) => {
                rejectRetry = reject
            },
        )
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockRejectedValueOnce(new Error("provider unavailable"))
            .mockReturnValueOnce(retryResponse)
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "Barcode number" }),
            "4006381333931",
        )
        await user.click(screen.getByRole("button", { name: "Check barcode" }))
        await screen.findByRole("heading", {
            name: "Could not check right now",
        })

        await user.click(screen.getByRole("button", { name: "Retry" }))
        expect(
            await screen.findByRole("heading", {
                name: "Checking package information…",
            }),
        ).toHaveFocus()
        expect(rejectRetry).toBeDefined()
        rejectRetry!(new Error("still unavailable"))

        expect(
            await screen.findByRole("heading", {
                name: "Could not check right now",
            }),
        ).toHaveFocus()
        expect(
            screen.queryByText("No package information found"),
        ).not.toBeInTheDocument()
        expect(lookup).toHaveBeenNthCalledWith(2, "4006381333931")
    })

    test("keeps an existing result visible during a background refetch", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        let resolveRefresh:
            ((value: PackageMatchesResponse) => void) | undefined
        const refreshResponse = new Promise<PackageMatchesResponse>(
            (resolve) => {
                resolveRefresh = resolve
            },
        )
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockResolvedValueOnce(packageMatches(completeOffCandidate()))
            .mockReturnValueOnce(refreshResponse)
        const { queryClient } = renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "Barcode number" }),
            "4006381333931",
        )
        await user.click(screen.getByRole("button", { name: "Check barcode" }))
        await screen.findByRole("heading", { name: "Dark chocolate" })

        void queryClient.refetchQueries({
            queryKey: ["package-match", "4006381333931"],
        })
        await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2))
        expect(
            screen.getByRole("heading", { name: "Dark chocolate" }),
        ).toBeVisible()
        expect(
            screen.queryByRole("heading", {
                name: "Checking package information…",
            }),
        ).not.toBeInTheDocument()

        expect(resolveRefresh).toBeDefined()
        resolveRefresh!(packageMatches(completeOffCandidate()))
    })
})
