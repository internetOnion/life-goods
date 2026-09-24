import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { afterEach, describe, expect, test, vi } from "vitest"
import { waitFor } from "@testing-library/react"

import { App } from "../src/app/App"
import { LocaleProvider } from "../src/i18n/LocaleProvider"
import type { LabelReading, PhotoRole } from "../src/api/generated"
import { LabelReadingPage } from "../src/features/label-reading/LabelReadingPage"
import { PhotoComparisonApiError } from "../src/features/photo-evidence/api"
import type { PhotoQuality } from "../src/features/photo-evidence/imageQuality"
import { ProductPage } from "../src/features/product/ProductPage"
import type { ProductLookup } from "../src/features/product/api"
import { BarcodeEntryPage } from "../src/features/search/BarcodeEntryPage"
import { searchProducts } from "../src/features/search/api"
import { saveSelectedConcernIds } from "../src/features/concerns/storage"
import { productResponse } from "./product-fixtures"

vi.mock("../src/features/search/api", () => ({
    searchProducts: vi.fn(),
}))

const UNMATCHED_BARCODE = "4006381333931"

type ReadLabel = (
    photos: File[],
    roles: PhotoRole[],
    options?: { signal?: AbortSignal },
) => Promise<LabelReading>

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

function labelReadingFixture(overrides: Record<string, unknown> = {}) {
    return {
        schema_version: 1,
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
        ingredients: [
            {
                block_id: "ing_en",
                original_script:
                    "Ingredients: wheat flour, sugar, milk powder (5%), salt.",
                language: "en",
                state: "readable",
                evidence: [{ image_id: "img_1", region: null }],
            },
        ],
        allergen_statements: [
            {
                block_id: "stmt_1",
                kind: "may_contain",
                original_script: "May contain traces of peanuts.",
                language: "en",
                state: "readable",
                evidence: [{ image_id: "img_1", region: null }],
            },
        ],
        printed_facts: [
            {
                block_id: "fact_origin",
                kind: "country_of_origin",
                label: "Made in",
                original_script: "Thailand",
                language: "en",
                state: "readable",
                evidence: [{ image_id: "img_1", region: null }],
            },
        ],
        allergen_mentions: {
            state: "completed",
            mentions: [
                {
                    block_id: "ing_en",
                    matched_text: "wheat flour",
                    allergen_tags: ["en:gluten"],
                    qualification: "positive_mention",
                },
                {
                    block_id: "ing_en",
                    matched_text: "milk powder",
                    allergen_tags: ["en:milk"],
                    qualification: "positive_mention",
                },
                {
                    block_id: "stmt_1",
                    matched_text: "peanuts",
                    allergen_tags: ["en:peanuts"],
                    qualification: "precautionary_statement",
                },
            ],
            limitations: [],
        },
        configuration_version: "label-reading-v1",
        ...overrides,
    } as unknown as LabelReading
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
type DecodeBarcode = (
    photo: Blob,
    options?: { signal?: AbortSignal },
) => Promise<string | null>
type CheckQuality = (photo: Blob) => Promise<PhotoQuality | null>

function renderJourney(
    path: string,
    {
        lookup = vi.fn<ProductLookup>(),
        readLabel = vi.fn<ReadLabel>(),
        decodeBarcode = vi.fn<DecodeBarcode>().mockResolvedValue(null),
        checkQuality = vi.fn<CheckQuality>().mockResolvedValue(null),
    }: {
        lookup?: ProductLookup
        readLabel?: ReadLabel
        decodeBarcode?: DecodeBarcode
        checkQuality?: CheckQuality
    } = {},
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
                                    readLabel={readLabel}
                                    lookup={lookup}
                                    decodeBarcode={decodeBarcode}
                                    checkQuality={checkQuality}
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

function photoFile(name = "label.jpg") {
    return new File(["x"], name, { type: "image/jpeg" })
}

/** Library pick without a chosen step: fills the first empty steps in order. */
function addPhoto(name = "label.jpg") {
    addPhotos([photoFile(name)])
}

function addPhotos(files: File[]) {
    fireEvent.change(document.getElementById("label-reading-upload")!, {
        target: { files },
    })
}

function stepCard(step: "front" | "back" | "side") {
    return screen.getByTestId(`capture-step-${step}`)
}

async function submitReading(user: ReturnType<typeof userEvent.setup>) {
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
        const readLabel = vi
            .fn<ReadLabel>()
            .mockResolvedValue(labelReadingFixture())
        renderJourney(`/products/${UNMATCHED_BARCODE}`, {
            lookup,
            readLabel,
        })

        await user.click(
            await screen.findByRole("button", { name: "Read This Label" }),
        )
        await submitReading(user)

        expect(readLabel).toHaveBeenCalledTimes(1)
        const [photos, roles] = readLabel.mock.calls[0]!
        expect(roles).toEqual(["package_front"])
        expect(JSON.stringify(roles)).not.toContain(UNMATCHED_BARCODE)
        expect(photos.map((photo) => photo.name)).toEqual(["photo-1.jpg"])
        expect(photos.map((photo) => photo.name).join()).not.toContain(
            UNMATCHED_BARCODE,
        )
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

    test("states where photos go before any photo is taken, even without the hub", () => {
        renderJourney("/labels/read")

        expect(screen.getByTestId("provider-disclosure")).toBeVisible()
    })

    test("renders every printed column as Photo Evidence with no chooser", async () => {
        const user = userEvent.setup()
        const readLabel = vi
            .fn<ReadLabel>()
            .mockResolvedValue(labelReadingFixture())
        renderJourney("/labels/read", { readLabel })

        await submitReading(user)

        const reading = await screen.findByRole("region", {
            name: "Label Reading",
        })
        expect(within(reading).getByText("Photo Evidence")).toBeVisible()
        expect(
            within(reading).getByText(/not an Open Food Facts Source Record/),
        ).toBeVisible()
        // One table: a column per printed column, labelled with basis and state.
        const table = within(reading).getByRole("table")
        expect(
            within(table).getByRole("columnheader", {
                name: "Per 100 g · As sold",
            }),
        ).toBeVisible()
        expect(
            within(table).getByRole("columnheader", {
                name: "Per serving · As sold",
            }),
        ).toBeVisible()
        expect(within(reading).queryAllByRole("article")).toHaveLength(0)
        await user.click(
            within(reading).getByRole("button", { name: "How this was read" }),
        )
        expect(within(reading).getAllByRole("article")).toHaveLength(2)
        expect(screen.queryByRole("radio")).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Read again" })).toBeVisible()
    })

    test("describes field states about the photo, never as Source Data Unavailable", async () => {
        const user = userEvent.setup()
        renderJourney("/labels/read", {
            readLabel: vi
                .fn<ReadLabel>()
                .mockResolvedValue(labelReadingFixture()),
        })

        await submitReading(user)
        await screen.findByRole("region", { name: "Label Reading" })

        const table = screen.getByRole("table")
        expect(
            within(table).getByText("Not readable in your photo"),
        ).toBeVisible()
        expect(
            within(table).getByText("Not printed on the part you photographed"),
        ).toBeVisible()
        expect(
            within(table).getAllByText("Unclear in your photo"),
        ).toHaveLength(2)
        await user.click(
            screen.getByRole("button", { name: "How this was read" }),
        )
        expect(screen.getByText(/Conflicting values on label/)).toBeVisible()
        expect(
            screen.queryByText(/Source Data Unavailable/i),
        ).not.toBeInTheDocument()
    })

    test("carries no Source Attribution, score, or verdict", async () => {
        const user = userEvent.setup()
        renderJourney("/labels/read", {
            readLabel: vi
                .fn<ReadLabel>()
                .mockResolvedValue(labelReadingFixture()),
        })

        await submitReading(user)
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
        const readLabel = vi
            .fn<ReadLabel>()
            .mockRejectedValueOnce(
                new PhotoComparisonApiError(
                    "rate_limit_exceeded",
                    "The photo-extraction limit is 10 requests per minute.",
                ),
            )
            .mockResolvedValueOnce(labelReadingFixture())
        renderJourney("/labels/read", { readLabel })

        await submitReading(user)

        expect(await screen.findByRole("alert")).toBeVisible()
        expect(
            within(stepCard("front")).getByRole("button", { name: "Retake" }),
        ).toBeVisible()

        await user.click(screen.getByRole("button", { name: /Retry reading/i }))
        expect(
            await screen.findByRole("region", { name: "Label Reading" }),
        ).toBeVisible()
        expect(readLabel).toHaveBeenCalledTimes(2)
    })

    test("changing photos discards a late response for the old photos", async () => {
        const user = userEvent.setup()
        let resolveFirst: (value: LabelReading) => void = () => undefined
        const readLabel = vi.fn<ReadLabel>().mockImplementationOnce(
            () =>
                new Promise<LabelReading>((resolve) => {
                    resolveFirst = resolve
                }),
        )
        renderJourney("/labels/read", { readLabel })

        await submitReading(user)
        addPhoto("second.jpg")
        resolveFirst(labelReadingFixture())

        await Promise.resolve()
        expect(
            screen.queryByRole("region", { name: "Label Reading" }),
        ).not.toBeInTheDocument()
    })

    test("nothing survives leaving the page", async () => {
        const user = userEvent.setup()
        const first = renderJourney("/labels/read", {
            readLabel: vi
                .fn<ReadLabel>()
                .mockResolvedValue(labelReadingFixture()),
        })
        await submitReading(user)
        await screen.findByRole("region", { name: "Label Reading" })
        first.unmount()

        renderJourney("/labels/read")
        expect(
            screen.queryByRole("region", { name: "Label Reading" }),
        ).not.toBeInTheDocument()
        expect(
            within(stepCard("front")).queryByRole("button", {
                name: "Retake",
            }),
        ).not.toBeInTheDocument()
        expect(window.sessionStorage.length).toBe(0)
        expect(
            Object.keys(window.localStorage).filter(
                (key) => key !== "lifegoods.locale.v1",
            ),
        ).toEqual([])
    })
})

describe("Guided label capture (SPEC §29.1-29.2)", () => {
    const MATCHED_BARCODE = "8850999320014"

    test("offers front, back, and an optional side panel, in that order", () => {
        renderJourney("/labels/read")

        const steps = within(
            screen.getByRole("list", { name: "Label photos" }),
        ).getAllByRole("listitem")
        expect(steps.map((step) => step.getAttribute("data-testid"))).toEqual([
            "capture-step-front",
            "capture-step-back",
            "capture-step-side",
        ])
        expect(within(stepCard("side")).getByText("Optional")).toBeVisible()
        expect(
            within(stepCard("front")).queryByText("Optional"),
        ).not.toBeInTheDocument()
        expect(screen.getByText(/Add at least one photo/)).toBeVisible()
    })

    test("a multi-photo library pick fills the steps and reports what did not fit", () => {
        renderJourney("/labels/read")

        addPhotos([1, 2, 3, 4].map((n) => photoFile(`IMG_${n}.jpg`)))

        for (const step of ["front", "back", "side"] as const) {
            expect(
                within(stepCard(step)).getByRole("button", { name: "Retake" }),
            ).toBeVisible()
        }
        expect(screen.getByRole("alert")).toHaveTextContent(/3/)
    })

    test("submits photos in step order with neutral filenames", async () => {
        const user = userEvent.setup()
        const readLabel = vi
            .fn<ReadLabel>()
            .mockResolvedValue(labelReadingFixture())
        renderJourney("/labels/read", { readLabel })

        // Pick the back first, then the front: the upload still follows step order.
        await user.click(
            within(stepCard("back")).getByRole("button", {
                name: "Choose from library",
            }),
        )
        addPhotos([photoFile(`${MATCHED_BARCODE}-back.png`)])
        await user.click(
            within(stepCard("front")).getByRole("button", {
                name: "Choose from library",
            }),
        )
        addPhotos([photoFile("front-of-pack.jpg")])
        await user.click(
            screen.getByRole("button", { name: "Read this label" }),
        )

        const [photos, roles] = readLabel.mock.calls[0]!
        expect(photos.map((photo) => photo.name)).toEqual([
            "photo-1.jpg",
            "photo-2.jpg",
        ])
        expect(roles).toEqual(["package_front", "package_back"])
    })

    test("removing a step's photo frees that step", async () => {
        const user = userEvent.setup()
        renderJourney("/labels/read")
        addPhoto()

        await user.click(
            screen.getByRole("button", {
                name: "Remove Front of package photo",
            }),
        )

        expect(
            within(stepCard("front")).getByRole("button", {
                name: "Take photo",
            }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Read this label" }),
        ).toBeDisabled()
    })

    test("quality hints are advisory and never block reading", async () => {
        renderJourney("/labels/read", {
            checkQuality: vi.fn<CheckQuality>().mockResolvedValue({
                metrics: { meanLuminance: 20, sharpness: 5, clippedShare: 0 },
                issues: ["dark", "blurry"],
            }),
        })
        addPhoto()

        expect(
            await within(stepCard("front")).findByText(/Looks dark/),
        ).toBeVisible()
        expect(
            within(stepCard("front")).getByText(/Looks blurry/),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Read this label" }),
        ).toBeEnabled()
    })

    test("a Barcode in a photo with a Source Record offers the Product page", async () => {
        const user = userEvent.setup()
        const lookup = vi
            .fn<ProductLookup>()
            .mockResolvedValue(productResponse())
        const readLabel = vi.fn<ReadLabel>()
        renderJourney("/labels/read", {
            lookup,
            readLabel,
            decodeBarcode: vi
                .fn<DecodeBarcode>()
                .mockResolvedValue(MATCHED_BARCODE),
        })
        addPhoto()

        const offer = await screen.findByTestId("product-page-offer")
        expect(offer).toHaveTextContent(MATCHED_BARCODE)
        // An English lookup only: a speculative Khmer lookup would spend translation.
        expect(lookup).toHaveBeenCalledWith(MATCHED_BARCODE)
        expect(readLabel).not.toHaveBeenCalled()

        await user.click(
            within(offer).getByRole("button", { name: "Open Product page" }),
        )
        expect(screen.getByTestId("location")).toHaveTextContent(
            `/products/${MATCHED_BARCODE}`,
        )
    })

    test("no offer when the decoded Barcode has no Source Record", async () => {
        const lookup = vi
            .fn<ProductLookup>()
            .mockRejectedValue({ status: 404, code: "product_not_found" })
        renderJourney("/labels/read", {
            lookup,
            decodeBarcode: vi
                .fn<DecodeBarcode>()
                .mockResolvedValue(MATCHED_BARCODE),
        })
        addPhoto()

        await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1))
        expect(
            screen.queryByTestId("product-page-offer"),
        ).not.toBeInTheDocument()
    })

    test("the Barcode the Shopper arrived with is never looked up again", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<ProductLookup>().mockRejectedValue({
            status: 404,
            code: "product_not_found",
        })
        const decodeBarcode = vi
            .fn<DecodeBarcode>()
            .mockResolvedValue(UNMATCHED_BARCODE)
        renderJourney(`/products/${UNMATCHED_BARCODE}`, {
            lookup,
            decodeBarcode,
        })
        await user.click(
            await screen.findByRole("button", { name: "Read This Label" }),
        )
        addPhoto()

        await waitFor(() => expect(decodeBarcode).toHaveBeenCalled())
        expect(lookup).toHaveBeenCalledTimes(1)
        expect(
            screen.queryByTestId("product-page-offer"),
        ).not.toBeInTheDocument()
    })

    test("keeping the reading dismisses the offer and still reads without the Barcode", async () => {
        const user = userEvent.setup()
        const readLabel = vi
            .fn<ReadLabel>()
            .mockResolvedValue(labelReadingFixture())
        renderJourney("/labels/read", {
            lookup: vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
            readLabel,
            decodeBarcode: vi
                .fn<DecodeBarcode>()
                .mockResolvedValue(MATCHED_BARCODE),
        })
        addPhoto()

        await user.click(
            await screen.findByRole("button", {
                name: "Keep reading the label",
            }),
        )
        await user.click(
            screen.getByRole("button", { name: "Read this label" }),
        )

        const [photos, roles] = readLabel.mock.calls[0]!
        expect(roles).toEqual(["package_front"])
        expect(photos.map((photo) => photo.name).join()).not.toContain(
            MATCHED_BARCODE,
        )
        expect(
            screen.queryByTestId("product-page-offer"),
        ).not.toBeInTheDocument()
    })

    test("the guided camera walks the steps with one stream and stops it on close", async () => {
        const user = userEvent.setup()
        const track = { stop: vi.fn() }
        const stream = { getTracks: () => [track] } as unknown as MediaStream
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })
        vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(
            undefined,
        )
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            drawImage: vi.fn(),
        } as unknown as CanvasRenderingContext2D)
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
            (callback) => {
                callback(new Blob(["photo"], { type: "image/jpeg" }))
            },
        )
        renderJourney("/labels/read")

        await user.click(
            within(stepCard("front")).getByRole("button", {
                name: "Take photo",
            }),
        )
        const dialog = await screen.findByRole("dialog")
        expect(within(dialog).getByText("Step 1 of 3")).toBeVisible()

        const video = within(dialog).getByLabelText("Live camera preview")
        await waitFor(() => expect(video).toHaveProperty("srcObject", stream))
        Object.defineProperty(video, "videoWidth", {
            configurable: true,
            value: 1200,
        })
        Object.defineProperty(video, "videoHeight", {
            configurable: true,
            value: 900,
        })
        video.dispatchEvent(new Event("loadedmetadata"))
        const shutter = within(dialog).getByRole("button", {
            name: "Take photo",
        })
        await waitFor(() => expect(shutter).toBeEnabled())
        await user.click(shutter)
        await user.click(
            await within(dialog).findByRole("button", {
                name: "Use this photo",
            }),
        )

        // Advanced to the back without renegotiating the camera.
        expect(await within(dialog).findByText("Step 2 of 3")).toBeVisible()
        expect(getUserMedia).toHaveBeenCalledTimes(1)
        expect(track.stop).not.toHaveBeenCalled()

        await user.click(within(dialog).getByRole("button", { name: "Skip" }))
        expect(await within(dialog).findByText("Step 3 of 3")).toBeVisible()
        await user.click(within(dialog).getByRole("button", { name: "Done" }))

        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        )
        expect(track.stop).toHaveBeenCalled()
        expect(
            within(stepCard("front")).getByRole("button", { name: "Retake" }),
        ).toBeVisible()
        expect(
            within(stepCard("back")).getByRole("button", {
                name: "Take photo",
            }),
        ).toBeVisible()
        vi.unstubAllGlobals()
    })
})

describe("Label Reading result (SPEC §29.5)", () => {
    async function showReading(reading = labelReadingFixture()) {
        const user = userEvent.setup()
        renderJourney("/labels/read", {
            readLabel: vi.fn<ReadLabel>().mockResolvedValue(reading),
        })
        await submitReading(user)
        return {
            user,
            region: await screen.findByRole("region", {
                name: "Label Reading",
            }),
        }
    }

    test("leads with printed ingredients, allergen wording, nutrition, and facts", async () => {
        const { region } = await showReading(
            labelReadingFixture({
                identity: {
                    brand: {
                        field_id: "brand",
                        value_text: "Wafer Co",
                        language: "en",
                        state: "readable",
                    },
                    name: {
                        field_id: "name",
                        value_text: "Crispy Wafer",
                        language: "en",
                        state: "readable",
                    },
                },
            }),
        )

        expect(within(region).getByText("Crispy Wafer")).toBeVisible()
        expect(within(region).getByText("Wafer Co")).toBeVisible()
        const ingredients = within(region).getByText(
            /^Ingredients: wheat flour, sugar/,
        )
        expect(ingredients).toHaveAttribute("lang", "en")
        const allergens = within(region).getByTestId("reading-allergens")
        expect(within(allergens).getByText("May contain")).toBeVisible()
        expect(
            within(allergens).getByText("May contain traces of peanuts."),
        ).toBeVisible()
        expect(within(region).getByText("Country of origin")).toBeVisible()
        expect(within(region).getByText("Thailand")).toBeVisible()
        expect(within(region).getByRole("table")).toBeVisible()
    })

    test("highlights selected allergens found in the text, never claiming absence", async () => {
        saveSelectedConcernIds(["milk", "peanuts", "celery"])
        const { region } = await showReading()

        const matches = within(region).getByTestId("reading-concern-matches")
        expect(matches).toHaveTextContent("Milk · Mentioned: milk powder")
        expect(matches).toHaveTextContent("Peanuts · May contain: peanuts")
        expect(matches).not.toHaveTextContent("Celery")
        expect(
            within(region).getByText(/Only text that could be read/),
        ).toBeVisible()
        expect(region).not.toHaveTextContent(
            /free of|free from|not found|none found|no allergens|safe/i,
        )
    })

    test("with no matches it states only what was checked", async () => {
        saveSelectedConcernIds(["celery"])
        const { region } = await showReading()

        expect(
            within(region).queryByTestId("reading-concern-matches"),
        ).not.toBeInTheDocument()
        expect(
            within(region).getByText(/Only text that could be read/),
        ).toBeVisible()
        expect(region).not.toHaveTextContent(/free of|not found|none found/i)
    })

    test("non-English text is reported as not checked, not as clear", async () => {
        saveSelectedConcernIds(["milk"])
        const { region } = await showReading(
            labelReadingFixture({
                allergen_mentions: {
                    state: "not_checked",
                    reason: "no_english_printed_text",
                    mentions: [],
                    limitations: ["non_english_text_not_checked"],
                },
            }),
        )

        expect(
            within(region).getByText(/works on English text only/),
        ).toBeVisible()
        expect(
            within(region).queryByText(/Only text that could be read/),
        ).not.toBeInTheDocument()
    })

    test("without selected allergens it links to choosing them", async () => {
        const { region } = await showReading()

        expect(
            within(region).getByRole("link", {
                name: "Choose allergens to highlight",
            }),
        ).toHaveAttribute("href", "/concerns")
    })

    test("uses Photo Evidence vocabulary only", async () => {
        const { region, user } = await showReading()
        await user.click(
            within(region).getByRole("button", { name: "How this was read" }),
        )

        expect(region).toHaveTextContent("label-reading-v1")
        expect(region).not.toHaveTextContent(
            /Source Data Unavailable|Original Text|Khmer Translation/,
        )
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
