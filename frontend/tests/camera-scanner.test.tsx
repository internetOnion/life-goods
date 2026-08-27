import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { HomePage } from "../src/features/package-match/HomePage"
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

function expectFullWidthCameraPreview(container: HTMLElement) {
    const main = container.querySelector("main")
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass("pt-0", "w-full")

    const cameraSurface = container.querySelector("main > section")
    expect(cameraSurface).toBeInTheDocument()
    expect(cameraSurface).toHaveClass(
        "aspect-square",
        "w-full",
        "rounded-none",
        "border-y",
        "border-x-0",
        "sm:aspect-auto",
        "sm:rounded-3xl",
        "sm:border",
    )
    expect(cameraSurface).not.toHaveClass(
        "left-1/2",
        "w-screen",
        "-translate-x-1/2",
    )

    const form = container.querySelector("form")
    expect(form).toBeInTheDocument()
    expect(form).toHaveClass("mx-4", "max-[23.5rem]:mx-[0.625rem]", "sm:mx-0")

    const video = container.querySelector("video")
    expect(video).toBeInTheDocument()
    expect(video).toHaveClass(
        "absolute",
        "inset-0",
        "block",
        "h-full",
        "min-h-full",
        "min-w-full",
        "w-full",
        "max-w-none",
        "object-cover",
        "object-center",
    )
}

function expectScanFrame(container: HTMLElement) {
    const scanFrame = container.querySelector(
        'main > section div[class*="border-background"]',
    )
    expect(scanFrame).toBeInTheDocument()
    expect(scanFrame).toHaveClass("h-24", "w-[min(18rem,80vw)]")
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

    test("automatically requests camera access on initial load without a stop button", async () => {
        const stop = vi.fn()
        startMock.mockResolvedValue({ stop })
        const lookup = vi.fn<PackageMatchLookup>()
        const { container } = renderJourney(lookup)

        expectFullWidthCameraPreview(container)

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        expect(await screen.findByRole("status")).toHaveTextContent(
            "Place the barcode inside the scan frame.",
        )
        expectScanFrame(container)
        expect(
            container.querySelector("main > section p"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Stop camera" }),
        ).not.toBeInTheDocument()
    })

    test("shows Barcode as the selected mode and keeps Camera disabled", async () => {
        const user = userEvent.setup()
        const stop = vi.fn()
        startMock.mockResolvedValue({ stop })
        const lookup = vi.fn<PackageMatchLookup>()
        renderJourney(lookup)

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))

        const modeGroup = screen.getByRole("group", { name: "Scan method" })
        const modeButtons = within(modeGroup).getAllByRole("button")

        expect(modeButtons).toHaveLength(2)
        expect(modeButtons[0]).toHaveAccessibleName("Barcode")
        expect(modeButtons[0]).toHaveAttribute("aria-pressed", "true")
        expect(modeButtons[0]).toBeEnabled()
        expect(modeButtons[1]).toHaveAccessibleName("Camera")
        expect(modeButtons[1]).toHaveAttribute("aria-pressed", "false")
        expect(modeButtons[1]).toBeDisabled()

        await user.click(modeButtons[1]!)

        expect(modeButtons[0]).toHaveAttribute("aria-pressed", "true")
        expect(modeButtons[1]).toHaveAttribute("aria-pressed", "false")
        expect(startMock).toHaveBeenCalledTimes(1)
        expect(
            screen.getByRole("textbox", { name: "Barcode number" }),
        ).toBeVisible()
    })

    test("shows a plain camera surface while scanner startup is still pending", async () => {
        const lookup = vi.fn<PackageMatchLookup>()
        startMock.mockImplementation(async (video: HTMLVideoElement) => {
            Object.defineProperty(video, "srcObject", {
                configurable: true,
                value: {},
            })
            await new Promise<never>(() => undefined)
        })
        const { container } = renderJourney(lookup)

        expectFullWidthCameraPreview(container)

        const cameraSurface = container.querySelector("main > section")
        expect(cameraSurface).toHaveClass("bg-background")
        expect(cameraSurface?.querySelector("p")).not.toBeInTheDocument()
        expect(cameraSurface?.querySelector("svg")).not.toBeInTheDocument()
        expect(await screen.findByRole("status")).toHaveTextContent(
            "Starting camera…",
        )
        expect(screen.queryByText("Tap start to scan")).not.toBeInTheDocument()
    })

    test("stops the camera and opens the existing result journey once a valid code is found", async () => {
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        const stop = vi.fn()
        startMock.mockResolvedValue({ stop })
        renderJourney(lookup)

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
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
        const lookup = vi.fn<PackageMatchLookup>()
        startMock.mockRejectedValue(
            new DOMException("denied", "NotAllowedError"),
        )
        renderJourney(lookup)

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

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "camera is being used by another app",
        )

        await user.click(
            screen.getByRole("button", { name: "Try camera again" }),
        )
        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2))
        expect(await screen.findByRole("status")).toHaveTextContent(
            "Place the barcode inside the scan frame.",
        )
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
        const lookup = vi.fn<PackageMatchLookup>()
        startMock.mockRejectedValue(
            new DOMException("camera failed", errorName),
        )
        renderJourney(lookup)

        expect(await screen.findByRole("alert")).toHaveTextContent(message)
        expect(
            screen.getByRole("textbox", { name: "Barcode number" }),
        ).toBeVisible()
    })

    test("explains that camera access requires a secure context", async () => {
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

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
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

    test("does not start camera when HomePage is rendered as a modal background", () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <HomePage
                        initialIdentifier=""
                        isModalBackground={true}
                        onIdentifierChange={vi.fn()}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        expect(startMock).not.toHaveBeenCalled()
    })

    test("resumes camera automatically when returning to the home screen", async () => {
        const user = userEvent.setup()
        const lookup = vi.fn<PackageMatchLookup>().mockResolvedValue({
            normalized_identifier: "4006381333931",
            scheme: "EAN_13",
            candidates: [],
        })
        const stop = vi.fn()
        startMock.mockResolvedValue({ stop })
        renderJourney(lookup)

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1))
        const onResult = startMock.mock.calls[0]?.[1] as
            ((value: string) => void) | undefined
        onResult!("4006381333931")

        expect(
            await screen.findByRole("heading", {
                name: "No package information found",
            }),
        ).toBeVisible()
        expect(stop).toHaveBeenCalledTimes(1)

        const backButton = screen.getByRole("button", {
            name: "Close result",
        })
        await user.click(backButton)

        await waitFor(() => expect(startMock).toHaveBeenCalledTimes(2))
    })
})
