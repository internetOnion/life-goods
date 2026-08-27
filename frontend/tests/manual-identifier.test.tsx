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
        expect(
            languageSwitch.querySelector('[data-language-flag="km"]'),
        ).toBeInTheDocument()

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
            open_food_facts: {
                status: "NOT_FOUND",
                dataset_version: null,
                error_code: null,
            },
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
        expect(
            screen.queryByRole("button", { name: "ប្តូរទៅភាសាអង់គ្លេស" }),
        ).not.toBeInTheDocument()

        await user.click(
            screen.getByRole("button", { name: "ត្រឡប់ទៅទំព័រដើម" }),
        )
        expect(screen.getByRole("textbox", { name: "លេខបាកូដ" })).toHaveValue(
            "4006381333931",
        )
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

    test("keeps non-OFF candidates out of the OFF result module", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        const reviewedCandidate: PackageMatchCandidateResponse = {
            ...completeOffCandidate(),
            source_kind: "REVIEWED_CATALOG",
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
                name: "Could not check right now",
            }),
        ).toHaveFocus()
        expect(
            screen.queryByText(
                "Community data from Open Food Facts—not yet reviewed by this project.",
            ),
        ).not.toBeInTheDocument()
    })

    test("does not fall back to reviewed candidates when OFF is unavailable", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        const reviewedCandidate: PackageMatchCandidateResponse = {
            ...completeOffCandidate(),
            source_kind: "REVIEWED_CATALOG",
        }
        const response = packageMatches(reviewedCandidate)
        response.open_food_facts = {
            status: "UNAVAILABLE",
            dataset_version: null,
            error_code: "DATASET_UNAVAILABLE",
        }
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue(response)
        renderJourney(lookup)

        await user.type(
            screen.getByRole("textbox", { name: "Barcode number" }),
            "4006381333931",
        )
        await user.click(screen.getByRole("button", { name: "Check barcode" }))

        expect(
            await screen.findByRole("heading", {
                name: "Could not check right now",
            }),
        ).toHaveFocus()
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
