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
    packageMatchesResponse,
    sparseOffCandidate,
} from "./package-match-fixtures"

function renderJourney(lookup: PackageMatchLookup, path = "/search") {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    })
    return {
        ...render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[path]}>
                    <App lookup={lookup} />
                </MemoryRouter>
            </QueryClientProvider>,
        ),
        queryClient,
    }
}

describe("identifier search journey", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    beforeEach(async () => {
        await i18n.changeLanguage("km")
    })

    test("keeps incomplete and invalid barcodes local with Khmer guidance", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        renderJourney(lookup)

        const input = screen.getByRole("searchbox", {
            name: "ស្វែងរកផលិតផល",
        })
        await user.type(input, "1234")
        expect(await screen.findByText("បញ្ចូលលេខបាកូដទាំងមូល។")).toBeVisible()

        await user.clear(input)
        await user.type(input, "12345678")
        expect(
            await screen.findByText(
                "ខ្ទង់ត្រួតពិនិត្យរបស់លេខបាកូដមិនត្រឹមត្រូវទេ។",
            ),
        ).toBeVisible()
        expect(input).toHaveAttribute("aria-invalid", "true")
        expect(input).toHaveFocus()
        expect(
            screen.getByRole("navigation", { name: "ការរុករកចម្បង" }),
        ).toBeVisible()
        expect(lookup).not.toHaveBeenCalled()
    })

    test("uses a labeled language control on Scan and keeps other routes focused", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        renderJourney(lookup, "/")

        expect(screen.getByRole("banner")).toBeVisible()
        const languageSwitch = screen.getByRole("button", {
            name: "ប្តូរទៅភាសាអង់គ្លេស",
        })
        expect(
            screen.getByRole("link", { name: "បើកការស្វែងរកផលិតផល" }),
        ).toHaveAttribute("href", "/search")
        const khmerFlag = languageSwitch.querySelector(
            '[data-language-flag="km"]',
        )
        expect(khmerFlag).toBeInTheDocument()
        expect(khmerFlag).toHaveAttribute("src", "/flags/cambodia.svg")
        expect(languageSwitch).toHaveClass("min-h-11", "min-w-11")

        expect(screen.getByRole("link", { name: "ស្កេន" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        await user.click(languageSwitch)
        const englishLanguageSwitch = screen.getByRole("button", {
            name: "Switch to Khmer",
        })
        const englishFlag = englishLanguageSwitch.querySelector(
            '[data-language-flag="en"]',
        )
        expect(englishFlag).toBeInTheDocument()
        expect(englishFlag).toHaveAttribute("src", "/flags/united-kingdom.svg")

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

        const input = screen.getByRole("searchbox", {
            name: "ស្វែងរកផលិតផល",
        })
        await user.type(input, "4 006381 333931")

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
        expect(screen.getByRole("banner")).toBeVisible()
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        expect(document.querySelector("[inert]")).not.toBeInTheDocument()
        expect(document.body).not.toHaveClass("overflow-hidden")
        expect(
            screen.queryByRole("button", { name: "ប្តូរទៅភាសាអង់គ្លេស" }),
        ).not.toBeInTheDocument()

        await user.click(
            screen.getByRole("button", { name: "សាកល្បងបាកូដផ្សេង" }),
        )
        const restoredInput = await screen.findByRole("searchbox", {
            name: "ស្វែងរកផលិតផល",
        })
        expect(restoredInput).toHaveValue("4 006381 333931")
        expect(restoredInput).toHaveFocus()
        expect(document.body).not.toHaveClass("overflow-hidden")
    })

    test("renders results as a focused full-screen route", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockResolvedValue(packageMatchesResponse())
        renderJourney(lookup)

        await user.type(
            screen.getByRole("searchbox", { name: "Search Products" }),
            "4006381333931",
        )
        await screen.findByRole("heading", {
            name: "No package information found",
        })

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        expect(
            screen.queryByText("Collapse product details"),
        ).not.toBeInTheDocument()
        expect(screen.getByRole("banner")).toBeVisible()
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
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
            screen.getByRole("searchbox", { name: "Search Products" }),
            "4 006381 333931",
        )

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
        expect(screen.getByRole("heading", { name: "Allergens" })).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "Nutrition facts" }),
        ).toBeVisible()
    })

    test("closes the focused result with Escape and restores the Search query", async () => {
        await i18n.changeLanguage("en")
        const user = userEvent.setup()
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockResolvedValue(packageMatchesResponse())
        renderJourney(lookup)

        const input = screen.getByRole("searchbox", {
            name: "Search Products",
        })
        await user.type(input, "4006381333931")
        await screen.findByRole("heading", {
            name: "No package information found",
        })

        await user.keyboard("{Escape}")
        const restoredInput = await screen.findByRole("searchbox", {
            name: "Search Products",
        })
        expect(restoredInput).toHaveValue("4006381333931")
        expect(restoredInput).toHaveFocus()
        expect(screen.getByRole("navigation")).toBeVisible()
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
            screen.getByRole("searchbox", { name: "ស្វែងរកផលិតផល" }),
            "8850000000003",
        )

        expect(
            await screen.findByRole("heading", {
                name: "មិនបានរាយព័ត៌មាននេះ",
            }),
        ).toHaveFocus()
        expect(
            screen.getAllByText("មិនបានរាយព័ត៌មាននេះ").length,
        ).toBeGreaterThan(5)

        await i18n.changeLanguage("en")
        expect(
            await screen.findByRole("heading", {
                name: "Information not mentioned",
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
            screen.getByRole("searchbox", { name: "Search Products" }),
            "4006381333931",
        )

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
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockResolvedValue(
                packageMatchesResponse([
                    reviewedCandidate,
                    completeOffCandidate(),
                ]),
            )
        renderJourney(lookup)

        await user.type(
            screen.getByRole("searchbox", { name: "Search Products" }),
            "4006381333931",
        )

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
            screen.getByRole("searchbox", { name: "ស្វែងរកផលិតផល" }),
            "4 006381 333931",
        )

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
                name: "មិនបានរាយព័ត៌មាននេះ",
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
            screen.getByRole("searchbox", { name: "Search Products" }),
            "4 006381 333931",
        )

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
            screen.getByRole("searchbox", { name: "Search Products" }),
            "4006381333931",
        )
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
            screen.getByRole("searchbox", { name: "Search Products" }),
            "4006381333931",
        )
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
