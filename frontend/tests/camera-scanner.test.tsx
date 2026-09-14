import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { ScanPage } from "../src/features/scan/ScanPage"
import type { BarcodeScannerOptions } from "../src/features/scan/barcodeScanner"
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
        <MemoryRouter>
            <ScanPage />
            <CurrentLocation />
        </MemoryRouter>,
    )
}

function renderScannerJourney() {
    return render(
        <LocaleProvider>
            <MemoryRouter>
                <AppShell>
                    <Routes>
                        <Route path="/" element={<ScanPage />} />
                        <Route
                            path="/products/:barcode"
                            element={<h1>Product result</h1>}
                        />
                    </Routes>
                    <CurrentLocation />
                </AppShell>
            </MemoryRouter>
        </LocaleProvider>,
    )
}

const vibrateMock = vi.fn()

describe("camera Barcode scanner", () => {
    beforeEach(() => {
        sessionStorage.clear()
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
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Start camera" }),
        ).toHaveAttribute("data-glass", "primary")
        expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
            "href",
            "/search",
        )
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

    test("shows a dark frosted recovery panel when the camera is paused", async () => {
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
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Resume camera" }),
        ).toHaveAttribute("data-glass", "primary")
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

    test("starts a fresh bounded camera session after returning through the Scan tab", async () => {
        const user = userEvent.setup()
        sessionStorage.setItem("lifegoods.scan.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderScannerJourney()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

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
        expect(
            screen.getByText("Search Product, company or country..."),
        ).toBeVisible()

        await user.click(searchBar)
        expect(stopMock).toHaveBeenCalled()
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
    })
})
