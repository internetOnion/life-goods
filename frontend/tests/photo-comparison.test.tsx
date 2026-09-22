import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation, useNavigate } from "react-router"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { CameraCaptureSheet } from "../src/features/photo-comparison/CameraCaptureSheet"
import { ComparisonSection } from "../src/features/photo-comparison/ComparisonSection"
import { PhotoComparisonApiError } from "../src/features/photo-comparison/api"
import {
    displayValue,
    formatActionableError,
    formatNutrientName,
    isReadablePhotoFile,
    pickDefaultColumnId,
} from "../src/features/photo-comparison/helpers"
import { LocaleContext } from "../src/i18n/locale"
import { PhotoComparisonPage } from "../src/features/photo-comparison/PhotoComparisonPage"
import { PhotoInspectionModal } from "../src/features/photo-comparison/PhotoInspectionModal"
import { ProductPhotoPanel } from "../src/features/photo-comparison/ProductPhotoPanel"
import type {
    ComparisonRequest,
    ComparisonResponse,
    Extraction,
    ProductSideState,
} from "../src/features/photo-comparison/types"
import type { ProductLookup } from "../src/features/product/api"

function renderRoute(path: string, lookup = vi.fn<ProductLookup>()) {
    window.localStorage.setItem("lifegoods.locale.v1", "en")

    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[path]}>
                <App lookup={lookup} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

function ComparisonNavigationProbe() {
    const location = useLocation()
    const navigate = useNavigate()
    return (
        <>
            <output data-testid="comparison-url">
                {location.pathname}
                {location.search}
            </output>
            <button
                onClick={() => {
                    void navigate(-1)
                }}
            >
                Browser Back
            </button>
            <button
                onClick={() => {
                    void navigate(1)
                }}
            >
                Browser Forward
            </button>
        </>
    )
}

function openCompareReview(user: ReturnType<typeof userEvent.setup>) {
    void user
    return Promise.resolve(
        screen.getByRole("button", { name: "Compare Products" }),
    )
}

describe("CameraCaptureSheet", () => {
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(
            undefined,
        )
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    function markVideoReady(video: HTMLElement) {
        const videoElement = video as HTMLVideoElement
        Object.defineProperty(videoElement, "videoWidth", {
            configurable: true,
            value: 1200,
        })
        Object.defineProperty(videoElement, "videoHeight", {
            configurable: true,
            value: 900,
        })
        videoElement.dispatchEvent(new Event("loadedmetadata"))
    }

    test("captures a still from the rear camera and supports retaking it", async () => {
        const user = userEvent.setup()
        const onCapture = vi.fn()
        const track = { stop: vi.fn() }
        const stream = {
            getTracks: () => [track],
        } as unknown as MediaStream
        const getUserMedia = vi.fn().mockResolvedValue(stream)

        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            drawImage: vi.fn(),
        } as unknown as CanvasRenderingContext2D)
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
            (callback) => {
                callback(new Blob(["photo"], { type: "image/jpeg" }))
            },
        )

        render(
            <CameraCaptureSheet
                isOpen
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={onCapture}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )

        const constraints = getUserMedia.mock.calls[0]?.[0] as
            MediaStreamConstraints | undefined
        expect(constraints?.video).toMatchObject({
            facingMode: { ideal: "environment" },
        })

        const video = screen.getByLabelText("Live camera preview")
        await waitFor(() => expect(video).toHaveProperty("srcObject", stream))
        expect(video).toHaveProperty("srcObject", stream)
        markVideoReady(video)
        const takePhoto = await screen.findByRole("button", {
            name: "Take photo",
        })
        await waitFor(() => expect(takePhoto).toBeEnabled())

        await user.click(takePhoto)
        expect(
            await screen.findByRole("button", { name: "Use this photo" }),
        ).toBeInTheDocument()

        await user.click(screen.getByRole("button", { name: "Retake" }))
        await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))

        const retakeVideo = screen.getByLabelText("Live camera preview")
        await waitFor(() =>
            expect(retakeVideo).toHaveProperty("srcObject", stream),
        )
        markVideoReady(retakeVideo)
        const retakeButton = await screen.findByRole("button", {
            name: "Take photo",
        })
        await waitFor(() => expect(retakeButton).toBeEnabled())
        await user.click(retakeButton)
        await user.click(
            await screen.findByRole("button", { name: "Use this photo" }),
        )

        expect(onCapture).toHaveBeenCalledTimes(1)
        expect(onCapture.mock.calls[0]?.[0]).toEqual(expect.any(File))
        expect(onCapture.mock.calls[0]?.[0]).toHaveProperty(
            "type",
            "image/jpeg",
        )
        expect(track.stop).toHaveBeenCalled()
    })

    test("keeps the video mounted and gates capture until metadata is ready", async () => {
        const track = { stop: vi.fn() }
        const stream = {
            getTracks: () => [track],
        } as unknown as MediaStream
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })

        render(
            <CameraCaptureSheet
                isOpen
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )

        const video = screen.getByLabelText("Live camera preview")
        const takePhoto = screen.getByRole("button", { name: "Take photo" })
        expect(video).toBeInTheDocument()
        expect(takePhoto).toBeDisabled()

        await waitFor(() => expect(video).toHaveProperty("srcObject", stream))
        expect(takePhoto).toBeDisabled()

        markVideoReady(video)
        await waitFor(() => expect(takePhoto).toBeEnabled())
    })

    test("surfaces toBlob failures with retry and recovery actions", async () => {
        const user = userEvent.setup()
        const track = { stop: vi.fn() }
        const stream = {
            getTracks: () => [track],
        } as unknown as MediaStream
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            drawImage: vi.fn(),
        } as unknown as CanvasRenderingContext2D)
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
            (callback) => callback(null),
        )

        render(
            <CameraCaptureSheet
                isOpen
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )

        const video = screen.getByLabelText("Live camera preview")
        await waitFor(() => expect(video).toHaveProperty("srcObject", stream))
        markVideoReady(video)
        const takePhoto = screen.getByRole("button", { name: "Take photo" })
        await waitFor(() => expect(takePhoto).toBeEnabled())
        await user.click(takePhoto)

        expect(
            await screen.findByText("Photo capture failed"),
        ).toBeInTheDocument()
        expect(
            screen.getByText(/camera could not create a photo/i),
        ).toHaveAttribute("role", "alert")
        expect(
            screen.getByRole("button", { name: "Try again" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Use device camera" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: /Choose from library/i }),
        ).toBeInTheDocument()
    })

    test("stops a late stream when the sheet closes before camera startup resolves", async () => {
        let resolveCamera: (stream: MediaStream) => void = () => undefined
        const getUserMedia = vi.fn(
            () =>
                new Promise<MediaStream>((resolve) => {
                    resolveCamera = resolve
                }),
        )
        const track = { stop: vi.fn() }
        const stream = {
            getTracks: () => [track],
        } as unknown as MediaStream
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })

        const view = render(
            <CameraCaptureSheet
                isOpen
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )
        const video = screen.getByLabelText("Live camera preview")

        view.rerender(
            <CameraCaptureSheet
                isOpen={false}
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )
        resolveCamera(stream)

        await waitFor(() => expect(track.stop).toHaveBeenCalledTimes(1))
        expect(video).toHaveProperty("srcObject", null)
    })

    test("does not let a stale camera response detach a newer stream", async () => {
        let resolveFirst: (stream: MediaStream) => void = () => undefined
        let resolveSecond: (stream: MediaStream) => void = () => undefined
        const getUserMedia = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise<MediaStream>((resolve) => {
                        resolveFirst = resolve
                    }),
            )
            .mockImplementationOnce(
                () =>
                    new Promise<MediaStream>((resolve) => {
                        resolveSecond = resolve
                    }),
            )
        const firstTrack = { stop: vi.fn() }
        const secondTrack = { stop: vi.fn() }
        const firstStream = {
            getTracks: () => [firstTrack],
        } as unknown as MediaStream
        const secondStream = {
            getTracks: () => [secondTrack],
        } as unknown as MediaStream
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })

        const view = render(
            <CameraCaptureSheet
                isOpen
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )

        view.rerender(
            <CameraCaptureSheet
                isOpen={false}
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )
        view.rerender(
            <CameraCaptureSheet
                isOpen
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )
        await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))

        resolveSecond(secondStream)
        const video = screen.getByLabelText("Live camera preview")
        await waitFor(() =>
            expect(video).toHaveProperty("srcObject", secondStream),
        )

        resolveFirst(firstStream)
        await waitFor(() => expect(firstTrack.stop).toHaveBeenCalledTimes(1))
        expect(video).toHaveProperty("srcObject", secondStream)
        expect(secondTrack.stop).not.toHaveBeenCalled()
    })

    test("falls back when permission is denied and exposes device and library actions", async () => {
        const user = userEvent.setup()
        const onUseDeviceCamera = vi.fn()
        const onChooseFromLibrary = vi.fn()
        const onClose = vi.fn()
        const getUserMedia = vi
            .fn()
            .mockRejectedValue(new DOMException("Denied", "NotAllowedError"))

        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })

        render(
            <CameraCaptureSheet
                isOpen
                productTitle="Product B"
                productNumber="2"
                onClose={onClose}
                onCapture={vi.fn()}
                onUseDeviceCamera={onUseDeviceCamera}
                onChooseFromLibrary={onChooseFromLibrary}
            />,
        )

        expect(
            await screen.findByText("Camera preview unavailable"),
        ).toBeInTheDocument()
        expect(
            screen.getByText(/Camera access was not granted/i),
        ).toBeInTheDocument()

        await user.click(
            screen.getByRole("button", { name: "Use device camera" }),
        )
        await user.click(
            screen.getByRole("button", { name: /Choose from library/i }),
        )
        expect(onUseDeviceCamera).toHaveBeenCalledTimes(1)
        expect(onChooseFromLibrary).toHaveBeenCalledTimes(1)

        await user.keyboard("{Escape}")
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    test("falls back without calling getUserMedia in an insecure context or unsupported browser", async () => {
        const getUserMedia = vi.fn()
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: false,
        })

        const { unmount } = render(
            <CameraCaptureSheet
                isOpen
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )
        expect(
            await screen.findByText("Camera preview unavailable"),
        ).toBeInTheDocument()
        expect(getUserMedia).not.toHaveBeenCalled()

        unmount()
        vi.stubGlobal("navigator", {})
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })
        render(
            <CameraCaptureSheet
                isOpen
                productTitle="Product A"
                productNumber="1"
                onClose={vi.fn()}
                onCapture={vi.fn()}
                onUseDeviceCamera={vi.fn()}
                onChooseFromLibrary={vi.fn()}
            />,
        )
        expect(
            await screen.findByText("Camera preview unavailable"),
        ).toBeInTheDocument()
    })
})

describe("Compare Products frontend page (/compare)", () => {
    test("renders a concise camera-first intro with AI disclosure and one clear first action", () => {
        renderRoute("/compare")

        // Heading & Action buttons
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Compare Products",
            }),
        ).toBeInTheDocument()
        expect(
            screen.queryByRole("link", { name: /Return to scan/i }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: /Reset session/i }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible()

        expect(
            screen.getByRole("heading", {
                level: 2,
                name: "Compare Two Products",
            }),
        ).toBeInTheDocument()
        const introHeading = screen.getByRole("heading", {
            level: 2,
            name: "Compare Two Products",
        })
        expect(introHeading).toHaveClass("icon-heading-title")
        expect(introHeading.parentElement).toHaveClass("icon-heading-row")
        expect(
            screen.getByRole("button", { name: "Get started" }),
        ).toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: /Language:/i }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: /Choose from library/i }),
        ).not.toBeInTheDocument()

        // The starting card stays focused on the comparison task.
        expect(
            screen.queryByText(
                /Photos are processed by the configured AI provider/i,
            ),
        ).not.toBeInTheDocument()

        // The intro has one clear path and no duplicate disabled Compare action.
        expect(
            screen.queryByRole("button", { name: "Compare Products" }),
        ).not.toBeInTheDocument()
    })

    test("uses the shared Scan locale without a Compare language control", async () => {
        const user = userEvent.setup()
        renderRoute("/")

        await user.click(
            screen.getByRole("button", { name: "Language: English" }),
        )
        await user.click(
            screen.getByRole("menuitemradio", { name: "Khmer (ខ្មែរ)" }),
        )
        await user.click(screen.getByRole("link", { name: "ប្រៀបធៀប" }))

        expect(
            screen.getByRole("heading", { name: "ប្រៀបធៀបផលិតផល" }),
        ).toBeInTheDocument()
        expect(document.documentElement).toHaveAttribute("lang", "km")
        expect(window.localStorage.getItem("lifegoods.locale.v1")).toBe("km")
        expect(
            screen.queryByRole("button", { name: /Language:/i }),
        ).not.toBeInTheDocument()
    })

    test("replaces the shared primary navigation with a floating photo dock", () => {
        renderRoute("/compare")

        const uploadLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        fireEvent.change(uploadLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })

        expect(
            screen.queryByRole("navigation", { name: "Primary navigation" }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("group", { name: "Photo capture navigation" }),
        ).toHaveClass(
            "fixed",
            "rounded-full",
            "backdrop-blur-xl",
            "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]",
        )

        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 640,
        })
        fireEvent.scroll(window)
        expect(screen.getByRole("button", { name: "Back to top" })).toHaveClass(
            "bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
        )
    })

    test("guides the Shopper through Product A, Product B, and reset", async () => {
        const user = userEvent.setup()
        renderRoute("/compare")

        const cameraLeft = document.getElementById(
            "camera-photos-left",
        ) as HTMLInputElement
        const cameraLeftClick = vi.spyOn(cameraLeft, "click")

        await user.click(screen.getByRole("button", { name: "Get started" }))
        expect(
            screen.getByRole("button", { name: /Reset session/i }),
        ).toBeInTheDocument()
        expect(cameraLeftClick).not.toHaveBeenCalled()

        await user.click(screen.getByRole("button", { name: /Take photo/i }))
        expect(cameraLeftClick).toHaveBeenCalledTimes(1)

        expect(cameraLeft).toHaveAttribute("capture", "environment")
        expect(cameraLeft).toHaveAttribute(
            "accept",
            "image/jpeg,image/png,image/heic,image/heif,.heic,.heif",
        )

        const dummyFileA = new File(["test-image-a"], "sample-a.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(cameraLeft, { target: { files: [dummyFileA] } })
        expect(screen.getByText("Photo 1")).toBeInTheDocument()

        const cameraRight = document.getElementById(
            "camera-photos-right",
        ) as HTMLInputElement
        const cameraRightClick = vi.spyOn(cameraRight, "click")
        const uploadRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        const uploadRightClick = vi.spyOn(uploadRight, "click")
        await user.click(
            screen.getByRole("button", { name: /Continue to Product B/i }),
        )
        expect(cameraRightClick).not.toHaveBeenCalled()
        expect(
            screen.getByText("Add a Nutrition Facts photo"),
        ).toBeInTheDocument()

        await user.click(screen.getByRole("button", { name: /Take photo/i }))
        expect(cameraRightClick).toHaveBeenCalledTimes(1)
        await user.click(
            screen.getByRole("button", { name: /Choose from library/i }),
        )
        expect(uploadRightClick).toHaveBeenCalledTimes(1)

        const backBtn = screen.getByRole("button", {
            name: /Back to Product A/i,
        })
        await user.click(backBtn)
        expect(screen.getByDisplayValue("Product A")).toBeInTheDocument()

        await user.click(
            screen.getByRole("button", { name: /Continue to Product B/i }),
        )
        const dummyFileB = new File(["test-image-b"], "sample-b.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(uploadRight, { target: { files: [dummyFileB] } })
        expect(
            screen.getByRole("button", { name: "Compare Products" }),
        ).toBeEnabled()
        expect(
            screen.queryByRole("button", { name: /Review both Products/i }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(
                /Photos are processed by the configured AI provider and are not retained by Life Goods\./i,
            ),
        ).not.toBeInTheDocument()

        const resetButton = screen.getByRole("button", {
            name: /Reset session/i,
        })
        await user.click(resetButton)
        expect(screen.getByDisplayValue("Product A")).toBeInTheDocument()
        expect(screen.queryByText("Photo 1")).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Get started" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Compare Products" }),
        ).not.toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Back to start" }))
        expect(
            screen.getByRole("button", { name: "Get started" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeInTheDocument()
    })

    test("redirects previous photo-comparison URLs to /compare", () => {
        const { unmount } = renderRoute("/experimental/photo-comparison")
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Compare Products",
            }),
        ).toBeInTheDocument()
        unmount()

        renderRoute("/photo-comparison")
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Compare Products",
            }),
        ).toBeInTheDocument()
    })

    test("is reached from the primary navigation, not from the Scan page", async () => {
        const user = userEvent.setup()
        renderRoute("/")

        expect(
            screen.queryByRole("link", { name: /Compare Products/i }),
        ).not.toBeInTheDocument()

        const compareLink = screen.getByRole("link", { name: "Compare" })
        expect(compareLink).toHaveAttribute("href", "/compare")

        await user.click(compareLink)

        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Compare Products",
            }),
        ).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute(
            "aria-current",
            "page",
        )
    })

    test("allows editing product titles and resetting the session", async () => {
        const user = userEvent.setup()
        renderRoute("/compare")

        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })

        const productAInput = screen.getByDisplayValue("Product A")
        await user.clear(productAInput)
        await user.type(productAInput, "Mee Chiet Noodle")

        expect(screen.getByDisplayValue("Mee Chiet Noodle")).toBeInTheDocument()

        // Reset session
        const resetButton = screen.getByRole("button", {
            name: /Reset session/i,
        })
        await user.click(resetButton)

        expect(screen.getByDisplayValue("Product A")).toBeInTheDocument()
        expect(screen.queryByText("Photo 1")).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Get started" }),
        ).not.toBeInTheDocument()
    })

    test.each(["restart", "Product A back", "mutation"] as const)(
        "orchestrates comparison and clears the session via %s",
        async (exitAction) => {
            const user = userEvent.setup()
            const extractPhotosMock = vi.fn().mockImplementation((id: string) =>
                Promise.resolve(
                    id === "left"
                        ? {
                              schema_version: 1,
                              product_id: "left",
                              images: [
                                  {
                                      image_id: "img_mama_1",
                                      original_image_id: "img_mama_1",
                                      role: "label",
                                      width: 800,
                                      height: 600,
                                  },
                              ],
                              package_quantity: null,
                              nutrition_columns: [
                                  {
                                      column_id: "col1",
                                      name: "Per 100g",
                                      state: "readable",
                                      basis: "per_100g",
                                      fields: [],
                                  },
                              ],
                              outcome: "complete",
                              provider: "google",
                              model: "gemini",
                              configuration_version: "1.0.0",
                          }
                        : {
                              schema_version: 1,
                              product_id: "right",
                              images: [
                                  {
                                      image_id: "img_b_1",
                                      original_image_id: "img_b_1",
                                      role: "label",
                                      width: 800,
                                      height: 600,
                                  },
                              ],
                              package_quantity: null,
                              nutrition_columns: [
                                  {
                                      column_id: "col2",
                                      name: "Per 100g",
                                      state: "readable",
                                      basis: "per_100g",
                                      fields: [],
                                  },
                              ],
                              outcome: "complete",
                              provider: "google",
                              model: "gemini",
                              configuration_version: "1.0.0",
                          },
                ),
            )

            const compareMock = vi.fn().mockResolvedValue({
                schema_version: 1,
                calculated_from_submitted_evidence: true,
                left_product_id: "left",
                right_product_id: "right",
                rows: [
                    {
                        nutrient: "sodium",
                        row_kind: "amount",
                        state: "comparable",
                        left: {
                            column_id: "col1",
                            observation: {
                                field_id: "left_sod",
                                nutrient: "sodium",
                                label: "Sodium",
                                state: "readable",
                                row_kind: "amount",
                                qualifier: "exact",
                                value_text: "1,380",
                                unit_text: "mg",
                                evidence: [{ image_id: "img_mama_1" }],
                            },
                        },
                        right: {
                            column_id: "col2",
                            observation: {
                                field_id: "right_sod",
                                nutrient: "sodium",
                                label: "Sodium",
                                state: "readable",
                                row_kind: "amount",
                                qualifier: "exact",
                                value_text: "1.5",
                                unit_text: "g",
                                evidence: [{ image_id: "img_b_1" }],
                            },
                        },
                        normalized_left: {
                            value: "1380",
                            unit: "mg",
                            target_basis: "per_100g",
                            inputs: [],
                        },
                        normalized_right: {
                            value: "1500",
                            unit: "mg",
                            target_basis: "per_100g",
                            inputs: [],
                        },
                    },
                ],
            })

            const queryClient = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            })
            render(
                <QueryClientProvider client={queryClient}>
                    <MemoryRouter initialEntries={["/compare"]}>
                        <PhotoComparisonPage
                            extractPhotos={extractPhotosMock}
                            compare={compareMock}
                        />
                    </MemoryRouter>
                </QueryClientProvider>,
            )

            // Shopper is not asked to run extraction and calculation as separate operations
            expect(
                screen.queryByRole("button", {
                    name: /Read nutrition photos/i,
                }),
            ).not.toBeInTheDocument()

            // Upload photo for Product A
            const inputLeft = document.getElementById(
                "upload-photos-left",
            ) as HTMLInputElement
            const fileLeft = new File(["left image"], "left.jpg", {
                type: "image/jpeg",
            })
            fireEvent.change(inputLeft, { target: { files: [fileLeft] } })

            // Upload photo for Product B
            const inputRight = document.getElementById(
                "upload-photos-right",
            ) as HTMLInputElement
            const fileRight = new File(["right image"], "right.jpg", {
                type: "image/jpeg",
            })
            fireEvent.change(inputRight, { target: { files: [fileRight] } })

            const compareButton = screen.getByRole("button", {
                name: "Compare Products",
            })
            expect(compareButton).toBeEnabled()

            // Clicking Compare once orchestrates extractions and comparison
            await user.click(compareButton)

            expect(extractPhotosMock).toHaveBeenCalledTimes(2)
            expect(extractPhotosMock.mock.calls[0]?.[0]).toBe("left")
            expect(extractPhotosMock.mock.calls[0]?.[1]).toEqual([fileLeft])
            expect(
                (
                    extractPhotosMock.mock.calls[0]?.[2] as
                        { signal?: AbortSignal } | undefined
                )?.signal,
            ).toBeInstanceOf(AbortSignal)
            expect(extractPhotosMock.mock.calls[1]?.[0]).toBe("right")
            expect(extractPhotosMock.mock.calls[1]?.[1]).toEqual([fileRight])
            expect(
                (
                    extractPhotosMock.mock.calls[1]?.[2] as
                        { signal?: AbortSignal } | undefined
                )?.signal,
            ).toBeInstanceOf(AbortSignal)
            expect(compareMock).toHaveBeenCalledTimes(1)

            // Factual results rendered
            expect(screen.getByText("Sodium")).toBeInTheDocument()
            expect(screen.getAllByText("1,380 mg").length).toBeGreaterThan(0)

            // Comparison results render on their own page: no Compare tab, and the
            // two-step capture stepper is not on screen.
            expect(
                screen.getByRole("region", { name: "Comparison results" }),
            ).toBeInTheDocument()
            expect(
                screen.queryByRole("button", { name: "Back to start" }),
            ).not.toBeInTheDocument()
            expect(
                screen.queryByRole("tab", { name: /Compare/i }),
            ).not.toBeInTheDocument()
            expect(
                screen.queryByRole("tab", { name: /Product A/i }),
            ).not.toBeInTheDocument()

            // Editing returns to the two-step capture while keeping the result.
            await user.click(
                screen.getByRole("button", { name: /Edit products/i }),
            )
            expect(
                screen.queryByRole("region", { name: "Comparison results" }),
            ).not.toBeInTheDocument()
            expect(
                screen.getByRole("button", { name: /^2 Product B$/i }),
            ).toHaveAttribute("aria-current", "step")
            const stepButtons = within(
                screen.getByRole("navigation", {
                    name: "Comparison steps",
                }),
            ).getAllByRole("button")
            const stepNavigation = screen.getByRole("navigation", {
                name: "Comparison steps",
            })
            expect(stepNavigation.querySelector("ol")).toHaveAttribute(
                "data-glass-surface",
                "",
            )
            expect(stepButtons[0]).toHaveAttribute("data-glass", "neutral")
            expect(stepButtons[1]).toHaveAttribute("data-glass", "selected")
            expect(stepButtons[1]).toHaveAttribute("aria-current", "step")
            await user.click(stepButtons[0]!)
            expect(stepButtons[0]).toHaveAttribute("aria-current", "step")
            await user.click(stepButtons[1]!)

            // Returning to the results page does not re-run extraction or comparison.
            await user.click(
                screen.getByRole("button", {
                    name: /Return to comparison results/i,
                }),
            )
            expect(
                screen.getByRole("region", { name: "Comparison results" }),
            ).toBeInTheDocument()
            expect(extractPhotosMock).toHaveBeenCalledTimes(2)
            expect(compareMock).toHaveBeenCalledTimes(1)

            if (exitAction !== "mutation") {
                if (exitAction === "Product A back") {
                    await user.click(
                        screen.getByRole("button", { name: /Edit products/i }),
                    )
                    await user.click(
                        within(
                            screen.getByRole("navigation", {
                                name: "Comparison steps",
                            }),
                        ).getAllByRole("button")[0]!,
                    )
                }
                const revokePhotoUrl = vi.spyOn(URL, "revokeObjectURL")
                revokePhotoUrl.mockClear()
                await user.click(
                    screen.getByRole("button", {
                        name:
                            exitAction === "restart"
                                ? "Reset session"
                                : "Back to start",
                    }),
                )
                expect(
                    screen.queryByRole("region", {
                        name: "Comparison results",
                    }),
                ).not.toBeInTheDocument()
                expect(screen.queryByText("Photo 1")).not.toBeInTheDocument()
                expect(revokePhotoUrl).toHaveBeenCalledTimes(2)
                if (exitAction !== "restart") {
                    expect(
                        screen.getByRole("button", { name: "Get started" }),
                    ).toBeInTheDocument()
                    await user.click(
                        screen.getByRole("button", { name: "Get started" }),
                    )
                } else {
                    expect(
                        screen.queryByRole("button", { name: "Get started" }),
                    ).not.toBeInTheDocument()
                }
                expect(
                    screen.getByDisplayValue("Product A"),
                ).toBeInTheDocument()
                expect(
                    screen.getByRole("button", {
                        name: /Continue to Product B/i,
                    }),
                ).toBeDisabled()
                expect(extractPhotosMock).toHaveBeenCalledTimes(2)
                expect(compareMock).toHaveBeenCalledTimes(1)
                return
            }

            // A real input mutation still invalidates the stale result.
            await user.click(
                screen.getByRole("button", { name: /Edit products/i }),
            )
            const replacementInput = document.getElementById(
                "upload-photos-left",
            ) as HTMLInputElement
            fireEvent.change(replacementInput, {
                target: {
                    files: [
                        new File(["new left image"], "new-left.jpg", {
                            type: "image/jpeg",
                        }),
                    ],
                },
            })
            expect(
                screen.queryByRole("region", { name: "Comparison results" }),
            ).not.toBeInTheDocument()
            await user.click(
                within(
                    screen.getByRole("navigation", {
                        name: "Comparison steps",
                    }),
                ).getAllByRole("button")[1]!,
            )
            expect(
                screen.queryByRole("button", {
                    name: /Return to comparison results/i,
                }),
            ).not.toBeInTheDocument()
            expect(
                screen.getByRole("button", { name: "Compare Products" }),
            ).toBeInTheDocument()
            expect(compareMock).toHaveBeenCalledTimes(1)
        },
    )

    test("turns provider contract errors into actionable Shopper guidance", () => {
        const error = new PhotoComparisonApiError(
            "provider_output_invalid",
            "identity brands is not contract-valid",
        )

        expect(formatActionableError(error.message, error.code)).toBe(
            "We couldn’t reliably read this label. Try a clearer photo and tap Retry.",
        )
        expect(formatActionableError(error.message, error.code)).not.toContain(
            "contract-valid",
        )
    })

    test("shows a comparison-level alert and retries without losing extracted labels", async () => {
        const user = userEvent.setup()
        const makeExtraction = (productId: string): Extraction => ({
            schema_version: 1,
            product_id: productId,
            images: [],
            package_quantity: null,
            nutrition_columns: [
                {
                    column_id: `${productId}-column`,
                    label: "Per 100g",
                    basis: "per_100g",
                    fields: [],
                },
            ],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        })
        const extractPhotosMock = vi.fn((productId: string) =>
            Promise.resolve(makeExtraction(productId)),
        )
        const compareMock = vi
            .fn()
            .mockRejectedValue(new Error("opaque comparison provider detail"))

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        fireEvent.change(
            document.getElementById("upload-photos-left") as HTMLInputElement,
            {
                target: {
                    files: [
                        new File(["left"], "left.jpg", { type: "image/jpeg" }),
                    ],
                },
            },
        )
        fireEvent.change(
            document.getElementById("upload-photos-right") as HTMLInputElement,
            {
                target: {
                    files: [
                        new File(["right"], "right.jpg", {
                            type: "image/jpeg",
                        }),
                    ],
                },
            },
        )

        await user.click(
            screen.getByRole("button", { name: "Compare Products" }),
        )

        const alert = await screen.findByRole("alert")
        expect(
            within(alert).getByRole("heading", {
                name: "The comparison could not be completed",
            }),
        ).toBeInTheDocument()
        expect(alert).toHaveTextContent("The request failed. Please retry.")
        expect(alert).toHaveTextContent(
            "Your photos are still here. Check your connection and try the comparison again.",
        )
        expect(alert).not.toHaveTextContent("opaque comparison provider detail")
        expect(extractPhotosMock).toHaveBeenCalledTimes(2)

        await user.click(
            within(alert).getByRole("button", { name: "Retry comparison" }),
        )
        await waitFor(() => expect(compareMock).toHaveBeenCalledTimes(2))
        expect(extractPhotosMock).toHaveBeenCalledTimes(2)
    })

    test("normalizes every stable API error code without exposing raw messages", () => {
        expect(
            formatActionableError(
                "The submitted photo is empty.",
                "request_invalid",
            ),
        ).toBe(
            "This photo could not be read from your device. It may not be fully downloaded — open it in your photo app first, or choose another photo.",
        )
        expect(
            formatActionableError(
                "Only JPEG and PNG photos are supported.",
                "unsupported_image_format",
            ),
        ).toBe("Choose a valid JPEG, PNG or HEIC photo, then try again.")
        expect(
            formatActionableError(
                "The upload request must be smaller.",
                "size_limit_exceeded",
            ),
        ).toBe(
            "The submitted photos are too large. Choose smaller photos and try again.",
        )
        expect(
            formatActionableError(
                "The extraction limit is 10 requests per minute.",
                "rate_limit_exceeded",
            ),
        ).toBe("Processing capacity has been reached. Wait a moment and retry.")
        expect(
            formatActionableError(
                "The provider is at capacity.",
                "capacity_limit_exceeded",
            ),
        ).toBe("Processing capacity has been reached. Wait a moment and retry.")
        expect(
            formatActionableError(
                "The provider timed out.",
                "provider_timeout",
            ),
        ).toBe(
            "Photo processing request timed out. Please check your connection and tap Retry.",
        )
        expect(
            formatActionableError(
                "The provider is unavailable.",
                "provider_unavailable",
            ),
        ).toBe(
            "Photo processing is temporarily unavailable. Check your connection and retry.",
        )
        expect(
            formatActionableError(
                "The provider returned invalid output.",
                "provider_output_invalid",
            ),
        ).toBe(
            "We couldn’t reliably read this label. Try a clearer photo and tap Retry.",
        )
        expect(
            formatActionableError(
                "provider internals should stay private",
                "internal_error",
                "km",
            ),
        ).not.toContain("provider internals")
        expect(
            formatActionableError(
                "provider internals should stay private",
                "internal_error",
                "km",
            ),
        ).toBe("សំណើបានបរាជ័យ។ សូមសាកល្បងម្ដងទៀត។")
    })
})

describe("Nutrient labels follow the selected locale", () => {
    test("known canonical keys render in the chosen language", () => {
        expect(formatNutrientName("monounsaturated_fat", null, "km")).toBe(
            "ខ្លាញ់មិនឆ្អែតតែមួយ",
        )
        expect(formatNutrientName("monounsaturated_fat", null, "en")).toBe(
            "Monounsaturated Fat",
        )
        expect(formatNutrientName("calories_from_fat", null, "km")).toBe(
            "កាឡូរីពីខ្លាញ់",
        )
        expect(formatNutrientName("trans_fat", null, "km")).toBe(
            "ខ្លាញ់ត្រង់ស៍",
        )
    })

    test("unknown multilingual labels keep only the English segment", () => {
        const label = "Asid Lemak Omega-3 / Omega-3 Fatty Acid / 欧米伽3脂肪酸"
        expect(formatNutrientName(label, label, "km")).toBe(
            "Omega-3 Fatty Acid",
        )
        expect(formatNutrientName(label, label, "en")).toBe(
            "Omega-3 Fatty Acid",
        )
        expect(formatNutrientName("Lutein*", "Lutein*", "km")).toBe("Lutein")
        expect(formatNutrientName("欧米伽3", "欧米伽3", "km")).toBe("欧米伽3")
    })

    test("pickDefaultColumnId prefers per 100 g and skips daily-value columns", () => {
        const amount = {
            field_id: "f",
            label: "Sodium",
            value_text: "1",
            unit_text: "mg",
            state: "readable" as const,
            row_kind: "amount" as const,
            evidence: [],
        }
        const percent = {
            ...amount,
            unit_text: "%",
            row_kind: "percentage" as const,
        }
        expect(
            pickDefaultColumnId([
                { column_id: "serv", basis: "per_serving", fields: [amount] },
                { column_id: "dv", basis: "other", fields: [percent] },
                { column_id: "g100", basis: "per_100g", fields: [amount] },
            ]),
        ).toBe("g100")
        expect(
            pickDefaultColumnId([
                { column_id: "pct", basis: "unknown", fields: [percent] },
                { column_id: "serv", basis: "per_serving", fields: [amount] },
            ]),
        ).toBe("serv")
        expect(
            pickDefaultColumnId([
                { column_id: "first", basis: "unknown", fields: [] },
                { column_id: "second", basis: "unknown", fields: [] },
            ]),
        ).toBe("first")
        expect(pickDefaultColumnId([])).toBeNull()
        expect(pickDefaultColumnId(null)).toBeNull()
    })

    test("product panel shows the localized basis, never the printed header", () => {
        const product: ProductSideState = {
            id: "left",
            title: "LEE CREAM CRACKERS",
            number: "1",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "left",
                images: [],
                package_quantity: null,
                nutrition_columns: [
                    {
                        column_id: "dv",
                        label: "% Daily Value / Valeur Quotidienne*",
                        basis: "other",
                        fields: [],
                    },
                    {
                        column_id: "g100",
                        label: "Setiap 100g/ Per 100g/ 每100克",
                        basis: "per_100g",
                        preparation_state: "as_sold",
                        fields: [],
                    },
                ],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: "g100",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const { container } = render(
            <LocaleContext.Provider
                value={{
                    locale: "km",
                    enabledLocales: ["km", "en"],
                    setLocale: vi.fn(),
                }}
            >
                <ProductPhotoPanel
                    product={product}
                    highlightedPhotoId={null}
                    previewRefs={{ current: {} }}
                    onTitleChange={vi.fn()}
                    onAddFiles={vi.fn()}
                    onRemovePhoto={vi.fn()}
                    onReplacePhoto={vi.fn()}
                    onClearPhotos={vi.fn()}
                    onFocusEvidence={vi.fn()}
                />
            </LocaleContext.Provider>,
        )
        expect(screen.getAllByText(/ក្នុង 100 ក្រាម/).length).toBeGreaterThan(0)
        expect(container.textContent).not.toMatch(
            /Setiap|每100克|Quotidienne|Daily Value/,
        )
        // Detected details: explicit Show/Hide affordance and a single
        // preparation value for the selected column (not one per column).
        expect(screen.getByText("បង្ហាញ")).toBeInTheDocument()
        expect(screen.getByText("លាក់")).toBeInTheDocument()
        const preparationCell = screen.getByText("ការរៀបចំ").nextElementSibling
        expect(preparationCell?.textContent).toBe("តាមដែលបានលក់")
        expect(preparationCell?.textContent).not.toContain("·")
        expect(
            screen.queryByRole("button", { name: /Select column/i }),
        ).not.toBeInTheDocument()
    })

    test("printed units drop secondary-language segments", () => {
        expect(displayValue("490", "kcal/千卡*")).toBe("490 kcal")
        expect(displayValue("10", "g/克")).toBe("10 g")
        expect(displayValue("10", "")).toBe("10")
    })
})

describe("ComparisonSection Shopper-ready presentation", () => {
    const mockLeftProduct: ProductSideState = {
        id: "left",
        title: "Mama Instant Noodles",
        number: "1",
        photos: [],
        extraction: {
            schema_version: 1,
            product_id: "left",
            images: [
                {
                    image_id: "img_mama_1",
                    original_image_id: "img_mama_1",
                    role: "label",
                    width: 800,
                    height: 600,
                },
            ],
            package_quantity: {
                field_id: "pkg_qty_1",
                label: "Net weight",
                value_text: "60",
                unit_text: "g",
                state: "readable",
                evidence: [{ image_id: "img_mama_1" }],
            },
            nutrition_columns: [],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        },
        selectedColumnId: "col1",
        loading: false,
        error: "",
        retry: false,
        revision: 1,
    }

    const mockRightProduct: ProductSideState = {
        id: "right",
        title: "Product B",
        number: "2",
        photos: [],
        extraction: {
            schema_version: 1,
            product_id: "right",
            images: [
                {
                    image_id: "img_b_1",
                    original_image_id: "img_b_1",
                    role: "label",
                    width: 800,
                    height: 600,
                },
            ],
            package_quantity: {
                field_id: "pkg_qty_2",
                label: "Net weight",
                value_text: "70",
                unit_text: "g",
                state: "readable",
                evidence: [{ image_id: "img_b_1" }],
            },
            nutrition_columns: [],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        },
        selectedColumnId: "col2",
        loading: false,
        error: "",
        retry: false,
        revision: 1,
    }

    const mockComparison: ComparisonResponse = {
        schema_version: 1,
        calculated_from_submitted_evidence: true,
        left_product_id: "left",
        right_product_id: "right",
        rows: [
            {
                nutrient: "sodium",
                row_kind: "amount",
                state: "comparable",
                left: {
                    column_id: "col1",
                    observation: {
                        field_id: "left_sod",
                        nutrient: "sodium",
                        label: "Sodium",
                        state: "readable",
                        row_kind: "amount",
                        qualifier: "exact",
                        value_text: "1,380",
                        unit_text: "mg",
                        evidence: [{ image_id: "img_mama_1" }],
                    },
                },
                right: {
                    column_id: "col2",
                    observation: {
                        field_id: "right_sod",
                        nutrient: "sodium",
                        label: "Sodium",
                        state: "readable",
                        row_kind: "amount",
                        qualifier: "exact",
                        value_text: "1.5",
                        unit_text: "g",
                        evidence: [{ image_id: "img_b_1" }],
                    },
                },
                normalized_left: {
                    value: "1380",
                    unit: "mg",
                    target_basis: "per_package",
                    inputs: [],
                },
                normalized_right: {
                    value: "1500",
                    unit: "mg",
                    target_basis: "per_package",
                    inputs: [],
                },
            },
            {
                nutrient: "vitamin_b5",
                row_kind: "amount",
                state: "not_comparable",
                reason: "Not found in photos for the other product.",
                right: {
                    column_id: "col2",
                    observation: {
                        field_id: "right_b5",
                        nutrient: "vitamin_b5",
                        label: "Vitamin B5",
                        state: "readable",
                        row_kind: "amount",
                        qualifier: "exact",
                        value_text: "1.2",
                        unit_text: "mg",
                        evidence: [{ image_id: "img_b_1" }],
                    },
                },
                normalized_right: {
                    value: "1.2",
                    unit: "mg",
                    target_basis: "per_package",
                    inputs: [],
                },
            },
            {
                nutrient: "sodium",
                row_kind: "percentage",
                state: "comparable",
                left: {
                    column_id: "col1",
                    observation: {
                        field_id: "left_sod_pct",
                        nutrient: "sodium",
                        label: "Sodium",
                        state: "readable",
                        row_kind: "percentage",
                        qualifier: "exact",
                        value_text: "60",
                        unit_text: "%",
                        evidence: [{ image_id: "img_mama_1" }],
                    },
                },
                right: {
                    column_id: "col2",
                    observation: {
                        field_id: "right_sod_pct",
                        nutrient: "sodium",
                        label: "Sodium",
                        state: "readable",
                        row_kind: "percentage",
                        qualifier: "exact",
                        value_text: "65",
                        unit_text: "%",
                        evidence: [{ image_id: "img_b_1" }],
                    },
                },
                normalized_left: {
                    value: "60",
                    unit: "%",
                    target_basis: "per_package",
                    inputs: [],
                },
                normalized_right: {
                    value: "65",
                    unit: "%",
                    target_basis: "per_package",
                    inputs: [],
                },
            },
        ],
    }

    test("keeps a fixed-width table and localized placeholders in Khmer", () => {
        const khmerComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "monounsaturated_fat",
                    row_kind: "amount",
                    state: "not_comparable",
                    reason: "Not found in photos for the other product.",
                    left: {
                        column_id: "c1",
                        basis: "per_100g",
                        observation: {
                            field_id: "f1",
                            nutrient: "monounsaturated_fat",
                            label: "Asid Lemak Monotidaktepu / Monounsaturated Fatty Acid",
                            value_text: "9.3",
                            unit_text: "g",
                            state: "readable",
                            row_kind: "amount",
                            evidence: [],
                        },
                    },
                    right: null,
                },
            ],
        }
        const { container } = render(
            <LocaleContext.Provider
                value={{
                    locale: "km",
                    enabledLocales: ["km", "en"],
                    setLocale: vi.fn(),
                }}
            >
                <ComparisonSection
                    comparison={khmerComparison}
                    comparisonStatus=""
                    comparisonError={null}
                    isComparing={false}
                    isReadyToCompare={true}
                    leftProduct={mockLeftProduct}
                    rightProduct={mockRightProduct}
                    onCompare={vi.fn()}
                    onFocusEvidence={vi.fn()}
                />
            </LocaleContext.Provider>,
        )
        const table = container.querySelector("table")
        expect(table).toHaveClass("sm:table-fixed")
        expect(table?.querySelectorAll("col")).toHaveLength(3)
        expect(screen.getByText("ខ្លាញ់មិនឆ្អែតតែមួយ")).toBeInTheDocument()
        expect(container.textContent).not.toMatch(/Asid Lemak|Monounsaturated/)
        // Missing cell: short symbol in the cell, full sentence in the legend + sr-only
        expect(screen.getAllByText("—").length).toBe(2) // cell + legend
        expect(screen.getAllByText("រកមិនឃើញក្នុងរូបថតទាំងនេះ").length).toBe(2)
    })

    test("displays normalized amounts and visible label percentages", () => {
        render(
            <ComparisonSection
                comparison={mockComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={mockLeftProduct}
                rightProduct={mockRightProduct}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        const comparisonHeading = screen.getByRole("heading", {
            name: /Mama Instant Noodles vs Product B/,
        })
        expect(comparisonHeading).toHaveClass("icon-heading-title")
        expect(comparisonHeading.parentElement).toHaveClass("icon-heading-row")
        expect(comparisonHeading).toHaveClass("text-xl")
        expect(comparisonHeading).toHaveClass("flex", "flex-col")
        expect(comparisonHeading.children).toHaveLength(3)
        expect(comparisonHeading.children[0]).toHaveTextContent(
            "Mama Instant Noodles",
        )
        expect(comparisonHeading.children[1]).toHaveTextContent("vs")
        expect(comparisonHeading.children[2]).toHaveTextContent("Product B")
        expect(
            comparisonHeading.parentElement?.querySelector("span"),
        ).toHaveClass("size-11")
        expect(
            screen.queryByText("Based on Photo Evidence."),
        ).not.toBeInTheDocument()
        expect(
            screen
                .getAllByRole("table")
                .every((table) => table.classList.contains("border-collapse")),
        ).toBe(true)

        // 1. Check normalized amounts are displayed prominently
        expect(screen.getAllByText("1,380 mg").length).toBeGreaterThan(0)
        expect(screen.getByText("1,500 mg")).toBeInTheDocument()

        // 2. Check nutrient names are clean English, never internal hash IDs
        expect(screen.getAllByText("Sodium")).toHaveLength(2)
        expect(screen.getByText("Vitamin B5")).toBeInTheDocument()
        expect(screen.queryByText(/unmatched:/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/fat:[a-f0-9]/i)).not.toBeInTheDocument()

        // 3. Check concise comparison basis
        expect(
            screen.getByText("Comparison basis: Per package"),
        ).toBeInTheDocument()
        expect(
            screen.getByText("Package sizes may differ."),
        ).toBeInTheDocument()
        // Unknown preparation on both sides adds no noise to the basis card.
        expect(
            screen.queryByText(
                "Neither label says whether the Product is dry, as sold, or prepared.",
            ),
        ).not.toBeInTheDocument()
        expect(
            screen.getByText(
                "Compare the nutrition values shown on both labels.",
            ),
        ).toBeInTheDocument()
        expect(screen.queryByText(/unconfirmed/i)).not.toBeInTheDocument()

        const comparisonTables = screen.getAllByRole("table")
        expect(comparisonTables).toHaveLength(2)

        const amountHeaderCells = within(comparisonTables[0]!).getAllByRole(
            "columnheader",
        )
        expect(amountHeaderCells).toHaveLength(3)
        expect(amountHeaderCells[0]).toHaveTextContent("Nutrient")
        expect(amountHeaderCells[1]).toHaveTextContent("Mama Instant Noodles")
        expect(amountHeaderCells[2]).toHaveTextContent("Product B")

        const percentageHeaderCells = within(comparisonTables[1]!).getAllByRole(
            "columnheader",
        )
        expect(percentageHeaderCells).toHaveLength(3)
        expect(percentageHeaderCells[0]).toHaveTextContent("Nutrient")
        expect(percentageHeaderCells[1]).toHaveTextContent(
            "Mama Instant Noodles",
        )
        expect(percentageHeaderCells[2]).toHaveTextContent("Product B")

        for (const table of comparisonTables) {
            expect(table.parentElement).toHaveClass(
                "rounded-2xl",
                "border",
                "border-neutral-200",
                "bg-white",
            )
            expect(table.querySelector("thead > tr")).toHaveClass(
                "border-b",
                "border-neutral-200",
            )
            expect(table.querySelector("tbody")).toHaveClass(
                "divide-y",
                "divide-neutral-200",
            )
            expect(table.querySelector("tbody")).not.toHaveClass("gap-1.5")
        }

        const amountRows = within(comparisonTables[0]!)
            .getAllByRole("row")
            .filter((row) => row.querySelector("td"))
        expect(amountRows.length).toBeGreaterThan(0)
        expect(amountRows[0]).toHaveClass(
            "grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]",
        )
        expect(within(amountRows[0]!).getByRole("rowheader")).toHaveAttribute(
            "scope",
            "row",
        )
        expect(amountRows[0]?.querySelectorAll("td")).toHaveLength(2)
        expect(amountRows[0]?.querySelectorAll("td.text-right")).toHaveLength(2)
        expect(within(amountRows[0]!).getByText("Sodium")).toBeInTheDocument()
        expect(
            within(amountRows[0]!).queryByText("Mama Instant Noodles"),
        ).not.toBeInTheDocument()
        expect(
            within(amountRows[0]!).queryByText("Product B"),
        ).not.toBeInTheDocument()

        for (const table of comparisonTables) {
            expect(within(table).getByText("Mama Instant Noodles")).toHaveClass(
                "wrap-anywhere",
            )
            expect(within(table).getByText("Product B")).toHaveClass(
                "wrap-anywhere",
            )
        }

        const percentageRows = within(comparisonTables[1]!)
            .getAllByRole("row")
            .filter((row) => row.querySelector("td"))
        expect(percentageRows.length).toBeGreaterThan(0)
        for (const row of percentageRows) {
            expect(row).toHaveClass(
                "grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]",
            )
            expect(within(row).getByRole("rowheader")).toHaveAttribute(
                "scope",
                "row",
            )
            expect(row.querySelectorAll("td.text-right")).toHaveLength(2)
            expect(row.querySelectorAll("td")).toHaveLength(2)
            expect(row).not.toHaveTextContent("Mama Instant Noodles")
            expect(row).not.toHaveTextContent("Product B")
            expect(row).not.toHaveClass("rounded-xl")
        }
        for (const row of amountRows) {
            expect(row).not.toHaveClass("rounded-xl")
        }
        expect(
            screen.getByRole("heading", { name: "Label Percentages" }),
        ).toBeInTheDocument()
        expect(
            screen.getByText(
                "Daily value percentages are label reference values and may use different serving bases.",
            ),
        ).toBeInTheDocument()
        expect(
            screen.queryByText(
                "Label percentages are shown for reference and are not compared numerically.",
            ),
        ).not.toBeInTheDocument()
        expect(screen.getByText("60 %")).toBeInTheDocument()
        expect(screen.getByText("65 %")).toBeInTheDocument()
        expect(
            screen.queryByText("Evidence & calculation"),
        ).not.toBeInTheDocument()
        expect(screen.queryByText(/View photo 1/i)).not.toBeInTheDocument()

        // 5. Check missing data uses "Not found in these photos" (cell sr-only
        //    text + legend) and NEVER "Source Data Unavailable"
        expect(
            screen.getAllByText("Not found in these photos").length,
        ).toBeGreaterThan(0)
        expect(
            screen.queryByText(/Source Data Unavailable/i),
        ).not.toBeInTheDocument()
    })

    test("displays equal-weight comparison notice without a calculated difference section", () => {
        const per100gComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "sugar",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "col1",
                        observation: {
                            field_id: "f1",
                            nutrient: "sugar",
                            label: "Sugars",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "5",
                            unit_text: "g",
                            evidence: [{ image_id: "img1" }],
                        },
                    },
                    right: {
                        column_id: "col2",
                        observation: {
                            field_id: "f2",
                            nutrient: "sugar",
                            label: "Sugars",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "2",
                            unit_text: "g",
                            evidence: [{ image_id: "img2" }],
                        },
                    },
                    normalized_left: {
                        value: "5",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "2",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "3",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        render(
            <ComparisonSection
                comparison={per100gComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={mockLeftProduct}
                rightProduct={mockRightProduct}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        expect(
            screen.getByText("Comparison basis: Per 100 g"),
        ).toBeInTheDocument()
        expect(
            screen.getByText("Values use a common basis."),
        ).toBeInTheDocument()
        expect(screen.getAllByText("5 g").length).toBeGreaterThan(0)
        expect(screen.getAllByText("2 g").length).toBeGreaterThan(0)
        expect(
            screen.queryByRole("columnheader", { name: "Difference" }),
        ).not.toBeInTheDocument()
    })

    test("displays conditional state reason and assumptions", () => {
        const conditionalComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "energy",
                    row_kind: "amount",
                    state: "conditional",
                    reason: "Different preparation states: left is prepared, right is unprepared.",
                    assumptions: [
                        "Assuming dry weight yields similar calorie density.",
                    ],
                    left: {
                        column_id: "col1",
                        observation: {
                            field_id: "f1",
                            nutrient: "energy",
                            label: "Energy",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "300",
                            unit_text: "kcal",
                            evidence: [{ image_id: "img1" }],
                        },
                    },
                    right: {
                        column_id: "col2",
                        observation: {
                            field_id: "f2",
                            nutrient: "energy",
                            label: "Energy",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "350",
                            unit_text: "kcal",
                            evidence: [{ image_id: "img2" }],
                        },
                    },
                    normalized_left: {
                        value: "300",
                        unit: "kcal",
                        target_basis: "per_package",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "350",
                        unit: "kcal",
                        target_basis: "per_package",
                        inputs: [],
                    },
                },
            ],
        }

        render(
            <ComparisonSection
                comparison={conditionalComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={mockLeftProduct}
                rightProduct={mockRightProduct}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        expect(screen.queryByText("Conditional")).not.toBeInTheDocument()
        expect(
            screen.queryByText(
                "Different preparation states: left is prepared, right is unprepared.",
            ),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(
                "Neither label says whether the Product is dry, as sold, or prepared.",
            ),
        ).not.toBeInTheDocument()
    })
})

describe("Photo inspection and UX features", () => {
    test("PhotoInspectionModal allows zoom toggle, next/prev navigation, and keyboard esc to close", async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const photos = [
            {
                file: new File(["1"], "photo1.jpg", { type: "image/jpeg" }),
                url: "blob:http://localhost/1",
                localId: "photo-1",
            },
            {
                file: new File(["2"], "photo2.jpg", { type: "image/jpeg" }),
                url: "blob:http://localhost/2",
                localId: "photo-2",
            },
        ]

        const { rerender } = render(
            <PhotoInspectionModal
                isOpen={true}
                onClose={onClose}
                photos={photos}
                initialIndex={0}
                title="Mama Instant Noodles"
            />,
        )

        expect(screen.getByText("Mama Instant Noodles")).toBeInTheDocument()
        expect(screen.getByText("Photo 1 of 2")).toBeInTheDocument()

        // Zoom toggle
        const zoomButton = screen.getByRole("button", { name: /Zoom in/i })
        await user.click(zoomButton)
        expect(
            screen.getByRole("button", { name: /Fit to screen/i }),
        ).toBeInTheDocument()

        // Navigate next
        const nextButton = screen.getByRole("button", { name: /Next photo/i })
        await user.click(nextButton)
        expect(screen.getByText("Photo 2 of 2")).toBeInTheDocument()

        // Escape closes
        await user.keyboard("{Escape}")
        expect(onClose).toHaveBeenCalledTimes(1)

        // Modal closed renders nothing
        rerender(
            <PhotoInspectionModal
                isOpen={false}
                onClose={onClose}
                photos={photos}
                initialIndex={0}
                title="Mama Instant Noodles"
            />,
        )
        expect(
            screen.queryByText("Mama Instant Noodles"),
        ).not.toBeInTheDocument()
    })

    test("ProductPhotoPanel shows detected product identity and allows applying it as title", async () => {
        const user = userEvent.setup()
        const onTitleChange = vi.fn()
        const onFocusEvidence = vi.fn()

        const productWithIdentity: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "left",
                identity: {
                    brand: {
                        field_id: "brand1",
                        label: "Brand",
                        value_text: "Mee Chiet",
                        state: "readable",
                        evidence: [],
                    },
                    name: {
                        field_id: "name1",
                        label: "Name",
                        value_text: "Beef Flavor Noodles",
                        state: "readable",
                        evidence: [],
                    },
                },
                images: [
                    {
                        image_id: "label-1",
                        original_image_id: "label-1",
                        role: "label",
                        width: 1200,
                        height: 900,
                    },
                ],
                package_quantity: null,
                nutrition_columns: [],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: null,
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ProductPhotoPanel
                product={productWithIdentity}
                highlightedPhotoId={null}
                previewRefs={{ current: {} }}
                onTitleChange={onTitleChange}
                onAddFiles={vi.fn()}
                onRemovePhoto={vi.fn()}
                onReplacePhoto={vi.fn()}
                onClearPhotos={vi.fn()}
                onExtract={vi.fn()}
                onFocusEvidence={onFocusEvidence}
            />,
        )

        expect(screen.getByText("Detected product")).toBeInTheDocument()
        expect(screen.getByText("Mee Chiet")).toHaveAttribute("lang", "und")
        expect(screen.getByText("Beef Flavor Noodles")).toHaveAttribute(
            "lang",
            "und",
        )

        await user.click(screen.getByText("Detected details"))
        const viewPhotoButton = screen.getByRole("button", {
            name: "View photo 1",
        })
        await user.click(viewPhotoButton)
        expect(onFocusEvidence).toHaveBeenCalledWith("label-1")

        const useAsTitleBtn = screen.getByRole("button", {
            name: /Use as title/i,
        })
        await user.click(useAsTitleBtn)
        expect(onTitleChange).toHaveBeenCalledWith(
            "Mee Chiet Beef Flavor Noodles",
            "photo_evidence",
        )
    })

    test("validates file upload format and size limits with helpful feedback in PhotoComparisonPage", () => {
        renderRoute("/compare")

        // Input 1 is for upload-photos-left
        const fileInput = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        expect(fileInput).toBeInTheDocument()

        // 1. Upload unsupported format (PDF)
        const pdfFile = new File(["dummy pdf content"], "doc.pdf", {
            type: "application/pdf",
        })
        fireEvent.change(fileInput, { target: { files: [pdfFile] } })

        expect(
            screen.getAllByText(
                /Unsupported file format: only JPEG, PNG and HEIC photos are supported/i,
            ).length,
        ).toBeGreaterThan(0)

        // 2. Upload oversized file (> 10 MiB)
        const hugeBlob = new Array(11 * 1024 * 1024).fill("a").join("")
        const largeFile = new File([hugeBlob], "huge.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(fileInput, { target: { files: [largeFile] } })

        expect(
            screen.getAllByText(/exceeds the 10 MiB limit/i).length,
        ).toBeGreaterThan(0)

        // 3. Camera capture works via camera input with capture attribute
        const cameraInput = document.getElementById(
            "camera-photos-left",
        ) as HTMLInputElement
        expect(cameraInput).toBeInTheDocument()
        expect(cameraInput).toHaveAttribute("capture", "environment")

        const cameraPhoto = new File(["camera photo 1"], "cam1.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(cameraInput, { target: { files: [cameraPhoto] } })
        expect(screen.getByText("Photo 1")).toBeInTheDocument()

        // 4. Retaining up to 3 photos per Product; rejecting a 4th photo with clear limit message
        const remainingPhotos = Array.from(
            { length: 2 },
            (_, i) =>
                new File([`photo ${i + 2}`], `p${i + 2}.jpg`, {
                    type: "image/jpeg",
                }),
        )
        fireEvent.change(fileInput, { target: { files: remainingPhotos } })
        expect(screen.getByText("Photo 3")).toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: /Add another photo/i }),
        ).not.toBeInTheDocument()

        const fourthPhoto = new File(["extra photo"], "extra.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(fileInput, { target: { files: [fourthPhoto] } })
        expect(
            screen.getAllByText(/Maximum of 3 photos per Product reached/i)
                .length,
        ).toBeGreaterThan(0)

        fireEvent.click(screen.getByRole("button", { name: /Remove photo 3/i }))
        expect(
            screen.getByRole("button", { name: /Add another photo/i }),
        ).toBeInTheDocument()
    })

    test("accepts iPhone HEIC photos, including files with no MIME type", () => {
        renderRoute("/compare")

        const fileInput = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        expect(fileInput).toHaveAttribute(
            "accept",
            "image/jpeg,image/png,image/heic,image/heif,.heic,.heif",
        )

        const heicPhoto = new File(["heic"], "IMG_0001.HEIC", {
            type: "image/heic",
        })
        fireEvent.change(fileInput, { target: { files: [heicPhoto] } })
        expect(screen.getByText("Photo 1")).toBeInTheDocument()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()

        const untypedHeic = new File(["heic"], "IMG_0002.heic", { type: "" })
        fireEvent.change(fileInput, { target: { files: [untypedHeic] } })
        expect(screen.getByText("Photo 2")).toBeInTheDocument()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()

        // A HEIC preview the browser cannot render keeps the photo usable.
        fireEvent.error(screen.getByAltText("Product A photo 2"))
        expect(
            screen.getByRole("img", {
                name: "Preview not available in this browser. The photo will still be read.",
            }),
        ).toBeInTheDocument()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    test("flags a picked photo whose bytes cannot be read from the device", async () => {
        renderRoute("/compare")

        const fileInput = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement

        // An iCloud-optimized photo the device never finished downloading: the picker
        // hands over a File, but reading it fails.
        const undownloaded = new File(["heic"], "IMG_0003.HEIC", {
            type: "image/heic",
        })
        Object.defineProperty(undownloaded, "slice", {
            value: () => ({
                arrayBuffer: () =>
                    Promise.reject(new Error("The file is not available.")),
            }),
        })

        fireEvent.change(fileInput, { target: { files: [undownloaded] } })

        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent(
            "This photo could not be read from your device.",
        )
    })

    test("treats readable photos and environments without Blob.arrayBuffer as usable", async () => {
        const empty = new File([], "IMG_0004.HEIC", { type: "image/heic" })
        expect(await isReadablePhotoFile(empty)).toBe(false)

        const unreadable = new File(["heic"], "IMG_0005.HEIC", {
            type: "image/heic",
        })
        Object.defineProperty(unreadable, "slice", {
            value: () => ({
                arrayBuffer: () => Promise.reject(new Error("unavailable")),
            }),
        })
        expect(await isReadablePhotoFile(unreadable)).toBe(false)

        const readable = new File(["heic"], "IMG_0006.HEIC", {
            type: "image/heic",
        })
        Object.defineProperty(readable, "slice", {
            value: () => ({
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
            }),
        })
        expect(await isReadablePhotoFile(readable)).toBe(true)

        // jsdom has no Blob.arrayBuffer; the photo must not be rejected for that.
        const withoutArrayBuffer = new File(["heic"], "IMG_0007.HEIC", {
            type: "image/heic",
        })
        expect(await isReadablePhotoFile(withoutArrayBuffer)).toBe(true)
    })

    test("shows the extraction error on the Product whose photos failed", async () => {
        const user = userEvent.setup()
        const extractPhotosMock = vi
            .fn()
            .mockRejectedValue(
                new PhotoComparisonApiError(
                    "unsupported_image_format",
                    "Only JPEG, PNG and HEIC photos are supported.",
                ),
            )
        const compareMock = vi.fn()
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })
        expect(screen.getByAltText("Product B photo 1")).toBeInTheDocument()

        await user.click(
            screen.getByRole("button", { name: "Compare Products" }),
        )

        // Product A failed, so the view switches back to Product A and shows the alert.
        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent("We couldn’t read this label")
        expect(alert).toHaveTextContent(
            "Choose a valid JPEG, PNG or HEIC photo, then try again.",
        )
        expect(screen.getByAltText("Product A photo 1")).toBeInTheDocument()
        expect(extractPhotosMock).toHaveBeenCalledTimes(1)
        expect(compareMock).not.toHaveBeenCalled()

        // Moving to Product B still points the Shopper back at the failing side.
        const stepper = screen.getByRole("navigation", {
            name: "Comparison steps",
        })
        await user.click(
            within(stepper).getByRole("button", { name: /Product B/i }),
        )
        expect(screen.getByAltText("Product B photo 1")).toBeInTheDocument()
        expect(
            screen.getByText(
                "Product A could not be read. Go back to Product A to fix its photos.",
            ),
        ).toBeInTheDocument()
    })

    test("turns an unreadable preview into an accessible replaceable error state", () => {
        const onPhotoPreviewError = vi.fn()
        const photo = {
            file: new File(["broken"], "broken.jpg", { type: "image/jpeg" }),
            url: "blob:http://localhost/broken",
            localId: "broken-photo",
        }
        const product: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [photo],
            extraction: null,
            selectedColumnId: null,
            loading: false,
            error: "This photo could not be opened. Replace it or remove it before comparing.",
            retry: false,
            revision: 1,
        }

        const { rerender } = render(
            <ProductPhotoPanel
                product={{ ...product, error: "" }}
                highlightedPhotoId={null}
                previewRefs={{ current: {} }}
                onTitleChange={vi.fn()}
                onAddFiles={vi.fn()}
                onRemovePhoto={vi.fn()}
                onReplacePhoto={vi.fn()}
                onClearPhotos={vi.fn()}
                onPhotoPreviewError={onPhotoPreviewError}
                onFocusEvidence={vi.fn()}
            />,
        )

        fireEvent.error(screen.getByAltText("Product A photo 1"))
        expect(onPhotoPreviewError).toHaveBeenCalledWith(0)

        rerender(
            <ProductPhotoPanel
                product={{
                    ...product,
                    photos: [{ ...photo, previewError: true }],
                }}
                highlightedPhotoId={null}
                previewRefs={{ current: {} }}
                onTitleChange={vi.fn()}
                onAddFiles={vi.fn()}
                onRemovePhoto={vi.fn()}
                onReplacePhoto={vi.fn()}
                onClearPhotos={vi.fn()}
                onPhotoPreviewError={onPhotoPreviewError}
                onFocusEvidence={vi.fn()}
            />,
        )

        const alert = screen.getByRole("alert")
        expect(alert).toHaveTextContent("This photo could not be used")
        expect(alert).toHaveTextContent(
            "This photo could not be opened. Replace it or remove it before comparing.",
        )
        expect(
            screen.getByRole("img", {
                name: "This photo could not be opened. Replace it or remove it before comparing.",
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Replace photo 1" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Remove photo 1" }),
        ).toBeInTheDocument()
    })
})

describe("Nutrition chooser direct entry", () => {
    test.each(["left", "right", "invalid"])(
        "ignores a legacy column=%s parameter and renders the intro",
        async (side) => {
            render(
                <MemoryRouter initialEntries={[`/compare?column=${side}`]}>
                    <ComparisonNavigationProbe />
                    <PhotoComparisonPage />
                </MemoryRouter>,
            )
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
            expect(
                await screen.findByRole("button", { name: "Get started" }),
            ).toBeInTheDocument()
            expect(
                screen.queryByRole("heading", {
                    name: /Select nutrition column/i,
                }),
            ).not.toBeInTheDocument()
        },
    )
})

describe("Compare Products uncertainty, partial results, and recovery (#124)", () => {
    test("several columns auto-select the per-100g basis and continue without a chooser", async () => {
        const user = userEvent.setup()
        const extractPhotosMock = vi.fn().mockImplementation((id: string) =>
            Promise.resolve(
                id === "left"
                    ? {
                          schema_version: 1,
                          product_id: "left",
                          images: [
                              {
                                  image_id: "img_a1",
                                  original_image_id: "img_a1",
                                  role: "label",
                                  width: 800,
                                  height: 600,
                              },
                          ],
                          package_quantity: null,
                          nutrition_columns: [
                              {
                                  column_id: "col_dry",
                                  label: "Dry mix",
                                  state: "readable",
                                  basis: "per_100g",
                                  preparation_state: "as_sold",
                                  fields: [],
                              },
                              {
                                  column_id: "col_prep",
                                  label: "Prepared with milk",
                                  state: "readable",
                                  basis: "per_serving",
                                  preparation_state: "as_prepared",
                                  fields: [],
                              },
                          ],
                          outcome: "complete",
                          provider: "google",
                          model: "gemini",
                          configuration_version: "1.0.0",
                      }
                    : {
                          schema_version: 1,
                          product_id: "right",
                          images: [
                              {
                                  image_id: "img_b1",
                                  original_image_id: "img_b1",
                                  role: "label",
                                  width: 800,
                                  height: 600,
                              },
                          ],
                          package_quantity: null,
                          nutrition_columns: [
                              {
                                  column_id: "col_sole",
                                  label: "Per 100g",
                                  state: "readable",
                                  basis: "per_100g",
                                  preparation_state: "as_sold",
                                  fields: [],
                              },
                          ],
                          outcome: "complete",
                          provider: "google",
                          model: "gemini",
                          configuration_version: "1.0.0",
                      },
            ),
        )

        const compareMock = vi.fn().mockResolvedValue({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "protein",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "col_dry",
                        observation: {
                            field_id: "left_prot",
                            nutrient: "protein",
                            label: "Protein",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "12",
                            unit_text: "g",
                            evidence: [{ image_id: "img_a1" }],
                        },
                        basis: "per_serving",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "col_sole",
                        observation: {
                            field_id: "right_prot",
                            nutrient: "protein",
                            label: "Protein",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "8",
                            unit_text: "g",
                            evidence: [{ image_id: "img_b1" }],
                        },
                        basis: "per_serving",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "12",
                        unit: "g",
                        target_basis: "per_serving",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "8",
                        unit: "g",
                        target_basis: "per_serving",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "4",
                        unit: "g",
                        target_basis: "per_serving",
                        inputs: [],
                    },
                },
            ],
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos for both products
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Tap Compare Products
        const compareBtn = await openCompareReview(user)
        await user.click(compareBtn)

        // Extraction runs for both
        expect(extractPhotosMock).toHaveBeenCalledTimes(2)

        // Product A has 2 columns; the per-100g one is picked automatically
        // and the comparison starts without asking the Shopper to choose.
        await waitFor(() => expect(compareMock).toHaveBeenCalledTimes(1))
        expect(
            screen.queryByRole("heading", {
                name: /Select nutrition column/i,
            }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Select column" }),
        ).not.toBeInTheDocument()
        expect(compareMock.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({
                left_column_id: "col_dry",
                right_column_id: "col_sole",
            }),
        )
        expect(
            (
                compareMock.mock.calls[0]?.[1] as
                    { signal?: AbortSignal } | undefined
            )?.signal,
        ).toBeInstanceOf(AbortSignal)

        // Comparison results render the Product values without a difference column
        expect(screen.getByText("Protein")).toBeInTheDocument()
        expect(screen.getByText("12 g")).toBeInTheDocument()
        expect(screen.getByText("8 g")).toBeInTheDocument()
        expect(
            screen.queryByRole("columnheader", { name: "Difference" }),
        ).not.toBeInTheDocument()

        // Printed package headers are never shown as basis options
        expect(screen.queryByText("Dry mix")).not.toBeInTheDocument()
        expect(screen.queryByText("Prepared with milk")).not.toBeInTheDocument()
    })

    test("states shared basis and preparation context for each comparison", () => {
        const mockRow: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "fat",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "f1",
                            nutrient: "fat",
                            label: "Total Fat",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "15",
                            unit_text: "g",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_serving",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "f2",
                            nutrient: "fat",
                            label: "Total Fat",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "10",
                            unit_text: "g",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_serving",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "15",
                        unit: "g",
                        target_basis: "per_serving",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "10",
                        unit: "g",
                        target_basis: "per_serving",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "5",
                        unit: "g",
                        target_basis: "per_serving",
                        inputs: [],
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: null,
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const rightProd: ProductSideState = {
            id: "right",
            title: "Product B",
            number: "2",
            photos: [],
            extraction: null,
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockRow}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // Shared basis and preparation state are stated once above the values.
        expect(
            screen.getByText("Comparison basis: Per serving"),
        ).toBeInTheDocument()
        expect(
            screen.getByText(
                "Both Products use the per-serving values shown on their labels.",
            ),
        ).toBeInTheDocument()
        expect(screen.getByText(/Preparation: As sold\./)).toBeInTheDocument()
        // The basis card is always readable; nothing is hidden behind a toggle.
        const basisNote = screen.getByRole("note", {
            name: "Comparison basis: Per serving",
        })
        expect(basisNote.querySelector("details")).toBeNull()

        // Leads with Product identities
        expect(
            screen.getByRole("heading", {
                name: "Product A vs Product B",
            }),
        ).toBeInTheDocument()
        expect(screen.getAllByText("Product A").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Product B").length).toBeGreaterThan(0)

        // Result rows do not repeat source evidence or derivation details.
        expect(
            screen.queryByText("Evidence & calculation"),
        ).not.toBeInTheDocument()
    })

    test("results lead with Product identities, comparison basis, and nutrition comparison without row evidence disclosures", () => {
        const mockDisclosedComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "sodium",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "sod_1",
                            nutrient: "sodium",
                            label: "Sodium",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "1.38",
                            unit_text: "g",
                            evidence: [{ image_id: "img_label_1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "sod_2",
                            nutrient: "sodium",
                            label: "Sodium",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "500",
                            unit_text: "mg",
                            evidence: [{ image_id: "img_label_2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "1380",
                        unit: "mg",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "500",
                        unit: "mg",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "880",
                        unit: "mg",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Crisps A",
            number: "1",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "left",
                images: [
                    {
                        image_id: "img_label_1",
                        original_image_id: "img_label_1",
                        role: "label",
                        width: 800,
                        height: 600,
                    },
                ],
                package_quantity: null,
                nutrition_columns: [],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        const rightProd: ProductSideState = {
            id: "right",
            title: "Crisps B",
            number: "2",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "right",
                images: [
                    {
                        image_id: "img_label_2",
                        original_image_id: "img_label_2",
                        role: "label",
                        width: 800,
                        height: 600,
                    },
                ],
                package_quantity: null,
                nutrition_columns: [],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockDisclosedComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // 1. Leads with Product identities
        expect(
            screen.getByRole("heading", {
                name: "Crisps A vs Crisps B",
            }),
        ).toBeInTheDocument()
        expect(screen.getAllByText("Crisps A").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Crisps B").length).toBeGreaterThan(0)

        // 2. Comparison basis notice
        expect(
            screen.getByText("Comparison basis: Per 100 g"),
        ).toBeInTheDocument()

        // 3. Nutrition table leads with comparison
        expect(screen.getByText("Sodium")).toBeInTheDocument()
        expect(screen.getAllByText("1,380 mg").length).toBeGreaterThan(0)
        expect(screen.getByText("500 mg")).toBeInTheDocument()
        expect(
            screen.queryByRole("columnheader", { name: "Difference" }),
        ).not.toBeInTheDocument()

        // Row evidence and secondary calculation disclosures are not repeated
        // in the results.
        expect(
            screen.queryByText("How these values were compared"),
        ).not.toBeInTheDocument()
        expect(
            screen
                .getByRole("note", { name: "Comparison basis: Per 100 g" })
                .querySelector("details"),
        ).toBeNull()
        expect(
            screen.queryByText("Evidence & calculation"),
        ).not.toBeInTheDocument()
        expect(screen.queryByText(/Printed:/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/View photo 1/i)).not.toBeInTheDocument()
    })

    test("handles partial extractions, unreadable values, and explicit zero distinct from missing data", () => {
        const mockPartialComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "sugar",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "sug_0",
                            nutrient: "sugar",
                            label: "Sugars",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "0",
                            unit_text: "g",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "sug_5",
                            nutrient: "sugar",
                            label: "Sugars",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "5",
                            unit_text: "g",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "0",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "5",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "-5",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
                {
                    nutrient: "calcium",
                    row_kind: "amount",
                    state: "not_comparable",
                    reason: "Not found in photos for the other product.",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "calc_1",
                            nutrient: "calcium",
                            label: "Calcium",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "200",
                            unit_text: "mg",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                },
                {
                    nutrient: "iron",
                    row_kind: "amount",
                    state: "not_comparable",
                    reason: "One or both observations are not readable.",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "iron_1",
                            nutrient: "iron",
                            label: "Iron",
                            state: "unreadable",
                            row_kind: "amount",
                            qualifier: "exact",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "iron_2",
                            nutrient: "iron",
                            label: "Iron",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "4",
                            unit_text: "mg",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: null,
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const rightProd: ProductSideState = {
            id: "right",
            title: "Product B",
            number: "2",
            photos: [],
            extraction: null,
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockPartialComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // 1. Explicit zero is shown as "0 g", NOT treated as missing
        expect(screen.getAllByText("0 g").length).toBeGreaterThan(0)
        expect(screen.getByText("5 g")).toBeInTheDocument()

        // 2. Missing calcium on right product shows a "—" placeholder (with
        //    accessible text) plus a legend entry, and never zero
        expect(
            screen.getAllByText("Not found in these photos").length,
        ).toBeGreaterThanOrEqual(2)
        expect(screen.getAllByText("—").length).toBeGreaterThan(0)
        expect(screen.getByText("200 mg")).toBeInTheDocument()

        // 3. Unreadable iron shows a "?" placeholder and never zero
        expect(
            screen.getAllByText("Could not read this value").length,
        ).toBeGreaterThanOrEqual(2)
        expect(screen.getAllByText("?").length).toBeGreaterThan(0)
        expect(screen.getByText("4 mg")).toBeInTheDocument()
        expect(
            screen.queryByText("One or both observations are not readable."),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Not comparable")).not.toBeInTheDocument()
        expect(
            screen.queryByText("Not found in photos for the other product."),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByLabelText("Evidence for Calcium"),
        ).not.toBeInTheDocument()
    })

    test("displays conflicting values and suppresses definitive difference for unknown preparation", () => {
        const mockConflictingAndConditional: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "sodium",
                    row_kind: "amount",
                    state: "not_comparable",
                    reason: "One or both observations are not readable.",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "sod_conflict",
                            nutrient: "sodium",
                            label: "Sodium",
                            state: "conflicting",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "500",
                            unit_text: "mg",
                            alternatives: [
                                {
                                    value_text: "650",
                                    unit_text: "mg",
                                    state: "readable",
                                    evidence: [{ image_id: "img_alt" }],
                                },
                            ],
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "sod_r",
                            nutrient: "sodium",
                            label: "Sodium",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "400",
                            unit_text: "mg",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                },
                {
                    nutrient: "energy",
                    row_kind: "amount",
                    state: "conditional",
                    reason: "Preparation state is unknown, so the normalized values are conditional.",
                    assumptions: [
                        "Preparation state is unknown for at least one Product.",
                    ],
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "nrg_1",
                            nutrient: "energy",
                            label: "Energy",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "150",
                            unit_text: "kcal",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "unknown",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "nrg_2",
                            nutrient: "energy",
                            label: "Energy",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "150",
                            unit_text: "kcal",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "150",
                        unit: "kcal",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "150",
                        unit: "kcal",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "0",
                        unit: "kcal",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: null,
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const rightProd: ProductSideState = {
            id: "right",
            title: "Product B",
            number: "2",
            photos: [],
            extraction: null,
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockConflictingAndConditional}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // Conflicting values are visible
        expect(
            screen.getByText(/Conflicting values on label:/i),
        ).toBeInTheDocument()
        expect(screen.getByText("500 mg")).toBeInTheDocument()
        expect(screen.getByText("vs 650 mg")).toBeInTheDocument()

        // Conditional normalization details are not rendered in the results table.
        expect(screen.queryByText("Not comparable")).not.toBeInTheDocument()
        expect(
            screen.queryByText(
                "Preparation state is unknown, so the normalized values are conditional.",
            ),
        ).not.toBeInTheDocument()
        expect(
            screen.getByText(
                "Preparation: Product A — Not specified; Product B — As sold.",
            ),
        ).toBeInTheDocument()
        expect(screen.queryByText("Equal amount")).not.toBeInTheDocument()
        expect(screen.queryByText("Identical amount")).not.toBeInTheDocument()
    })

    test("clearly shows equal nutrient values without a calculated difference section", () => {
        const mockEqualComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "fiber",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "fib_1",
                            nutrient: "fiber",
                            label: "Dietary Fiber",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "3",
                            unit_text: "g",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "fib_2",
                            nutrient: "fiber",
                            label: "Dietary Fiber",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "3",
                            unit_text: "g",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "3",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "3",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "0",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: null,
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const rightProd: ProductSideState = {
            id: "right",
            title: "Product B",
            number: "2",
            photos: [],
            extraction: null,
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockEqualComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        expect(screen.getAllByText("3 g").length).toBeGreaterThan(0)
        expect(screen.queryByText("Equal amount")).not.toBeInTheDocument()
        expect(screen.queryByText("Identical amount")).not.toBeInTheDocument()
    })

    test("actionable error recovery and retry preserves unaffected work", async () => {
        const user = userEvent.setup()
        let rightShouldFail = true

        const extractPhotosMock = vi.fn().mockImplementation((id: string) => {
            if (id === "left") {
                return Promise.resolve({
                    schema_version: 1,
                    product_id: "left",
                    images: [
                        {
                            image_id: "img_a",
                            original_image_id: "img_a",
                            role: "label",
                            width: 800,
                            height: 600,
                        },
                    ],
                    package_quantity: null,
                    nutrition_columns: [
                        {
                            column_id: "c1",
                            name: "Per 100g",
                            state: "readable",
                            basis: "per_100g",
                            preparation_state: "as_sold",
                            fields: [],
                        },
                    ],
                    outcome: "complete",
                    provider: "google",
                    model: "gemini",
                    configuration_version: "1.0.0",
                })
            }
            if (rightShouldFail) {
                return Promise.reject(
                    new Error(
                        "provider_timeout: The extraction provider timed out.",
                    ),
                )
            }
            return Promise.resolve({
                schema_version: 1,
                product_id: "right",
                images: [
                    {
                        image_id: "img_b",
                        original_image_id: "img_b",
                        role: "label",
                        width: 800,
                        height: 600,
                    },
                ],
                package_quantity: null,
                nutrition_columns: [
                    {
                        column_id: "c2",
                        name: "Per 100g",
                        state: "readable",
                        basis: "per_100g",
                        preparation_state: "as_sold",
                        fields: [],
                    },
                ],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            })
        })

        const compareMock = vi.fn().mockResolvedValue({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [],
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos for both
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        const compareBtn = await openCompareReview(user)
        await user.click(compareBtn)

        // Product A succeeded, Product B failed with timeout
        expect(extractPhotosMock).toHaveBeenCalledTimes(2)
        expect(
            screen.getAllByText(
                /Photo processing request timed out\. Please check your connection and tap Retry\./i,
            ).length,
        ).toBeGreaterThan(0)

        // Button shows "Retry comparison"
        const retryBtn = screen.getByRole("button", {
            name: "Retry comparison",
        })
        expect(retryBtn).toBeInTheDocument()

        // Now fix Product B and retry
        rightShouldFail = false
        await user.click(retryBtn)

        // Product A's work was preserved! Only Product B was called on retry!
        // So total calls to extractPhotosMock is now 3 (left: 1, right: 2)
        expect(extractPhotosMock).toHaveBeenCalledTimes(3)
        const lastCall = extractPhotosMock.mock.calls.at(-1)
        expect(lastCall?.[0]).toBe("right")
        expect(Array.isArray(lastCall?.[1])).toBe(true)
        expect(
            (lastCall?.[2] as { signal?: AbortSignal } | undefined)?.signal,
        ).toBeInstanceOf(AbortSignal)
    })

    test("retake-required and partial outcomes show actionable guidance in ProductPhotoPanel", () => {
        const retakeProduct: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "left",
                images: [],
                package_quantity: null,
                nutrition_columns: [],
                outcome: "retake_required",
                retake_reasons: [
                    "Nutrition facts panel is blurry or out of focus.",
                    "Glare reflects across the serving size line.",
                ],
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: null,
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ProductPhotoPanel
                product={retakeProduct}
                highlightedPhotoId={null}
                previewRefs={{ current: {} }}
                onTitleChange={vi.fn()}
                onAddFiles={vi.fn()}
                onRemovePhoto={vi.fn()}
                onReplacePhoto={vi.fn()}
                onClearPhotos={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // Actionable guidance for unreadable photos
        expect(screen.getByText("Retake photo")).toBeInTheDocument()
        expect(
            screen.getByText(
                /Add a clear close-up of the Nutrition Facts panel/i,
            ),
        ).toBeInTheDocument()
        expect(
            screen.getByText(
                "Nutrition facts panel is blurry or out of focus.",
            ),
        ).toBeInTheDocument()
        expect(
            screen.getByText("Glare reflects across the serving size line."),
        ).toBeInTheDocument()
    })
})

describe("Compare Products obsolete-response safety (#125)", () => {
    function createDeferred<T>() {
        let resolve!: (val: T) => void
        let reject!: (err: unknown) => void
        const promise = new Promise<T>((res, rej) => {
            resolve = res
            reject = rej
        })
        return { promise, resolve, reject }
    }

    test("replacing photos while extraction is pending cancels in-flight extraction and prevents stale results", async () => {
        const user = userEvent.setup()
        let capturedSignal: AbortSignal | undefined
        const deferredLeft = createDeferred<Extraction>()

        const extractPhotosMock = vi
            .fn()
            .mockImplementation(
                (
                    id: string,
                    _photos: File[],
                    options?: { signal?: AbortSignal },
                ) => {
                    if (id === "left") {
                        capturedSignal = options?.signal
                        return deferredLeft.promise
                    }
                    return Promise.resolve({
                        schema_version: 1,
                        product_id: "right",
                        images: [],
                        package_quantity: null,
                        nutrition_columns: [
                            {
                                column_id: "c_right",
                                label: "Per 100g",
                                basis: "per_100g",
                                preparation_state: "as_sold",
                                fields: [],
                            },
                        ],
                        outcome: "complete",
                        provider: "google",
                        model: "gemini",
                        configuration_version: "1.0.0",
                    })
                },
            )

        const compareMock = vi.fn().mockResolvedValue({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [],
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload initial photos
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [
                    new File(["photo1"], "photo1.jpg", { type: "image/jpeg" }),
                ],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [
                    new File(["photoB"], "photoB.jpg", { type: "image/jpeg" }),
                ],
            },
        })

        // Tap Compare Products
        const compareBtn = await openCompareReview(user)
        await user.click(compareBtn)

        // Extraction for Left is in flight
        expect(extractPhotosMock.mock.calls[0]?.[0]).toBe("left")
        expect(Array.isArray(extractPhotosMock.mock.calls[0]?.[1])).toBe(true)
        expect(
            (
                extractPhotosMock.mock.calls[0]?.[2] as
                    { signal?: AbortSignal } | undefined
            )?.signal,
        ).toBeInstanceOf(AbortSignal)
        expect(capturedSignal?.aborted).toBe(false)
        expect(
            screen.getByText("Reading Product A photos…"),
        ).toBeInTheDocument()

        // User replaces Left photo with a new photo while extraction is pending
        const replaceInput = document.getElementById(
            "replace-file-left-0",
        ) as HTMLInputElement
        fireEvent.change(replaceInput, {
            target: {
                files: [
                    new File(["photo2"], "photo2.jpg", { type: "image/jpeg" }),
                ],
            },
        })

        // In-flight request was aborted
        expect(capturedSignal?.aborted).toBe(true)

        // Now resolve the old extraction promise
        deferredLeft.resolve({
            schema_version: 1,
            product_id: "left",
            identity: {
                name: { field_id: "name", value_text: "Stale Noodle" },
            },
            images: [],
            package_quantity: null,
            nutrition_columns: [
                {
                    column_id: "c_stale",
                    label: "Per Serving",
                    basis: "per_serving",
                    preparation_state: "as_sold",
                    fields: [],
                },
            ],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        })

        await Promise.resolve()

        // Stale extraction title "Stale Noodle" should NOT appear!
        expect(
            screen.queryByDisplayValue("Stale Noodle"),
        ).not.toBeInTheDocument()
        // Stale comparison must NOT have been called!
        expect(compareMock).not.toHaveBeenCalled()
        // Button should be "Compare Products", not stuck in loading
        expect(
            screen.getByRole("button", { name: "Compare Products" }),
        ).toBeEnabled()
    })

    test("auto-selects the basis, starts comparing, and rejects a cancelled response", async () => {
        const user = userEvent.setup()

        const deferredCompare1 = createDeferred<ComparisonResponse>()
        const capturedSignals: AbortSignal[] = []

        const leftExtractionWithTwoCols: Extraction = {
            schema_version: 1,
            product_id: "left",
            images: [],
            package_quantity: null,
            nutrition_columns: [
                {
                    column_id: "col_dry",
                    label: "As Sold (Dry)",
                    basis: "per_100g",
                    preparation_state: "as_sold",
                    fields: [],
                },
                {
                    column_id: "col_prep",
                    label: "Prepared",
                    basis: "per_100g",
                    preparation_state: "as_prepared",
                    fields: [],
                },
            ],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        }

        const rightExtraction: Extraction = {
            schema_version: 1,
            product_id: "right",
            images: [],
            package_quantity: null,
            nutrition_columns: [
                {
                    column_id: "col_right",
                    label: "Per 100g",
                    basis: "per_100g",
                    preparation_state: "as_sold",
                    fields: [],
                },
            ],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        }

        const extractPhotosMock = vi.fn().mockImplementation((id: string) => {
            return Promise.resolve(
                id === "left" ? leftExtractionWithTwoCols : rightExtraction,
            )
        })

        const compareMock = vi
            .fn()
            .mockImplementation(
                (
                    _payload: ComparisonRequest,
                    options?: { signal?: AbortSignal },
                ) => {
                    const sig = options?.signal
                    if (sig) capturedSignals.push(sig)
                    return deferredCompare1.promise
                },
            )

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos for both
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Tap Compare Products
        await user.click(await openCompareReview(user))

        // Both extractions succeed; Left has 2 columns but the per-100g one is
        // auto-selected so the comparison starts immediately.
        await waitFor(() => expect(compareMock).toHaveBeenCalledTimes(1))
        expect(
            screen.queryByRole("heading", {
                name: /Select nutrition column/i,
            }),
        ).not.toBeInTheDocument()
        expect(compareMock.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({ left_column_id: "col_dry" }),
        )
        expect(capturedSignals[0]?.aborted).toBe(false)

        await user.click(
            screen.getByRole("button", { name: "Cancel comparison" }),
        )

        // The request is cancelled and its eventual response is rejected.
        expect(capturedSignals[0]?.aborted).toBe(true)
        expect(compareMock).toHaveBeenCalledTimes(1)

        // Now resolve the older comparison 1 FIRST (out-of-order resolution) with obsolete data
        deferredCompare1.resolve({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    row_kind: "amount",
                    nutrient: "stale_result",
                    state: "not_comparable",
                    reason: "Stale reason from col dry",
                },
            ],
        })

        await Promise.resolve()

        // Obsolete response 1 must be rejected and NOT rendered!
        expect(screen.queryByText("Stale Result")).not.toBeInTheDocument()

        expect(screen.queryByText("Stale Result")).not.toBeInTheDocument()
    })

    test("cancelling during extraction prevents stale results from reappearing", async () => {
        const user = userEvent.setup()
        let capturedSignal: AbortSignal | undefined
        const deferredLeft = createDeferred<Extraction>()

        const extractPhotosMock = vi
            .fn()
            .mockImplementation(
                (
                    id: string,
                    _photos: File[],
                    options?: { signal?: AbortSignal },
                ) => {
                    if (id === "left") {
                        capturedSignal = options?.signal
                        return deferredLeft.promise
                    }
                    return Promise.resolve({
                        schema_version: 1,
                        product_id: "right",
                        images: [],
                        package_quantity: null,
                        nutrition_columns: [],
                        outcome: "complete",
                        provider: "google",
                        model: "gemini",
                        configuration_version: "1.0.0",
                    })
                },
            )

        const compareMock = vi.fn().mockResolvedValue({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [],
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Tap Compare Products
        await user.click(await openCompareReview(user))

        expect(capturedSignal?.aborted).toBe(false)
        expect(
            screen.getByText("Reading Product A photos…"),
        ).toBeInTheDocument()

        expect(
            screen.queryByRole("button", { name: /Reset session/i }),
        ).not.toBeInTheDocument()
        await user.click(
            screen.getByRole("button", { name: "Cancel comparison" }),
        )

        // Request was aborted
        expect(capturedSignal?.aborted).toBe(true)

        // Now resolve the old extraction
        deferredLeft.resolve({
            schema_version: 1,
            product_id: "left",
            identity: {
                name: { field_id: "name", value_text: "Zombie Product" },
            },
            images: [],
            package_quantity: null,
            nutrition_columns: [],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        })

        await Promise.resolve()

        // Page remains in review with the submitted photos intact.
        expect(
            screen.getByText(
                "Comparison cancelled. Your photos are still here.",
            ),
        ).toBeInTheDocument()
        expect(
            screen.queryByDisplayValue("Zombie Product"),
        ).not.toBeInTheDocument()
        expect(compareMock).not.toHaveBeenCalled()
        expect(screen.getByText("Photo 1")).toBeInTheDocument()
    })

    test("cancelling during comparison prevents stale comparison from reappearing", async () => {
        const user = userEvent.setup()
        let capturedSignal: AbortSignal | undefined
        const deferredCompare = createDeferred<ComparisonResponse>()

        const extractPhotosMock = vi.fn().mockImplementation((id: string) => {
            return Promise.resolve({
                schema_version: 1,
                product_id: id,
                images: [],
                package_quantity: null,
                nutrition_columns: [
                    {
                        column_id: `col_${id}`,
                        label: "Per 100g",
                        basis: "per_100g",
                        preparation_state: "as_sold",
                        fields: [],
                    },
                ],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            })
        })

        const compareMock = vi
            .fn()
            .mockImplementation(
                (
                    _payload: ComparisonRequest,
                    options?: { signal?: AbortSignal },
                ) => {
                    capturedSignal = options?.signal
                    return deferredCompare.promise
                },
            )

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Tap Compare Products
        await user.click(await openCompareReview(user))

        // Comparison is in flight
        expect(screen.getByText("Comparing nutrition…")).toBeInTheDocument()
        expect(capturedSignal?.aborted).toBe(false)

        await user.click(
            screen.getByRole("button", { name: "Cancel comparison" }),
        )

        // Comparison was aborted
        expect(capturedSignal?.aborted).toBe(true)

        // Resolve the stale comparison
        deferredCompare.resolve({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    row_kind: "amount",
                    nutrient: "energy",
                    state: "not_comparable",
                    reason: "Ghost Energy Reason",
                },
            ],
        })

        await Promise.resolve()

        // Ghost comparison row must NOT appear
        expect(
            screen.queryByText("Ghost Energy Reason"),
        ).not.toBeInTheDocument()
        expect(
            screen.getByText(
                "Comparison cancelled. Your photos are still here.",
            ),
        ).toBeInTheDocument()
    })

    test("leaving the page unmounts and cancels in-flight extraction and comparison requests", async () => {
        const user = userEvent.setup()
        let extractionSignal: AbortSignal | undefined
        const deferredLeft = createDeferred<Extraction>()

        const extractPhotosMock = vi
            .fn()
            .mockImplementation(
                (
                    _id: string,
                    _photos: File[],
                    options?: { signal?: AbortSignal },
                ) => {
                    extractionSignal = options?.signal
                    return deferredLeft.promise
                },
            )

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const { unmount } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage extractPhotos={extractPhotosMock} />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Tap Compare Products
        fireEvent.click(await openCompareReview(user))

        expect(extractionSignal?.aborted).toBe(false)

        // Unmount (simulate navigating away from the page)
        unmount()

        // In-flight extraction is aborted upon leaving
        expect(extractionSignal?.aborted).toBe(true)

        // Resolving deferred after unmount does not throw or log unhandled warnings
        deferredLeft.resolve({
            schema_version: 1,
            product_id: "left",
            images: [],
            package_quantity: null,
            nutrition_columns: [],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        })

        await Promise.resolve()
    })

    test("leaving the page unmounts and cancels in-flight comparison request", async () => {
        const user = userEvent.setup()
        let compareSignal: AbortSignal | undefined
        const deferredCompare = createDeferred<ComparisonResponse>()

        const extractPhotosMock = vi.fn().mockImplementation((id: string) => {
            return Promise.resolve({
                schema_version: 1,
                product_id: id,
                images: [],
                package_quantity: null,
                nutrition_columns: [
                    {
                        column_id: `col_${id}`,
                        label: "Per 100g",
                        basis: "per_100g",
                        preparation_state: "as_sold",
                        fields: [],
                    },
                ],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            })
        })

        const compareMock = vi
            .fn()
            .mockImplementation(
                (
                    _payload: ComparisonRequest,
                    options?: { signal?: AbortSignal },
                ) => {
                    compareSignal = options?.signal
                    return deferredCompare.promise
                },
            )

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const { unmount } = render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Tap Compare Products
        fireEvent.click(await openCompareReview(user))

        expect(
            await screen.findByText("Comparing nutrition…"),
        ).toBeInTheDocument()
        expect(compareSignal?.aborted).toBe(false)

        // Unmount
        unmount()

        // In-flight comparison is aborted
        expect(compareSignal?.aborted).toBe(true)

        deferredCompare.resolve({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [],
        })
        await Promise.resolve()
    })

    test("modifying Product B photos while Product A extraction is in flight stops superseded comparison flow", async () => {
        const user = userEvent.setup()
        let leftSignal: AbortSignal | undefined
        const deferredLeft = createDeferred<Extraction>()

        const extractPhotosMock = vi
            .fn()
            .mockImplementation(
                (
                    id: string,
                    _photos: File[],
                    options?: { signal?: AbortSignal },
                ) => {
                    if (id === "left") {
                        leftSignal = options?.signal
                        return deferredLeft.promise
                    }
                    return Promise.resolve({
                        schema_version: 1,
                        product_id: "right",
                        images: [],
                        package_quantity: null,
                        nutrition_columns: [],
                        outcome: "complete",
                        provider: "google",
                        model: "gemini",
                        configuration_version: "1.0.0",
                    })
                },
            )

        const compareMock = vi.fn().mockResolvedValue({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [],
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos for both
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Tap Compare Products
        fireEvent.click(await openCompareReview(user))

        expect(leftSignal?.aborted).toBe(false)
        expect(
            screen.getByText("Reading Product A photos…"),
        ).toBeInTheDocument()

        // Photo editing is unavailable while Product A extraction is pending.
        expect(
            screen.queryByLabelText("Remove photo 1"),
        ).not.toBeInTheDocument()
        fireEvent.click(
            screen.getByRole("button", { name: "Cancel comparison" }),
        )

        // Old Product A extraction resolves
        deferredLeft.resolve({
            schema_version: 1,
            product_id: "left",
            images: [],
            package_quantity: null,
            nutrition_columns: [],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        })

        await Promise.resolve()

        // Right side was NOT called with empty photos
        expect(extractPhotosMock).toHaveBeenCalledTimes(1)
        expect(extractPhotosMock.mock.calls[0]?.[0]).toBe("left")
        // Comparison was NOT triggered
        expect(compareMock).not.toHaveBeenCalled()
    })

    test.each([false, true])(
        "auto-selects the per-100g basis without a chooser when Products have several columns: %s",
        async (bothNeedChoices) => {
            const user = userEvent.setup()
            const extractPhotosMock = vi.fn().mockImplementation((id: string) =>
                Promise.resolve(
                    id === "left"
                        ? {
                              schema_version: 1,
                              product_id: "left",
                              identity: {
                                  brand: {
                                      field_id: "b",
                                      value_text: "Brand Alpha",
                                  },
                                  name: {
                                      field_id: "n",
                                      value_text: "Cereal A",
                                  },
                              },
                              images: [],
                              package_quantity: null,
                              nutrition_columns: [
                                  {
                                      column_id: "col_100g",
                                      label: "Per 100g basis",
                                      state: "readable",
                                      basis: "per_100g",
                                      preparation_state: "as_sold",
                                      fields: [],
                                  },
                                  {
                                      column_id: "col_serv",
                                      label: "Per serving basis",
                                      state: "readable",
                                      basis: "per_serving",
                                      preparation_state: "as_prepared",
                                      fields: [],
                                  },
                              ],
                              outcome: "complete",
                              provider: "google",
                              model: "gemini",
                              configuration_version: "1.0.0",
                          }
                        : {
                              schema_version: 1,
                              product_id: "right",
                              identity: {
                                  name: {
                                      field_id: "n2",
                                      value_text: "Cereal B",
                                  },
                              },
                              images: [],
                              package_quantity: null,
                              nutrition_columns: [
                                  {
                                      column_id: "col_right_100g",
                                      label: "Per 100g",
                                      state: "readable",
                                      basis: "per_100g",
                                      fields: [],
                                  },
                                  ...(bothNeedChoices
                                      ? [
                                            {
                                                column_id: "col_right_serv",
                                                label: "Right serving",
                                                state: "readable",
                                                basis: "per_serving",
                                                preparation_state: "as_sold",
                                                fields: [],
                                            },
                                        ]
                                      : []),
                              ],
                              outcome: "complete",
                              provider: "google",
                              model: "gemini",
                              configuration_version: "1.0.0",
                          },
                ),
            )

            const compareMock = vi.fn().mockResolvedValue({
                schema_version: 1,
                calculated_from_submitted_evidence: true,
                left_product_id: "left",
                right_product_id: "right",
                rows: [],
            })

            const queryClient = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            })

            render(
                <QueryClientProvider client={queryClient}>
                    <MemoryRouter initialEntries={["/compare"]}>
                        <ComparisonNavigationProbe />
                        <PhotoComparisonPage
                            extractPhotos={extractPhotosMock}
                            compare={compareMock}
                        />
                    </MemoryRouter>
                </QueryClientProvider>,
            )

            // Upload photos for both products
            const inputLeft = document.getElementById(
                "upload-photos-left",
            ) as HTMLInputElement
            const inputRight = document.getElementById(
                "upload-photos-right",
            ) as HTMLInputElement
            fireEvent.change(inputLeft, {
                target: {
                    files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
                },
            })
            fireEvent.change(inputRight, {
                target: {
                    files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
                },
            })

            // Tap Compare Products
            await user.click(await openCompareReview(user))

            // No chooser page: the app picks the per-100g column for each side.
            await waitFor(() => expect(compareMock).toHaveBeenCalledTimes(1))
            expect(
                screen.queryByRole("heading", {
                    name: /Select nutrition column/i,
                }),
            ).not.toBeInTheDocument()
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
            expect(
                screen.queryByRole("button", { name: /Select column/i }),
            ).not.toBeInTheDocument()
            expect(screen.getByTestId("comparison-url")).toHaveTextContent(
                /^\/compare$/,
            )
            expect(extractPhotosMock).toHaveBeenCalledTimes(2)
            expect(compareMock).toHaveBeenCalledTimes(1)
            expect(compareMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    left_column_id: "col_100g",
                    right_column_id: "col_right_100g",
                }),
                expect.anything(),
            )
        },
    )

    test("clarified UX: supports cancelling in-flight processing", async () => {
        const user = userEvent.setup()
        let capturedSignal: AbortSignal | undefined
        const deferred = createDeferred<Extraction>()

        const extractPhotosMock = vi
            .fn()
            .mockImplementation(
                (_: string, __: File[], opts?: { signal?: AbortSignal }) => {
                    capturedSignal = opts?.signal
                    return deferred.promise
                },
            )

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage extractPhotos={extractPhotosMock} />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Start comparing
        await user.click(await openCompareReview(user))

        // Cancel button is visible while in-flight
        const cancelBtn = screen.getByRole("button", {
            name: "Cancel comparison",
        })
        expect(cancelBtn).toBeInTheDocument()

        // Tap Cancel
        await user.click(cancelBtn)
        expect(capturedSignal?.aborted).toBe(true)
        expect(
            screen.queryByRole("button", { name: "Cancel comparison" }),
        ).not.toBeInTheDocument()
    })
})

describe("Compare Products processing experience", () => {
    test("replaces editing with truthful staged progress and preserves photos on cancel", async () => {
        const user = userEvent.setup()
        let capturedSignal: AbortSignal | undefined
        const extractPhotosMock = vi.fn(
            (
                _id: string,
                _photos: File[],
                options?: { signal?: AbortSignal },
            ) => {
                capturedSignal = options?.signal
                return new Promise<Extraction>(() => undefined)
            },
        )
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage extractPhotos={extractPhotosMock} />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["left"], "left.jpg", { type: "image/jpeg" })],
            },
        })
        await user.click(
            screen.getByRole("button", { name: /Continue to Product B/i }),
        )
        fireEvent.change(inputRight, {
            target: {
                files: [
                    new File(["right"], "right.jpg", {
                        type: "image/jpeg",
                    }),
                ],
            },
        })

        await user.click(
            screen.getByRole("button", { name: "Compare Products" }),
        )

        expect(
            screen.getByRole("heading", { name: "Reading your labels" }),
        ).toBeInTheDocument()
        expect(
            screen.getByText("Reading Product A photos…"),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("list", { name: "Comparison progress" }),
        ).toHaveTextContent("Read Product A label")
        expect(
            screen.getByText(
                /Photos are sent to the configured processing provider/i,
            ),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Cancel comparison" }),
        ).toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Reset session" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("group", { name: "Photo capture navigation" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("tab", { name: /Product A/i }),
        ).not.toBeInTheDocument()

        await user.click(
            screen.getByRole("button", { name: "Cancel comparison" }),
        )

        expect(capturedSignal?.aborted).toBe(true)
        expect(
            screen.getByText(
                "Comparison cancelled. Your photos are still here.",
            ),
        ).toBeInTheDocument()
        expect(screen.getByText("Photo 1")).toBeInTheDocument()
    })
})
