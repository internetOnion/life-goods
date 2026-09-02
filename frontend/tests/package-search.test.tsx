import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import type {
    LifegoodsPackageSearchContractsPackageSearchResponse as PackageSearchResponse,
    LifegoodsPackageSearchContractsPackageSearchResultResponse as PackageSearchResultResponse,
    PackageSearchEvidenceResponse,
} from "../src/api/generated"
import { App } from "../src/app/App"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import type { PackageSearchLookup } from "../src/features/search/types"
import i18n from "../src/i18n"

const datasetVersion = {
    activated_at: "2026-08-30T00:00:00Z",
    id: "off-kh-2026-08",
    retrieved_at: "2026-08-29T00:00:00Z",
    sha256: "abc123",
    source_url: "https://world.openfoodfacts.org",
}

function evidence(
    sourceField: string,
    value: unknown,
    language: string | null = null,
): PackageSearchEvidenceResponse {
    return {
        dataset_version_id: datasetVersion.id,
        language,
        retrieved_at: datasetVersion.retrieved_at,
        source_field: sourceField,
        source_name: "Open Food Facts",
        source_revision: datasetVersion.sha256,
        source_url: "https://world.openfoodfacts.org/product/4006381333931",
        value,
    }
}

function product(identifier = "4006381333931"): PackageSearchResultResponse {
    return {
        identifier,
        source_kind: "OPEN_FOOD_FACTS",
        names: [evidence("product_name_en", "Coconut water", "en")],
        brands: evidence("brands", "Cambodia Harvest"),
        quantity: evidence("quantity", "330 ml"),
        manufacturing_place: evidence(
            "manufacturing_places",
            "Phnom Penh, Cambodia",
        ),
        reference_image: null,
    }
}

function page(
    results: PackageSearchResultResponse[],
    nextOffset: number | null = null,
): PackageSearchResponse {
    return {
        dataset_version: datasetVersion,
        next_offset: nextOffset,
        normalized_query: "coconut",
        results,
    }
}

function renderSearch(
    searchLookup: PackageSearchLookup,
    packageLookup: PackageMatchLookup = vi.fn<PackageMatchLookup>(),
) {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/search"]}>
                <App lookup={packageLookup} searchLookup={searchLookup} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("unified Product search", () => {
    beforeEach(async () => {
        sessionStorage.clear()
        await i18n.changeLanguage("en")
    })

    test("autofocuses, debounces, and renders source fields without brand", async () => {
        const user = userEvent.setup()
        const searchLookup = vi
            .fn<PackageSearchLookup>()
            .mockResolvedValue(page([product()]))
        renderSearch(searchLookup)

        const input = screen.getByRole("searchbox", {
            name: "Search Products",
        })
        expect(input).toHaveFocus()

        await user.type(input, "coconut")
        expect(searchLookup).not.toHaveBeenCalled()

        await waitFor(() =>
            expect(searchLookup).toHaveBeenCalledWith(
                "coconut",
                0,
                expect.any(AbortSignal),
            ),
        )

        expect(await screen.findByText("Coconut water")).toBeVisible()
        expect(screen.getByText("330 ml")).toBeVisible()
        expect(screen.getByText("Phnom Penh, Cambodia")).toBeVisible()
        expect(screen.getByText("No image")).toBeVisible()
        expect(screen.queryByText("Cambodia Harvest")).not.toBeInTheDocument()
        expect(screen.getByText(/Open Food Facts community data/)).toBeVisible()
    })

    test("stores a deduplicated session recent only when a result opens", async () => {
        const user = userEvent.setup()
        const searchLookup = vi
            .fn<PackageSearchLookup>()
            .mockResolvedValue(page([product()]))
        const packageLookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
            open_food_facts: {
                status: "NOT_FOUND",
                dataset_version: null,
                error_code: null,
            },
        })
        renderSearch(searchLookup, packageLookup)

        const input = screen.getByRole("searchbox", {
            name: "Search Products",
        })
        await user.type(input, "Coconut")
        await user.click(
            await screen.findByRole("button", {
                name: "Open package information for Coconut water",
            }),
        )

        expect(
            await screen.findByRole("heading", {
                name: "No package information found",
            }),
        ).toBeVisible()
        await user.click(
            screen.getByRole("button", { name: "Try another barcode" }),
        )
        await user.click(screen.getByRole("button", { name: "Clear search" }))

        expect(
            screen.getByRole("button", { name: "Search for Coconut again" }),
        ).toBeVisible()
        expect(
            JSON.parse(sessionStorage.getItem("lifegoods.recentSearches.v1")!),
        ).toEqual(["Coconut"])

        await user.click(screen.getByRole("button", { name: "Clear all" }))
        expect(screen.queryByText("Recent searches")).not.toBeInTheDocument()
        expect(sessionStorage.getItem("lifegoods.recentSearches.v1")).toBeNull()
    })

    test("paginates results and reports an empty result set", async () => {
        const user = userEvent.setup()
        const searchLookup = vi
            .fn<PackageSearchLookup>()
            .mockResolvedValueOnce(page([product()], 12))
            .mockResolvedValueOnce(page([product("42104964")]))
        renderSearch(searchLookup)

        await user.type(
            screen.getByRole("searchbox", { name: "Search Products" }),
            "coconut",
        )
        await user.click(
            await screen.findByRole("button", { name: "Show more results" }),
        )

        await waitFor(() =>
            expect(searchLookup).toHaveBeenLastCalledWith(
                "coconut",
                12,
                expect.any(AbortSignal),
            ),
        )
        expect(
            screen.getAllByRole("button", {
                name: "Open package information for Coconut water",
            }),
        ).toHaveLength(2)
    })

    test("cancels a stale request when the debounced query changes", async () => {
        const user = userEvent.setup()
        let firstSignal: AbortSignal | undefined
        const searchLookup = vi.fn<PackageSearchLookup>(
            (query, _offset, signal) => {
                if (query === "milk") {
                    firstSignal = signal
                    return new Promise((_resolve, reject) => {
                        signal?.addEventListener("abort", () =>
                            reject(new DOMException("Aborted", "AbortError")),
                        )
                    })
                }
                return Promise.resolve(page([product()]))
            },
        )
        renderSearch(searchLookup)

        const input = screen.getByRole("searchbox", {
            name: "Search Products",
        })
        await user.type(input, "milk")
        await waitFor(() => expect(firstSignal).toBeDefined())

        await user.clear(input)
        await user.type(input, "coconut")

        expect(await screen.findByText("Coconut water")).toBeVisible()
        expect(firstSignal?.aborted).toBe(true)
    })

    test("distinguishes rate limiting and no matches", async () => {
        const user = userEvent.setup()
        const searchLookup = vi.fn<PackageSearchLookup>().mockRejectedValue({
            error: { code: "RATE_LIMIT_EXCEEDED" },
        })
        const view = renderSearch(searchLookup)

        await user.type(
            screen.getByRole("searchbox", { name: "Search Products" }),
            "milk",
        )
        expect(
            await screen.findByRole("heading", { name: "Too many searches" }),
        ).toBeVisible()

        view.unmount()
        const emptyLookup = vi
            .fn<PackageSearchLookup>()
            .mockResolvedValue(page([]))
        renderSearch(emptyLookup)
        await user.type(
            screen.getByRole("searchbox", { name: "Search Products" }),
            "missing",
        )
        expect(
            await screen.findByRole("heading", { name: "No Products found" }),
        ).toBeVisible()
    })

    test("replaces a failed image and missing fields with explicit placeholders", async () => {
        const user = userEvent.setup()
        const sparse = product()
        sparse.quantity = null
        sparse.manufacturing_place = null
        sparse.reference_image = {
            attribution: "Open Food Facts contributors",
            dataset_version_id: datasetVersion.id,
            image_revision: null,
            language: "en",
            license_name: "CC BY-SA",
            original_url: "https://images.openfoodfacts.org/broken.jpg",
            retrieved_at: datasetVersion.retrieved_at,
            role: "front",
            source_field: "image_front_url",
            source_name: "Open Food Facts",
            source_revision: datasetVersion.sha256,
            source_url: "https://world.openfoodfacts.org/product/4006381333931",
            url: "/api/v1/open-food-facts-images?url=broken",
        }
        renderSearch(
            vi.fn<PackageSearchLookup>().mockResolvedValue(page([sparse])),
        )

        await user.type(
            screen.getByRole("searchbox", { name: "Search Products" }),
            "coconut",
        )
        fireEvent.error(
            await screen.findByRole("img", {
                name: "Reference package image for Coconut water",
            }),
        )

        expect(screen.getByText("No image")).toBeVisible()
        expect(
            screen.getByText("Quantity unavailable from source"),
        ).toBeVisible()
        expect(
            screen.getByText("Manufacturing place unavailable from source"),
        ).toBeVisible()
    })

    test("clears search query with clear button or Escape key and uses primary navigation for scan tab", async () => {
        const user = userEvent.setup()
        const searchLookup = vi.fn<PackageSearchLookup>()
        renderSearch(searchLookup)

        const input = screen.getByRole("searchbox", { name: "Search Products" })
        expect(input).toHaveValue("")
        expect(
            screen.queryByRole("button", { name: "Clear search" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Back to Scan" }),
        ).not.toBeInTheDocument()

        // Type query to reveal clear button
        await user.type(input, "coconut")
        expect(input).toHaveValue("coconut")
        const clearButton = screen.getByRole("button", { name: "Clear search" })
        expect(clearButton).toBeVisible()

        // Clicking clear button clears query
        await user.click(clearButton)
        expect(input).toHaveValue("")
        expect(
            screen.queryByRole("button", { name: "Clear search" }),
        ).not.toBeInTheDocument()

        // Pressing Escape on non-empty query clears it
        await user.type(input, "tea")
        expect(input).toHaveValue("tea")
        await user.keyboard("{Escape}")
        expect(input).toHaveValue("")

        // Navigation back to Scan is handled via primary navigation
        const scanTab = screen.getByRole("link", { name: "Scan" })
        expect(scanTab).toBeVisible()
        await user.click(scanTab)
        expect(
            await screen.findByRole("heading", {
                name: "Before the camera starts",
            }),
        ).toBeVisible()
    })
})
