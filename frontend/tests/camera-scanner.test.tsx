import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }))

vi.mock("../src/features/package-match/barcodeScanner", () => ({
    barcodeScanner: { start: startMock },
}))

function renderJourney(lookup: PackageMatchLookup) {
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
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("camera barcode scanner", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
        startMock.mockReset()
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia: vi.fn() },
        })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: true,
        })
    })

    test("does not request camera access until the shopper starts it", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        renderJourney(lookup)

        expect(startMock).not.toHaveBeenCalled()
        expect(
            screen.getByRole("button", { name: "Start camera" }),
        ).toBeVisible()

        const stop = vi.fn()
        startMock.mockResolvedValue({ stop })
        await user.click(screen.getByRole("button", { name: "Start camera" }))

        expect(startMock).toHaveBeenCalledTimes(1)
        expect(
            await screen.findByRole("button", { name: "Stop camera" }),
        ).toBeVisible()
    })

    test("shows an attached preview while scanner startup is still pending", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        startMock.mockImplementation(async (video: HTMLVideoElement) => {
            Object.defineProperty(video, "srcObject", {
                configurable: true,
                value: {},
            })
            await new Promise<never>(() => undefined)
        })
        renderJourney(lookup)

        await user.click(screen.getByRole("button", { name: "Start camera" }))

        await waitFor(() =>
            expect(document.querySelector("video")).toHaveClass("opacity-100"),
        )
    })

    test("stops the camera and opens the existing result journey once a valid code is found", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        const stop = vi.fn()
        startMock.mockResolvedValue({ stop })
        renderJourney(lookup)

        await user.click(screen.getByRole("button", { name: "Start camera" }))
        const onResult = startMock.mock.calls[0]?.[1] as
            ((value: string) => void) | undefined
        expect(onResult).toBeDefined()
        onResult!("4 006381 333931")

        expect(
            await screen.findByRole("heading", {
                name: "No package information found",
            }),
        ).toBeVisible()
        expect(stop).toHaveBeenCalledTimes(1)
        expect(lookup).toHaveBeenCalledWith("4006381333931")
    })

    test("explains denied permission and keeps manual entry available", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        startMock.mockRejectedValue(
            new DOMException("denied", "NotAllowedError"),
        )
        renderJourney(lookup)

        await user.click(screen.getByRole("button", { name: "Start camera" }))

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Camera access was denied",
        )
        expect(
            screen.getByRole("textbox", { name: "Barcode number" }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Try camera again" }),
        ).toBeEnabled()
    })

    test("retries camera startup after a recoverable failure", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        const stop = vi.fn()
        startMock
            .mockRejectedValueOnce(
                new DOMException("camera busy", "NotReadableError"),
            )
            .mockResolvedValueOnce({ stop })
        renderJourney(lookup)

        await user.click(screen.getByRole("button", { name: "Start camera" }))
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "camera is being used by another app",
        )

        await user.click(
            screen.getByRole("button", { name: "Try camera again" }),
        )
        expect(
            await screen.findByRole("button", { name: "Stop camera" }),
        ).toBeVisible()
        expect(startMock).toHaveBeenCalledTimes(2)
    })

    test.each([
        ["NotFoundError", "No camera was found"],
        ["NotReadableError", "camera is being used by another app"],
        ["OverconstrainedError", "requested camera mode"],
        ["AbortError", "Camera startup was interrupted"],
        ["TypeError", "requested camera mode"],
        [
            "CameraPreviewError",
            "camera opened, but the video preview did not start",
        ],
    ])("explains %s camera failures", async (errorName, message) => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        startMock.mockRejectedValue(
            new DOMException("camera failed", errorName),
        )
        renderJourney(lookup)

        await user.click(screen.getByRole("button", { name: "Start camera" }))

        expect(await screen.findByRole("alert")).toHaveTextContent(message)
        expect(
            screen.getByRole("textbox", { name: "Barcode number" }),
        ).toBeVisible()
    })

    test("explains that camera access requires a secure context", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>()
        const getUserMedia = vi.fn()
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia },
        })
        Object.defineProperty(window, "isSecureContext", {
            configurable: true,
            value: false,
        })
        renderJourney(lookup)

        await user.click(screen.getByRole("button", { name: "Start camera" }))

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Camera access requires HTTPS",
        )
        expect(getUserMedia).not.toHaveBeenCalled()
        expect(
            screen.getByRole("textbox", { name: "Barcode number" }),
        ).toBeVisible()
    })

    test("stops an active camera before manual submission", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        const stop = vi.fn()
        startMock.mockResolvedValue({ stop })
        renderJourney(lookup)

        await user.click(screen.getByRole("button", { name: "Start camera" }))
        const input = screen.getByRole("textbox", { name: "Barcode number" })
        await user.type(input, "4006381333931")
        await user.click(screen.getByRole("button", { name: "Check barcode" }))

        await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
        expect(
            await screen.findByRole("heading", {
                name: "No package information found",
            }),
        ).toBeVisible()
    })
})
