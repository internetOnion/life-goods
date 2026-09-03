import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { ScanPage } from "../src/features/scan/ScanPage"

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
            screen.getByRole("heading", { name: "Your camera stays private" }),
        ).toBeVisible()
        expect(
            screen.getByText(/does not upload, store, or share/),
        ).toBeVisible()
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
        expect(startMock.mock.calls[0]?.[3]).toEqual({
            facingMode: "environment",
        })
        expect(sessionStorage.getItem("lifegoods.scan.camera-started.v1")).toBe(
            "true",
        )
        expect(screen.getByRole("status")).toHaveTextContent("Ready to scan")
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
        expect(screen.getByText("Search products...")).toBeVisible()

        await user.click(searchBar)
        expect(stopMock).toHaveBeenCalled()
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
    })
})
