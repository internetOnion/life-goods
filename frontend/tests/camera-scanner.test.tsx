import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"
import { packageMatchesResponse } from "./package-match-fixtures"

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }))

vi.mock("../src/features/package-match/barcodeScanner", () => ({
    barcodeScanner: { start: startMock },
}))

function renderJourney(lookup: PackageMatchLookup = vi.fn()) {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <App lookup={lookup} />
                <CurrentLocation />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

function CurrentLocation() {
    const location = useLocation()
    return (
        <span
            data-testid="location"
            hidden
        >{`${location.pathname}${location.search}`}</span>
    )
}

describe("camera barcode scanner", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
        sessionStorage.clear()
        startMock.mockReset()
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia: vi.fn() },
        })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        })
    })

    test("explains local frame processing before first camera use", () => {
        renderJourney()

        expect(startMock).not.toHaveBeenCalled()
        expect(
            screen.getByRole("heading", { name: "Before the camera starts" }),
        ).toBeVisible()
        expect(screen.getByText(/processed on this device/)).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Start camera" }),
        ).toBeEnabled()
        expect(
            screen.getByRole("link", { name: "Open Product search" }),
        ).toHaveAttribute("href", "/search")
    })

    test("starts after consent and remembers only a session flag", async () => {
        const user = userEvent.setup()
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderJourney()

        await user.click(screen.getByRole("button", { name: "Start camera" }))

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        expect(startMock.mock.calls[0]?.[3]).toEqual({
            facingMode: "environment",
        })
        expect(sessionStorage.getItem("lifegoods.camera-started.v1")).toBe(
            "true",
        )
        expect(sessionStorage.length).toBe(1)
        expect(screen.getByRole("status")).toHaveTextContent(
            "Place the barcode inside the scan frame.",
        )
    })

    test("resumes automatically later in the same browser session", async () => {
        sessionStorage.setItem("lifegoods.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderJourney()

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        expect(
            screen.queryByRole("button", { name: "Start camera" }),
        ).not.toBeInTheDocument()
    })

    test("pauses and resumes the active stream", async () => {
        const user = userEvent.setup()
        const stop = vi.fn()
        sessionStorage.setItem("lifegoods.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop })
        renderJourney()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("button", { name: "Pause camera" }))
        expect(stop).toHaveBeenCalledTimes(1)
        expect(screen.getByRole("status")).toHaveTextContent("Camera paused.")

        await user.click(screen.getByRole("button", { name: "Resume camera" }))
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2))
    })

    test("switches between rear and front camera modes", async () => {
        const user = userEvent.setup()
        const stop = vi.fn()
        sessionStorage.setItem("lifegoods.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop })
        renderJourney()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("button", { name: "Switch camera" }))

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2))
        expect(stop).toHaveBeenCalled()
        expect(startMock.mock.calls[1]?.[3]).toEqual({ facingMode: "user" })
    })

    test("stops scanning and opens a full-screen result for a valid code", async () => {
        const stop = vi.fn()
        sessionStorage.setItem("lifegoods.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop })
        const lookup = vi
            .fn<PackageMatchLookup>()
            .mockResolvedValue(packageMatchesResponse())
        renderJourney(lookup)
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const onResult = startMock.mock.calls[0]?.[1] as (value: string) => void
        act(() => onResult("4 006381 333931"))

        expect(
            await screen.findByRole("heading", {
                name: "No package information found",
            }),
        ).toBeVisible()
        expect(stop).toHaveBeenCalled()
        expect(lookup).toHaveBeenCalledWith("4006381333931")
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    })

    test("sends an invalid scanned value to Search with inline guidance", async () => {
        sessionStorage.setItem("lifegoods.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop: vi.fn() })
        renderJourney()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const onResult = startMock.mock.calls[0]?.[1] as (value: string) => void
        act(() => onResult("12345678"))

        const input = await screen.findByRole("searchbox", {
            name: "Search Products",
        })
        expect(input).toHaveValue("12345678")
        expect(screen.getByRole("alert")).toHaveTextContent(
            "That code is not a barcode format LifeGoods supports",
        )
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/search?q=12345678",
        )
    })

    test.each([
        ["NotAllowedError", "Camera access was denied"],
        ["NotFoundError", "No camera was found"],
        ["NotReadableError", "camera is being used by another app"],
        ["OverconstrainedError", "requested camera mode"],
    ])("announces %s startup failures", async (name, message) => {
        const user = userEvent.setup()
        startMock.mockRejectedValue(new DOMException("failed", name))
        renderJourney()

        await user.click(screen.getByRole("button", { name: "Start camera" }))

        expect(await screen.findByRole("alert")).toHaveTextContent(message)
        expect(
            screen.getByRole("button", { name: "Try camera again" }),
        ).toBeEnabled()
    })

    test("stops on visibility loss and resumes when visible", async () => {
        const stop = vi.fn()
        sessionStorage.setItem("lifegoods.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop })
        renderJourney()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden",
        })
        fireEvent(document, new Event("visibilitychange"))
        expect(stop).toHaveBeenCalled()

        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        })
        fireEvent(document, new Event("visibilitychange"))
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2))
    })

    test("cleans up the stream when leaving Scan", async () => {
        const user = userEvent.setup()
        const stop = vi.fn()
        sessionStorage.setItem("lifegoods.camera-started.v1", "true")
        startMock.mockResolvedValue({ stop })
        renderJourney()
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        await user.click(
            screen.getByRole("link", { name: "Open Product search" }),
        )
        await waitFor(() => expect(stop).toHaveBeenCalled())
        expect(
            await screen.findByRole("heading", { name: "Search" }),
        ).toBeVisible()
    })
})
