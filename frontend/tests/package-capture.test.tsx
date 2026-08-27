import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode } from "react"
import { MemoryRouter, useLocation, useNavigate } from "react-router"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"

function LocationProbe() {
    const location = useLocation()
    const navigate = useNavigate()
    return (
        <>
            <output data-testid="location">
                {location.pathname + location.search}
            </output>
            <button type="button" onClick={() => void navigate(-1)}>
                Browser back
            </button>
        </>
    )
}

function renderRoute(path: string, demoMode = true, strictMode = false) {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    })
    const lookup = vi.fn<PackageMatchLookup>()

    const route = (
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[path]}>
                <App lookup={lookup} demoMode={demoMode} />
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    )
    return render(strictMode ? <StrictMode>{route}</StrictMode> : route)
}

function installCamera({ error }: { error?: DOMException } = {}) {
    const track = new EventTarget() as MediaStreamTrack
    const stop = vi.fn()
    track.stop = stop
    const getUserMedia = error
        ? vi.fn().mockRejectedValue(error)
        : vi.fn().mockResolvedValue({
              getTracks: () => [track],
          })
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia },
    })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    const toBlob = vi
        .spyOn(HTMLCanvasElement.prototype, "toBlob")
        .mockImplementation((callback) =>
            callback(new Blob(["photo"], { type: "image/jpeg" })),
        )
    let photoNumber = 0
    const createObjectURL = vi.fn(() => `blob:package-photo-${++photoNumber}`)
    const revokeObjectURL = vi.fn()
    Object.defineProperties(URL, {
        createObjectURL: { configurable: true, value: createObjectURL },
        revokeObjectURL: { configurable: true, value: revokeObjectURL },
    })

    return { getUserMedia, revokeObjectURL, stop, toBlob, track }
}

async function openAndCapture(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Open camera" }))
    const video = screen.getByLabelText("Live camera preview")
    Object.defineProperties(video, {
        videoWidth: { configurable: true, value: 1280 },
        videoHeight: { configurable: true, value: 720 },
    })
    fireEvent.canPlay(video)
    await user.click(screen.getByRole("button", { name: /Take .* photo/ }))
}

describe("Package Capture journey", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    test("keeps the camera unavailable outside demo mode", () => {
        installCamera()
        renderRoute("/capture/new", false)

        expect(
            screen.getByRole("heading", { name: "New Package Capture" }),
        ).toBeVisible()
        expect(
            screen.queryByRole("button", { name: "Open camera" }),
        ).not.toBeInTheDocument()
    })

    test("waits for an explicit action before requesting camera permission", async () => {
        const user = userEvent.setup()
        const { getUserMedia } = installCamera()
        renderRoute("/capture/new?identifier=123&reason=no-match")

        expect(screen.getByText("Capture package")).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Scan barcode — Coming later" }),
        ).toBeDisabled()
        expect(getUserMedia).not.toHaveBeenCalled()

        await user.click(screen.getByRole("button", { name: "Open camera" }))

        expect(getUserMedia).toHaveBeenCalledOnce()
        expect(screen.getByText("Camera active")).toBeVisible()
    })

    test("normalizes the first step and removes unsupported query data", async () => {
        installCamera()
        renderRoute("/capture/new?unsafe=photo&identifier=123&reason=no-match")

        await waitFor(() => {
            expect(screen.getByTestId("location")).toHaveTextContent(
                "/capture/new?step=front&identifier=123&reason=no-match",
            )
        })
    })

    test("opens the camera from the keyboard", async () => {
        const user = userEvent.setup()
        const { getUserMedia } = installCamera()
        renderRoute("/capture/new")

        await user.tab()
        expect(
            screen.getByRole("button", { name: "Open camera" }),
        ).toHaveFocus()
        await user.keyboard("[Enter]")

        expect(getUserMedia).toHaveBeenCalledOnce()
    })

    test("keeps camera lifecycle working under Strict Mode", async () => {
        const user = userEvent.setup()
        installCamera()
        renderRoute("/capture/new", true, true)

        await user.click(screen.getByRole("button", { name: "Open camera" }))

        expect(screen.getByText("Camera active")).toBeVisible()
    })

    test("captures, previews, and retakes the front photo", async () => {
        const user = userEvent.setup()
        const { revokeObjectURL, stop } = installCamera()
        renderRoute("/capture/new")

        await openAndCapture(user)

        expect(screen.getByAltText("Front package preview")).toHaveAttribute(
            "src",
            "blob:package-photo-1",
        )
        expect(stop).toHaveBeenCalled()

        await user.click(
            screen.getByRole("button", { name: "Retake front photo" }),
        )

        expect(revokeObjectURL).toHaveBeenCalledWith("blob:package-photo-1")
        expect(
            screen.getByRole("button", { name: "Open camera" }),
        ).toBeVisible()
    })

    test("requires both photos and clears them before demo processing", async () => {
        const user = userEvent.setup()
        const { revokeObjectURL } = installCamera()
        const storageWrite = vi.spyOn(Storage.prototype, "setItem")
        const fetch = vi.fn()
        vi.stubGlobal("fetch", fetch)
        renderRoute(
            "/capture/new?identifier=123&reason=different-package&unsafe=photo",
        )

        await openAndCapture(user)
        await user.click(screen.getByRole("button", { name: "Continue" }))
        expect(
            screen.getByRole("heading", { name: "Photograph the ingredients" }),
        ).toHaveFocus()
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/capture/new?step=ingredients&identifier=123&reason=different-package",
        )

        await openAndCapture(user)
        await user.click(screen.getByRole("button", { name: "Review photos" }))

        expect(
            screen.getByRole("heading", { name: "Review your photos" }),
        ).toBeVisible()
        expect(screen.getAllByRole("img")).toHaveLength(2)
        expect(
            screen.getByText(
                "These photos stay on this device. This demo will not send, save, or analyze them.",
            ),
        ).toBeVisible()

        await user.click(
            screen.getByRole("button", { name: "Discard photos and continue" }),
        )

        expect(screen.getByTestId("location")).toHaveTextContent(
            "/captures/demo-capture?scenario=queued",
        )
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:package-photo-1")
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:package-photo-2")
        expect(storageWrite).not.toHaveBeenCalled()
        expect(fetch).not.toHaveBeenCalled()
        expect(document.querySelector('input[type="file"]')).toBeNull()
    })

    test("recovers from denied permission without stranding the shopper", async () => {
        const user = userEvent.setup()
        installCamera({ error: new DOMException("Denied", "NotAllowedError") })
        renderRoute("/capture/new")

        await user.click(screen.getByRole("button", { name: "Open camera" }))

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Camera access is blocked",
        )
        expect(
            screen.getByRole("button", { name: "Try camera again" }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Exit Package Capture" }),
        ).toBeVisible()
    })

    test("recovers when the camera is unavailable or interrupted", async () => {
        const user = userEvent.setup()
        installCamera({
            error: new DOMException("No camera", "NotFoundError"),
        })
        const firstRender = renderRoute("/capture/new")

        await user.click(screen.getByRole("button", { name: "Open camera" }))
        expect(screen.getByRole("alert")).toHaveTextContent(
            "The camera is unavailable",
        )

        firstRender.unmount()
        const camera = installCamera()
        renderRoute("/capture/new")
        await user.click(screen.getByRole("button", { name: "Open camera" }))
        camera.track.dispatchEvent(new Event("ended"))

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "The camera stopped",
        )
    })

    test("stops an active camera when the page becomes hidden", async () => {
        const user = userEvent.setup()
        const camera = installCamera()
        renderRoute("/capture/new")
        await user.click(screen.getByRole("button", { name: "Open camera" }))

        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden",
        })
        document.dispatchEvent(new Event("visibilitychange"))

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "The camera stopped",
        )
        expect(camera.stop).toHaveBeenCalled()
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        })
    })

    test("recovers from a failed frame capture and stops the stream", async () => {
        const user = userEvent.setup()
        const camera = installCamera()
        camera.toBlob.mockImplementation((callback) => callback(null))
        renderRoute("/capture/new")

        await openAndCapture(user)

        expect(screen.getByRole("alert")).toHaveTextContent(
            "The photo could not be taken",
        )
        expect(camera.stop).toHaveBeenCalled()
        expect(
            screen.getByRole("button", { name: "Try camera again" }),
        ).toBeVisible()
    })

    test("revokes a preview and stops the camera when the shopper exits", async () => {
        const user = userEvent.setup()
        const camera = installCamera()
        renderRoute("/capture/new")

        await openAndCapture(user)
        await user.click(
            screen.getByRole("button", { name: "Exit Package Capture" }),
        )

        expect(camera.revokeObjectURL).toHaveBeenCalledWith(
            "blob:package-photo-1",
        )
        expect(camera.stop).toHaveBeenCalled()
        expect(
            screen.getByRole("heading", { name: "Scan with the camera" }),
        ).toBeVisible()
    })

    test("clears previews before a back-forward cache restore", async () => {
        const user = userEvent.setup()
        const camera = installCamera()
        renderRoute("/capture/new")

        await openAndCapture(user)
        await user.click(screen.getByRole("button", { name: "Continue" }))
        window.dispatchEvent(new PageTransitionEvent("pagehide"))
        window.dispatchEvent(
            new PageTransitionEvent("pageshow", { persisted: true }),
        )

        expect(camera.revokeObjectURL).toHaveBeenCalledWith(
            "blob:package-photo-1",
        )
        await waitFor(() => {
            expect(screen.getByTestId("location")).toHaveTextContent(
                "/capture/new?step=front",
            )
        })
        expect(
            screen.queryByAltText("Front package preview"),
        ).not.toBeInTheDocument()
    })

    test("redirects a refreshed later step to the first missing photo", async () => {
        installCamera()
        renderRoute("/capture/new?step=review&identifier=123&reason=no-match")

        await waitFor(() => {
            expect(screen.getByTestId("location")).toHaveTextContent(
                "/capture/new?step=front&identifier=123&reason=no-match",
            )
        })
        expect(
            screen.getByText(
                "Photos are cleared when this page reloads. Start with the front again.",
            ),
        ).toHaveTextContent(
            "Photos are cleared when this page reloads. Start with the front again.",
        )
    })

    test("browser Back returns to the captured front step", async () => {
        const user = userEvent.setup()
        installCamera()
        renderRoute("/capture/new")

        await openAndCapture(user)
        await user.click(screen.getByRole("button", { name: "Continue" }))
        await user.click(screen.getByRole("button", { name: "Browser back" }))

        expect(
            screen.getByRole("heading", { name: "Photograph the front" }),
        ).toHaveFocus()
        expect(screen.getByAltText("Front package preview")).toBeVisible()
        expect(screen.getByTestId("location")).toHaveTextContent("step=front")
    })

    test("shows the complete camera step in Khmer", async () => {
        await i18n.changeLanguage("km")
        installCamera()
        renderRoute("/capture/new")

        expect(
            screen.getByRole("heading", { name: "ថតរូបផ្នែកខាងមុខ" }),
        ).toHaveFocus()
        expect(screen.getByRole("button", { name: "បើកកាមេរ៉ា" })).toBeVisible()
    })
})

describe("simulated Package Capture results", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("advances the normal demo only through shopper actions", async () => {
        const user = userEvent.setup()
        renderRoute("/captures/demo-capture?scenario=queued")

        expect(
            screen.getByRole("heading", { name: "Photos ready for the demo" }),
        ).toHaveFocus()
        expect(
            screen.getByRole("status", { name: "Demo data is active" }),
        ).toBeVisible()

        await user.click(
            screen.getByRole("button", { name: "Start demo processing" }),
        )
        expect(screen.getByTestId("location")).toHaveTextContent(
            "scenario=processing",
        )
        expect(
            screen.getByRole("heading", { name: "Demo processing" }),
        ).toHaveFocus()

        await user.click(
            screen.getByRole("button", { name: "Show demo result" }),
        )
        expect(
            screen.getByRole("heading", { name: "Demo capture complete" }),
        ).toBeVisible()
        expect(
            screen.getByText(
                "No package label was interpreted. This is not Shopper Guidance.",
            ),
        ).toBeVisible()
    })

    test.each([
        ["partial", "Some evidence could not be read"],
        ["failed", "Demo processing could not finish"],
        ["timed-out", "Demo processing took too long"],
        ["expired", "This demo capture has expired"],
    ])("shows direct recovery for the %s scenario", (scenario, heading) => {
        renderRoute(`/captures/demo-capture?scenario=${scenario}`)

        expect(screen.getByRole("heading", { name: heading })).toBeVisible()
        expect(screen.getByText("Evidence uncertainty")).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Start a new Package Capture" }),
        ).toBeVisible()
    })

    test("localizes a simulated result and its demo notice in Khmer", async () => {
        await i18n.changeLanguage("km")
        renderRoute("/captures/demo-capture?scenario=partial")

        expect(
            screen.getByRole("heading", {
                name: "Evidence ខ្លះមិនអាចអានបាន",
            }),
        ).toHaveFocus()
        expect(
            screen.getByRole("status", {
                name: "កំពុងបង្ហាញទិន្នន័យសាកល្បង",
            }),
        ).toBeVisible()
    })
})
