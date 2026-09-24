import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { afterEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { LocaleProvider } from "../src/i18n/LocaleProvider"
import {
    LABEL_READING_PRODUCT_ID,
    LabelReadingPage,
} from "../src/features/label-reading/LabelReadingPage"
import { PhotoComparisonApiError } from "../src/features/photo-evidence/api"
import type { Extraction } from "../src/features/photo-evidence/types"
import { ProductPage } from "../src/features/product/ProductPage"
import type { ProductLookup } from "../src/features/product/api"
import { BarcodeEntryPage } from "../src/features/search/BarcodeEntryPage"
import { searchProducts } from "../src/features/search/api"

vi.mock("../src/features/search/api", () => ({
    searchProducts: vi.fn(),
}))

const UNMATCHED_BARCODE = "4006381333931"

type ExtractPhotos = (
    productId: string,
    photos: File[],
    options?: { signal?: AbortSignal },
) => Promise<Extraction>

function field(
    id: string,
    nutrient: string,
    state: string,
    value: string | null,
    extra: Record<string, unknown> = {},
) {
    return {
        field_id: id,
        nutrient,
        label: nutrient,
        state,
        row_kind: "amount",
        qualifier: "exact",
        value_text: value,
        unit_text: value ? "g" : null,
        original_script: null,
        language: "en",
        evidence:
            state === "readable" ? [{ image_id: "img_1", region: null }] : [],
        ...extra,
    }
}

function readingExtraction(overrides: Record<string, unknown> = {}) {
    return {
        schema_version: 1,
        product_id: LABEL_READING_PRODUCT_ID,
        identity: null,
        images: [
            {
                image_id: "img_1",
                role: "submitted_photo",
                width: 800,
                height: 600,
            },
        ],
        package_quantity: null,
        nutrition_columns: [
            {
                column_id: "per100",
                basis: "per_100g",
                preparation_state: "as_sold",
                fields: [
                    field("f_fat", "fat", "readable", "12"),
                    field("f_sugar", "sugars", "unreadable", null),
                    field("f_salt", "salt", "not_visible", null),
                    field("f_fibre", "fiber", "ambiguous", null),
                    field("f_protein", "proteins", "conflicting", "3", {
                        alternatives: [{ value_text: "8", unit_text: "g" }],
                    }),
                ],
            },
            {
                column_id: "serving",
                basis: "per_serving",
                preparation_state: "as_sold",
                fields: [field("f_fat_s", "fat", "readable", "4")],
            },
        ],
        outcome: "partial",
        retake_reasons: ["The sugar row is blurred."],
        provider: "google",
        model: "gemini-3.8-flash",
        configuration_version: "photo-extraction-v3",
        ...overrides,
    } as unknown as Extraction
}

function LocationProbe() {
    const location = useLocation()
    return (
        <output data-testid="location">
            {location.pathname}
            {location.search}
        </output>
    )
}

/** Product page, Search and Read This Label in one router, with fakes injected. */
function renderJourney(
    path: string,
    {
        lookup = vi.fn<ProductLookup>(),
        extractPhotos = vi.fn<ExtractPhotos>(),
    }: { lookup?: ProductLookup; extractPhotos?: ExtractPhotos } = {},
) {
    window.localStorage.setItem("lifegoods.locale.v1", "en")
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <LocaleProvider>
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route
                            path="/products/:barcode"
                            element={<ProductPage lookup={lookup} />}
                        />
                        <Route path="/search" element={<BarcodeEntryPage />} />
                        <Route
                            path="/labels/read"
                            element={
                                <LabelReadingPage
                                    extractPhotos={extractPhotos}
                                />
                            }
                        />
                        <Route
                            path="*"
                            element={<div data-testid="elsewhere" />}
                        />
                    </Routes>
                    <LocationProbe />
                </MemoryRouter>
            </LocaleProvider>
        </QueryClientProvider>,
    )
}

function addPhoto(name = "label.jpg") {
    fireEvent.change(document.getElementById("label-reading-upload")!, {
        target: { files: [new File(["x"], name, { type: "image/jpeg" })] },
    })
}

async function readLabel(user: ReturnType<typeof userEvent.setup>) {
    addPhoto()
    await user.click(screen.getByRole("button", { name: "Read this label" }))
}

afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
})

describe("Read This Label from an Unmatched Barcode", () => {
    test("the 404 offers Read This Label first and carries the Barcode only in memory", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<ProductLookup>().mockRejectedValue({
            status: 404,
            code: "product_not_found",
        })
        renderJourney(`/products/${UNMATCHED_BARCODE}`, { lookup })

        expect(
            await screen.findByRole("heading", {
                name: "This Barcode has no Source Record",
            }),
        ).toBeVisible()
        const buttons = screen
            .getAllByRole("button")
            .map((button) => button.textContent)
        expect(buttons.indexOf("Read This Label")).toBeLessThan(
            buttons.indexOf("Scan Another Barcode"),
        )

        await user.click(
            screen.getByRole("button", { name: "Read This Label" }),
        )

        expect(screen.getByTestId("location")).toHaveTextContent(
            /^\/labels\/read$/,
        )
        expect(
            screen.getByRole("heading", { level: 1, name: "Read This Label" }),
        ).toBeVisible()
        expect(
            screen.getByTestId("unmatched-barcode-context"),
        ).toHaveTextContent(`Barcode ${UNMATCHED_BARCODE} has no Source Record`)
    })

    test("never sends the Barcode to the AI provider", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<ProductLookup>().mockRejectedValue({
            status: 404,
            code: "product_not_found",
        })
        const extractPhotos = vi
            .fn<ExtractPhotos>()
            .mockResolvedValue(readingExtraction())
        renderJourney(`/products/${UNMATCHED_BARCODE}`, {
            lookup,
            extractPhotos,
        })

        await user.click(
            await screen.findByRole("button", { name: "Read This Label" }),
        )
        await readLabel(user)

        expect(extractPhotos).toHaveBeenCalledTimes(1)
        const [productId, photos] = extractPhotos.mock.calls[0]!
        expect(productId).toBe(LABEL_READING_PRODUCT_ID)
        expect(productId).not.toContain(UNMATCHED_BARCODE)
        expect(photos.map((photo) => photo.name)).toEqual(["label.jpg"])
    })

    test("a Search Barcode miss offers the same next step", async () => {
        const user = userEvent.setup()
        vi.mocked(searchProducts).mockResolvedValue({
            results: [],
            nextCursor: null,
        })
        renderJourney("/search")

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            `${UNMATCHED_BARCODE}{Enter}`,
        )

        await screen.findByText("No Products found")
        await user.click(
            screen.getByRole("button", { name: "Read This Label" }),
        )
        expect(screen.getByTestId("location")).toHaveTextContent(
            /^\/labels\/read$/,
        )
        expect(screen.getByTestId("unmatched-barcode-context")).toBeVisible()
    })
})

describe("Read This Label as a standalone mode", () => {
    test("direct entry lands on capture with no Barcode context", () => {
        renderJourney("/labels/read")

        expect(
            screen.getByRole("heading", { level: 1, name: "Read This Label" }),
        ).toBeVisible()
        expect(
            screen.queryByTestId("unmatched-barcode-context"),
        ).not.toBeInTheDocument()
        expect(screen.getByTestId("location")).toHaveTextContent(
            /^\/labels\/read$/,
        )
    })

    test("leaves the provider statement to the Nutrition Labels hub", () => {
        renderJourney("/labels/read")
        addPhoto()

        expect(
            screen.queryByTestId("provider-disclosure"),
        ).not.toBeInTheDocument()
    })

    test("renders every printed column as Photo Evidence with no chooser", async () => {
        const user = userEvent.setup()
        const extractPhotos = vi
            .fn<ExtractPhotos>()
            .mockResolvedValue(readingExtraction())
        renderJourney("/labels/read", { extractPhotos })

        await readLabel(user)

        const reading = await screen.findByRole("region", {
            name: "Label Reading",
        })
        expect(within(reading).getByText("Photo Evidence")).toBeVisible()
        expect(
            within(reading).getByText(/not an Open Food Facts Source Record/),
        ).toBeVisible()
        expect(within(reading).getAllByRole("article")).toHaveLength(2)
        expect(within(reading).getByText("Per 100 g")).toBeVisible()
        expect(within(reading).getByText("Per serving")).toBeVisible()
        expect(screen.queryByRole("radio")).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Read again" })).toBeVisible()
    })

    test("describes field states about the photo, never as Source Data Unavailable", async () => {
        const user = userEvent.setup()
        renderJourney("/labels/read", {
            extractPhotos: vi
                .fn<ExtractPhotos>()
                .mockResolvedValue(readingExtraction()),
        })

        await readLabel(user)
        await screen.findByRole("region", { name: "Label Reading" })

        expect(screen.getByText("Not readable in your photo")).toBeVisible()
        expect(
            screen.getAllByText("Not printed on the part you photographed")
                .length,
        ).toBeGreaterThan(0)
        expect(screen.getByText("Unclear in your photo")).toBeVisible()
        expect(screen.getByText(/Conflicting values on label/)).toBeVisible()
        expect(
            screen.queryByText(/Source Data Unavailable/i),
        ).not.toBeInTheDocument()
    })

    test("carries no Source Attribution, score, or verdict", async () => {
        const user = userEvent.setup()
        renderJourney("/labels/read", {
            extractPhotos: vi
                .fn<ExtractPhotos>()
                .mockResolvedValue(readingExtraction()),
        })

        await readLabel(user)
        await screen.findByRole("region", { name: "Label Reading" })

        expect(
            screen.queryByText(/Data from Open Food Facts/i),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(
                /Nutri-Score|NOVA|Green-Score|winner|healthier/i,
            ),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("link", { name: "Compare Nutrition" }),
        ).toHaveAttribute("href", "/labels/compare")
    })

    test("a rate-limited read keeps the photos and can be retried", async () => {
        const user = userEvent.setup()
        const extractPhotos = vi
            .fn<ExtractPhotos>()
            .mockRejectedValueOnce(
                new PhotoComparisonApiError(
                    "rate_limit_exceeded",
                    "The photo-extraction limit is 10 requests per minute.",
                ),
            )
            .mockResolvedValueOnce(readingExtraction())
        renderJourney("/labels/read", { extractPhotos })

        await readLabel(user)

        expect(await screen.findByRole("alert")).toBeVisible()
        expect(screen.getByText("Photo 1")).toBeVisible()

        await user.click(screen.getByRole("button", { name: /Retry reading/i }))
        expect(
            await screen.findByRole("region", { name: "Label Reading" }),
        ).toBeVisible()
        expect(extractPhotos).toHaveBeenCalledTimes(2)
    })

    test("changing photos discards a late response for the old photos", async () => {
        const user = userEvent.setup()
        let resolveFirst: (value: Extraction) => void = () => undefined
        const extractPhotos = vi.fn<ExtractPhotos>().mockImplementationOnce(
            () =>
                new Promise<Extraction>((resolve) => {
                    resolveFirst = resolve
                }),
        )
        renderJourney("/labels/read", { extractPhotos })

        await readLabel(user)
        addPhoto("second.jpg")
        resolveFirst(readingExtraction())

        await Promise.resolve()
        expect(
            screen.queryByRole("region", { name: "Label Reading" }),
        ).not.toBeInTheDocument()
    })

    test("nothing survives leaving the page", async () => {
        const user = userEvent.setup()
        const first = renderJourney("/labels/read", {
            extractPhotos: vi
                .fn<ExtractPhotos>()
                .mockResolvedValue(readingExtraction()),
        })
        await readLabel(user)
        await screen.findByRole("region", { name: "Label Reading" })
        first.unmount()

        renderJourney("/labels/read")
        expect(
            screen.queryByRole("region", { name: "Label Reading" }),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Photo 1")).not.toBeInTheDocument()
        expect(window.sessionStorage.length).toBe(0)
        expect(
            Object.keys(window.localStorage).filter(
                (key) => key !== "lifegoods.locale.v1",
            ),
        ).toEqual([])
    })
})

describe("Nutrition Labels section", () => {
    function renderApp(path: string) {
        window.localStorage.setItem("lifegoods.locale.v1", "en")
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[path]}>
                    <App lookup={vi.fn<ProductLookup>()} />
                    <LocationProbe />
                </MemoryRouter>
            </QueryClientProvider>,
        )
    }

    test("the hub offers both modes as equals, with the provider statement", () => {
        renderApp("/labels")

        expect(
            screen.getByRole("heading", { level: 1, name: "Nutrition Labels" }),
        ).toBeVisible()
        expect(
            screen.getByRole("link", { name: /Read This Label/ }),
        ).toHaveAttribute("href", "/labels/read")
        expect(
            screen.getByRole("link", { name: /Compare Nutrition/ }),
        ).toHaveAttribute("href", "/labels/compare")
        expect(screen.getByTestId("provider-disclosure")).toBeVisible()
    })

    test("Read This Label navigates like Compare Nutrition", async () => {
        const user = userEvent.setup()
        renderApp("/labels/read")

        // The floating photo dock replaces primary navigation, as in Compare.
        expect(
            screen.queryByRole("navigation", { name: "Primary navigation" }),
        ).not.toBeInTheDocument()
        const dock = screen.getByRole("group", {
            name: "Photo capture navigation",
        })
        expect(
            within(dock).getByRole("button", { name: "Read this label" }),
        ).toBeDisabled()
        expect(screen.getByRole("button", { name: "Start over" })).toBeVisible()

        await user.click(
            within(dock).getByRole("button", { name: "Nutrition Labels" }),
        )
        expect(screen.getByTestId("location")).toHaveTextContent(/^\/labels$/)
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()
    })

    test.each([
        "/compare",
        "/photo-comparison",
        "/experimental/photo-comparison",
    ])("%s redirects to /labels/compare", (path) => {
        renderApp(path)
        expect(screen.getByTestId("location")).toHaveTextContent(
            /^\/labels\/compare$/,
        )
    })
})
