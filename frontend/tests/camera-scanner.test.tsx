import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router"
import { StrictMode } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { ScanPage } from "../src/features/scan/ScanPage"
import type { BarcodeScannerOptions } from "../src/features/scan/barcodeScanner"
import { BarcodeEntryPage } from "../src/features/search/BarcodeEntryPage"
import { LocaleProvider } from "../src/i18n/LocaleProvider"
import { AppShell } from "../src/ui/AppShell"

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }))

vi.mock("../src/features/scan/barcodeScanner", () => ({
    barcodeScanner: { start: startMock },
}))

function CurrentLocation() {
    const location = useLocation()
    return (
        <span data-testid="location">{`${location.pathname}${location.search}`}</span>
    )
}

function renderPage() {
    return render(
        <LocaleProvider>
            <MemoryRouter useTransitions={false}>
                <ScanPage />
                <CurrentLocation />
            </MemoryRouter>
        </LocaleProvider>,
    )
}

function renderScannerJourney() {
    return render(
        <StrictMode>
            <LocaleProvider>
                <MemoryRouter useTransitions={false}>
                    <AppShell>
                        <Routes>
                            <Route path="/" element={<ScanPage />} />
                            <Route
                                path="/products/:barcode"
                                element={<h1>Product result</h1>}
                            />
                            <Route
                                path="/search"
                                element={
                                    <>
                                        <h1>Other page</h1>
                                        <Link to="/">Back to Scan</Link>
                                    </>
                                }
                            />
                        </Routes>
                        <CurrentLocation />
                    </AppShell>
                </MemoryRouter>
            </LocaleProvider>
        </StrictMode>,
    )
}

function renderScannerSearchJourney() {
    return render(
        <StrictMode>
            <LocaleProvider>
                <MemoryRouter useTransitions={false}>
                    <AppShell>
                        <Routes>
                            <Route path="/" element={<ScanPage />} />
                            <Route
                                path="/search"
                                element={<BarcodeEntryPage />}
                            />
                        </Routes>
                        <CurrentLocation />
                    </AppShell>
                </MemoryRouter>
            </LocaleProvider>
        </StrictMode>,
    )
}

const vibrateMock = vi.fn()

describe("camera Barcode scanner", () => {
    beforeEach(() => {
        sessionStorage.clear()
        window.localStorage.setItem("lifegoods.locale.v1", "en")
        startMock.mockReset()
        vibrateMock.mockReset()
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia: vi.fn() },
            vibrate: vibrateMock,
        })
        window.HTMLMediaElement.prototype.pause = vi.fn()
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        })
    })

    test("explains on-device processing before camera access", () => {
        renderPage()
        expect(startMock).not.toHaveBeenCalled()
        expect(
            screen.getByRole("heading", { name: "Private camera scanning" }),
        ).toBeVisible()
        expect(
            screen.getByText("Scanning happens on your device."),
        ).toBeVisible()
        expect(
            screen
                .getByRole("heading", { name: "Private camera scanning" })
                .closest('[data-glass-surface="camera"]'),
        ).toBeNull()
        expect(
            screen.getByRole("button", { name: "Start camera" }),
        ).toHaveAttribute("data-glass", "primary")
        expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
            "href",
            "/search",
        )
    })

    test("keeps the starting state on the dark camera surface", async () => {
        const user = userEvent.setup()
        let resolveStart: (session: { stop: () => void }) => void = () => {}
        startMock.mockReturnValue(
            new Promise<{ stop: () => void }>((resolve) => {
                resolveStart = resolve
            }),
        )
        renderPage()

        await user.click(screen.getByRole("button", { name: "Start camera" }))

        const startingMessage = screen.getByText("Starting camera...", {
            selector: "p",
        })
        expect(startingMessage).toBeVisible()
        expect(
            startingMessage.closest('[data-glass-surface="camera"]'),
        ).toBeNull()

        resolveStart({ stop: vi.fn() })
    })

    test("renders the Khmer consent and typed Barcode affordance", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        renderPage()

        expect(
            screen.getByRole("heading", { name: "ស្កេនបាកូដ" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", {
                name: "ស្កេនដោយរក្សាភាពឯកជន",
            }),
        ).toBeVisible()
        expect(
            screen.getByText("ការស្កេនកើតឡើងនៅលើឧបករណ៍របស់អ្នក។"),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "ចាប់ផ្តើមកាមេរ៉ា" }),
        ).toBeVisible()
        expect(
            screen.getByRole("region", { name: "ម៉ាស៊ីនស្កេនបាកូដ" }),
        ).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "ស្វែងរក" })).toHaveAttribute(
            "href",
            "/search",
        )
        expect(screen.getByText("បាកូដ ឈ្មោះផលិតផល ឬម៉ាក")).toBeVisible()
        expect(document.documentElement).toHaveAttribute("lang", "km")
    })

    test("starts after consent and remembers only a session flag", async () => {
        const user = userEvent.setup()
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderPage()
        await user.click(screen.getByRole("button", { name: "Start camera" }))

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        expect(startMock.mock.calls[0]?.[3]).toMatchObject({
            facingMode: "environment",
        })
        expect(startMock.mock.calls[0]?.[3]).not.toHaveProperty(
            "acquisitionTimeoutMs",
        )
        expect(sessionStorage.getItem("lifegoods.scan.camera-started.v1")).toBe(
            "true",
        )
        expect(screen.getByRole("status")).toHaveTextContent("Ready to scan")
    })

    test("renders Khmer starting and ready-to-scan states", async () => {
        const user = userEvent.setup()
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderPage()

        await user.click(
            screen.getByRole("button", { name: "ចាប់ផ្តើមកាមេរ៉ា" }),
        )
        expect(screen.getByRole("status")).toHaveTextContent(
            "រួចរាល់សម្រាប់ស្កេន",
        )
        expect(screen.getByText("ដាក់បាកូដនៅក្នុងស៊ុម")).toBeVisible()
    })

    test("toggles the camera flash from the bottom control dock", async () => {
        const user = userEvent.setup()
        const setTorchMock = vi.fn().mockResolvedValue(undefined)
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({
            stop: vi.fn(),
            torchAvailable: true,
            setTorch: setTorchMock,
        })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const flashButton = screen.getByRole("button", {
            name: "Turn flash on",
        })
        expect(flashButton).toHaveAttribute("aria-pressed", "false")
        expect(flashButton).toHaveAttribute("data-glass", "neutral")
        expect(
            screen.getByRole("button", { name: "Pause camera" }),
        ).toHaveAttribute("data-glass", "neutral")
        expect(
            screen.getByRole("button", { name: "Switch camera" }),
        ).toHaveAttribute("data-glass", "neutral")

        await user.click(flashButton)
        await waitFor(() => expect(setTorchMock).toHaveBeenCalledWith(true))
        expect(
            screen.getByRole("button", { name: "Turn flash off" }),
        ).toHaveAttribute("aria-pressed", "true")
        expect(
            screen.getByRole("button", { name: "Turn flash off" }),
        ).toHaveAttribute("data-glass", "selected")

        await user.click(screen.getByRole("button", { name: "Turn flash off" }))
        await waitFor(() => expect(setTorchMock).toHaveBeenCalledWith(false))
    })

    test("localizes the Khmer camera controls and flash error", async () => {
        const user = userEvent.setup()
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        const setTorchMock = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("flash"))
        startMock.mockResolvedValue({
            stop: vi.fn(),
            torchAvailable: true,
            setTorch: setTorchMock,
        })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        expect(
            screen.getByRole("button", { name: "បើកពន្លឺកាមេរ៉ា" }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "ផ្អាកកាមេរ៉ា" }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "ប្តូរកាមេរ៉ា" }),
        ).toBeVisible()

        await user.click(
            screen.getByRole("button", { name: "បើកពន្លឺកាមេរ៉ា" }),
        )
        await waitFor(() => expect(setTorchMock).toHaveBeenCalledWith(true))
        expect(
            screen.getByRole("button", { name: "បិទពន្លឺកាមេរ៉ា" }),
        ).toHaveAttribute("aria-pressed", "true")

        await user.click(
            screen.getByRole("button", { name: "បិទពន្លឺកាមេរ៉ា" }),
        )
        expect(await screen.findByRole("status")).toHaveTextContent(
            "មិនអាចប្តូរពន្លឺបានទេ។ សាកល្បងម្តងទៀត។",
        )
    })

    test("localizes unavailable Khmer flash controls", async () => {
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn(), torchAvailable: false })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const flashButton = screen.getByRole("button", {
            name: "កាមេរ៉ានេះមិនមានពន្លឺទេ។",
        })
        expect(flashButton).toBeDisabled()
        expect(flashButton).toHaveAttribute("title", "កាមេរ៉ានេះមិនមានពន្លឺទេ។")
    })

    test("does not restart camera while the Android permission prompt is pending", async () => {
        const user = userEvent.setup()
        let resolveStart: ((session: { stop: () => void }) => void) | undefined
        startMock.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveStart = resolve
                }),
        )
        renderPage()

        await user.click(screen.getByRole("button", { name: "Start camera" }))
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden",
        })
        document.dispatchEvent(new Event("visibilitychange"))
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        })
        document.dispatchEvent(new Event("visibilitychange"))

        expect(startMock).toHaveBeenCalledTimes(1)

        resolveStart?.({ stop: vi.fn() })
        await waitFor(() =>
            expect(screen.getByRole("status")).toHaveTextContent(
                "Ready to scan",
            ),
        )
    })

    test("keeps the paused state on the dark camera surface", async () => {
        const user = userEvent.setup()
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("button", { name: "Pause camera" }))

        const pausedHeading = screen.getByRole("heading", {
            name: "Camera paused",
        })
        expect(
            pausedHeading.closest('[data-glass-surface="camera"]'),
        ).toBeNull()
        expect(
            screen.getByRole("button", { name: "Resume camera" }),
        ).toHaveAttribute("data-glass", "primary")
    })

    test("renders the Khmer paused state and resume control", async () => {
        const user = userEvent.setup()
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("button", { name: "ផ្អាកកាមេរ៉ា" }))

        expect(
            screen.getByRole("heading", { name: "កាមេរ៉ាបានផ្អាក" }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "បន្តកាមេរ៉ា" }),
        ).toBeVisible()
    })

    test("shows recovery actions when an automatic camera restart times out", async () => {
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        const timeoutError = new Error("Camera start timed out")
        timeoutError.name = "CameraStartTimeoutError"
        startMock.mockRejectedValue(timeoutError)

        renderPage()

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        const restartOptions = startMock.mock.calls[0]?.[3] as
            BarcodeScannerOptions | undefined
        expect(restartOptions).toMatchObject({
            acquisitionTimeoutMs: 5000,
            facingMode: "environment",
        })
        expect(restartOptions?.signal).toBeInstanceOf(AbortSignal)
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "The camera took too long to start. Try again, or enter the Barcode instead.",
        )
        expect(
            screen
                .getByRole("heading", { name: "Camera unavailable" })
                .closest('[data-glass-surface="camera"]'),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Try camera again" }),
        ).toHaveAttribute("data-glass", "neutral")
        expect(
            screen.getByRole("link", { name: "Enter a Barcode instead" }),
        ).toHaveAttribute("data-glass", "selected")
    })

    test.each([
        ["NotAllowedError", "អនុញ្ញាតឱ្យប្រើកាមេរ៉ា"],
        ["NotFoundError", "រកមិនឃើញកាមេរ៉ាទេ"],
        ["NotReadableError", "បិទកម្មវិធីផ្សេង"],
        ["CameraPreviewError", "ផ្ទុកទំព័រនេះឡើងវិញ"],
        ["Error", "ពិនិត្យការកំណត់"],
        ["OverconstrainedError", "ប្រើកម្មវិធីរុករកបច្ចុប្បន្ន"],
        ["AbortError", "ត្រឡប់មកទំព័រនេះ"],
        ["CameraStartTimeoutError", "ចំណាយពេលយូរពេក"],
    ] as const)(
        "localizes the Khmer camera error for %s",
        async (errorName, expectedMessage) => {
            const error = new Error(errorName)
            error.name = errorName
            window.localStorage.setItem("lifegoods.locale.v1", "km")
            sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
            startMock.mockRejectedValue(error)
            renderPage()

            expect(await screen.findByRole("alert")).toHaveTextContent(
                expectedMessage,
            )
        },
    )

    test("localizes the insecure-context camera error in Khmer", async () => {
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: false,
        })
        renderPage()

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "បើកទំព័រនេះតាម HTTPS",
        )
    })

    test("opens the Product page for a valid on-device result with sensory feedback", async () => {
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const onResult = startMock.mock.calls[0]?.[1] as (value: string) => void
        act(() => onResult("4 006381 333931"))
        expect(screen.getByRole("status")).toHaveTextContent("Barcode detected")
        expect(vibrateMock).toHaveBeenCalledWith([40, 30, 40])
        await waitFor(() =>
            expect(screen.getByTestId("location")).toHaveTextContent(
                "/products/4006381333931",
            ),
        )
    })

    test("renders Khmer detected status and aperture labels", async () => {
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const onResult = startMock.mock.calls[0]?.[1] as (value: string) => void
        act(() => onResult("4 006381 333931"))

        expect(screen.getByRole("status")).toHaveTextContent("បានរកឃើញបាកូដ")
        expect(screen.getAllByText("បានរកឃើញបាកូដ")).toHaveLength(3)
    })

    test("starts a fresh bounded camera session after returning through the Scan tab", async () => {
        const user = userEvent.setup()
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderScannerJourney()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        expect(screen.getByRole("status")).toHaveTextContent("Ready to scan")

        const onResult = startMock.mock.calls[0]?.[1] as (value: string) => void
        act(() => onResult("4006381333931"))
        await screen.findByRole("heading", { name: "Product result" })

        await user.click(screen.getByRole("link", { name: "Scan" }))

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2))
        expect(startMock.mock.calls[1]?.[3]).toMatchObject({
            acquisitionTimeoutMs: 5000,
            facingMode: "environment",
        })
        expect(screen.getByRole("status")).toHaveTextContent("Ready to scan")
    })

    test("restarts after leaving while automatic camera startup is pending", async () => {
        const user = userEvent.setup()
        let resolveFirst: ((session: { stop: () => void }) => void) | undefined
        const firstStopMock = vi.fn()
        const secondStopMock = vi.fn()

        startMock
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveFirst = resolve
                    }),
            )
            .mockResolvedValueOnce({ stop: secondStopMock })
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        renderScannerJourney()

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        await user.click(screen.getByRole("link", { name: "Search" }))
        await screen.findByRole("heading", { name: "Other page" })

        resolveFirst?.({ stop: firstStopMock })
        await waitFor(() => expect(firstStopMock).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("link", { name: "Back to Scan" }))
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2))
        expect(screen.getByRole("status")).toHaveTextContent("Ready to scan")
        expect(secondStopMock).not.toHaveBeenCalled()
    })

    test("sends an invalid result to typed Barcode correction", async () => {
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const onResult = startMock.mock.calls[0]?.[1] as (value: string) => void
        act(() => onResult("12345678"))
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/search?q=12345678",
        )
    })

    test("includes only one generic search bar under brand logo that stops camera and navigates to /search", async () => {
        const user = userEvent.setup()
        const stopMock = vi.fn()
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: stopMock })
        renderPage()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const searchBars = screen.getAllByRole("link", { name: "Search" })
        expect(searchBars).toHaveLength(1)
        const searchBar = searchBars[0]!
        expect(searchBar).toBeVisible()
        expect(searchBar).toHaveAttribute("href", "/search")
        expect(searchBar).toHaveAttribute("data-glass", "neutral")
        expect(searchBar).toHaveClass("font-normal")
        expect(screen.getByText("barcode, product, or brand")).toBeVisible()

        await user.click(searchBar)
        expect(stopMock).toHaveBeenCalled()
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
    })

    test.each(["Search", "Enter a Barcode instead"])(
        "focuses Search during the first touch on %s without using a view transition",
        async (linkName) => {
            const stopMock = vi.fn()
            const startViewTransition = vi.fn()
            sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
            if (linkName === "Enter a Barcode instead") {
                startMock.mockRejectedValue(new Error("Camera unavailable"))
            } else {
                startMock.mockResolvedValue({ stop: stopMock })
            }
            Object.defineProperty(document, "startViewTransition", {
                configurable: true,
                value: startViewTransition,
            })

            try {
                renderScannerSearchJourney()
                await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

                const link = await screen.findByRole("link", { name: linkName })
                let focusedDuringActivation = false
                const observeActivation = () => {
                    const input = document.getElementById("search")
                    focusedDuringActivation =
                        input instanceof HTMLInputElement &&
                        document.activeElement === input
                }
                const touch = new Event("pointerdown", {
                    bubbles: true,
                    cancelable: true,
                })
                Object.defineProperty(touch, "pointerType", { value: "touch" })
                document.addEventListener("pointerdown", observeActivation)
                try {
                    fireEvent(link, touch)
                } finally {
                    document.removeEventListener(
                        "pointerdown",
                        observeActivation,
                    )
                }
                expect(focusedDuringActivation).toBe(true)
                if (linkName === "Search") expect(stopMock).toHaveBeenCalled()

                const input = await screen.findByRole("textbox", {
                    name: "Search",
                })
                expect(screen.getByTestId("location")).toHaveTextContent(
                    "/search",
                )
                expect(input).toHaveFocus()
                expect(startViewTransition).not.toHaveBeenCalled()
                expect(
                    document.getElementById("mobile-keyboard-bridge"),
                ).not.toBeInTheDocument()
            } finally {
                Reflect.deleteProperty(document, "startViewTransition")
            }
        },
    )

    test("localizes the Khmer typed Barcode fallback link", async () => {
        const user = userEvent.setup()
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        const error = new Error("No camera")
        error.name = "NotFoundError"
        startMock.mockRejectedValue(error)
        renderPage()

        await screen.findByRole("alert")
        const fallback = screen.getByRole("link", {
            name: "បញ្ចូលបាកូដជំនួស",
        })
        expect(fallback).toHaveAttribute("href", "/search")

        await user.click(fallback)
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
    })
})
