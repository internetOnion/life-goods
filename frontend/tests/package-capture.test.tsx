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
    const openButton = screen.queryByRole("button", { name: "Open camera" })
    if (openButton) {
        await user.click(openButton)
    }
    const video = screen.getByLabelText("Live camera preview")
    await waitFor(() => expect(video).toBeVisible())
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
            screen.queryByText(
                "Fit the product name and the full front of the package inside the frame.",
            ),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Scan barcode Soon" }),
        ).toBeDisabled()
        expect(getUserMedia).not.toHaveBeenCalled()

        await user.click(screen.getByRole("button", { name: "Open camera" }))

        expect(getUserMedia).toHaveBeenCalledOnce()
        expect(screen.queryByText("Camera active")).not.toBeInTheDocument()
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

        expect(screen.queryByText("Camera active")).not.toBeInTheDocument()
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

    test("requires front and back while allowing ingredients to be skipped", async () => {
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
            screen.getByRole("heading", { name: "Photograph the back" }),
        ).toHaveFocus()
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/capture/new?step=back&identifier=123&reason=different-package",
        )

        await openAndCapture(user)
        await user.click(screen.getByRole("button", { name: "Continue" }))
        expect(
            screen.getByRole("heading", { name: "Photograph the ingredients" }),
        ).toHaveFocus()
        await user.click(
            screen.getByRole("button", { name: "Skip ingredients" }),
        )

        expect(
            screen.getByRole("heading", { name: "Review your photos" }),
        ).toBeVisible()
        expect(
            screen.queryByText(
                "Check that the front and back are clear. Ingredients are optional before entering the demo journey.",
            ),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Back to Package Capture" }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("tab", { name: "Front package" }),
        ).toHaveAttribute("aria-selected", "true")
        expect(screen.getByAltText("Front package preview")).toBeVisible()
        expect(screen.getByRole("tab", { name: "Back package" })).toBeVisible()
        expect(
            screen.getByRole("tab", { name: "Ingredient panel" }),
        ).toBeVisible()
        expect(screen.getByText("Not provided")).toBeVisible()
        expect(
            screen.getByText(
                "These photos stay on this device. This demo will not send, save, or analyze them.",
            ),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Previous photo" }),
        ).toBeDisabled()
        expect(screen.getByRole("button", { name: "Next photo" })).toBeEnabled()

        await user.click(screen.getByRole("button", { name: "Next photo" }))
        expect(
            screen.getByRole("tab", { name: "Back package" }),
        ).toHaveAttribute("aria-selected", "true")
        expect(screen.getByAltText("Back package preview")).toBeVisible()

        await user.click(screen.getByRole("button", { name: "Next photo" }))
        expect(
            screen.getByRole("tab", { name: "Ingredient panel" }),
        ).toHaveAttribute("aria-selected", "true")
        expect(
            screen.getByRole("button", { name: "Next photo" }),
        ).toBeDisabled()

        await user.click(
            screen.getByRole("button", { name: "Discard photos and continue" }),
        )

        expect(screen.getByTestId("location")).toHaveTextContent(
            "/captures/demo-capture?scenario=queued&identifier=123&reason=different-package",
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

    test("capture steps do not show a back-to-capture control", async () => {
        const user = userEvent.setup()
        installCamera()
        renderRoute("/capture/new")

        await openAndCapture(user)
        await user.click(screen.getByRole("button", { name: "Continue" }))

        expect(
            screen.queryByRole("heading", { name: "Photograph the front" }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Photograph the back" }),
        ).toBeVisible()
        expect(
            screen.queryByRole("button", { name: "Back to Package Capture" }),
        ).not.toBeInTheDocument()
    })

    test("discards a targeted close-up before returning to simulated results", async () => {
        const user = userEvent.setup()
        const camera = installCamera()
        const storageWrite = vi.spyOn(Storage.prototype, "setItem")
        const fetch = vi.fn()
        vi.stubGlobal("fetch", fetch)
        renderRoute("/capture/new?step=close-up&identifier=123&reason=no-match")

        await openAndCapture(user)

        expect(screen.getByAltText("Ingredient close-up preview")).toBeVisible()
        expect(
            screen.getByText(
                "This close-up stays on this device. It is discarded before the next simulated result and is not sent, saved, or analyzed.",
            ),
        ).toBeVisible()
        await user.click(
            screen.getByRole("button", {
                name: "Discard photo and show demo result",
            }),
        )

        expect(screen.getByTestId("location").textContent).toBe(
            "/captures/demo-capture?scenario=completed&identifier=123&reason=no-match",
        )
        expect(camera.revokeObjectURL).toHaveBeenCalledWith(
            "blob:package-photo-1",
        )
        expect(storageWrite).not.toHaveBeenCalled()
        expect(fetch).not.toHaveBeenCalled()
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
        const waitingMain = screen
            .getByRole("heading", { name: "Photos ready for the demo" })
            .closest("main")
        const exitButton = screen.getByRole("button", {
            name: "Exit to Home",
        })
        const languageButton = screen.getByRole("button", {
            name: "Switch to Khmer",
        })
        const waitingHeader = waitingMain?.firstElementChild
        expect(waitingHeader?.firstElementChild).toBe(exitButton)
        expect(waitingHeader?.children[1]).toBe(languageButton)
        expect(exitButton).toHaveClass(
            "bg-background",
            "text-foreground",
            "hover:bg-muted",
        )

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

    test("shows a structure-only result grouped into information, ingredients, and nutrition tabs", async () => {
        const user = userEvent.setup()
        renderRoute("/captures/demo-capture?scenario=completed")

        expect(screen.getByText(/Demo structure only/)).toBeVisible()
        const informationTab = screen.getByRole("tab", {
            name: "Information",
        })
        expect(informationTab).toHaveAttribute("aria-selected", "true")
        expect(informationTab).toHaveClass(
            "data-[state=active]:bg-brand-soft",
            "data-[state=active]:font-bold",
            "data-[state=active]:border-brand-dark",
        )
        expect(screen.getByText("Product name")).toBeVisible()
        expect(screen.getByText("Brand")).toBeVisible()
        expect(screen.getAllByText("Unavailable in this demo").length).toBe(4)

        await user.click(screen.getByRole("tab", { name: "Ingredients" }))
        expect(screen.getByText("Declared allergens")).toBeVisible()
        expect(screen.getByText("Additives")).toBeVisible()
        const ingredientsTab = screen.getByRole("tab", {
            name: "Ingredients",
        })
        expect(ingredientsTab).toHaveAttribute("aria-selected", "true")
        expect(ingredientsTab).toHaveClass(
            "data-[state=active]:bg-brand-soft",
            "data-[state=active]:font-bold",
            "data-[state=active]:border-brand-dark",
        )

        await user.click(screen.getByRole("tab", { name: "Nutrition" }))
        expect(screen.getByText("Calories")).toBeVisible()
        expect(screen.getByText("Sodium")).toBeVisible()
    })

    test("switches language on the result without leaving the active tab", async () => {
        const user = userEvent.setup()
        renderRoute("/captures/demo-capture?scenario=completed")

        await user.click(screen.getByRole("tab", { name: "Nutrition" }))
        await user.click(
            screen.getByRole("button", { name: "Switch to Khmer" }),
        )

        expect(
            screen.getByRole("tab", { name: "អាហារូបត្ថម្ភ" }),
        ).toHaveAttribute("aria-selected", "true")
        expect(
            screen.getByRole("heading", { name: "ការថតសាកល្បងបានបញ្ចប់" }),
        ).toBeVisible()
    })

    test("supports keyboard navigation across result tabs", async () => {
        const user = userEvent.setup()
        renderRoute("/captures/demo-capture?scenario=completed")

        const informationTab = screen.getByRole("tab", { name: "Information" })
        informationTab.focus()
        await user.keyboard("{ArrowRight}")
        expect(screen.getByRole("tab", { name: "Ingredients" })).toHaveFocus()
        expect(
            screen.getByRole("tab", { name: "Ingredients" }),
        ).toHaveAttribute("aria-selected", "true")

        await user.keyboard("{End}")
        expect(screen.getByRole("tab", { name: "Nutrition" })).toHaveFocus()
    })

    test("preserves safe entry context through demo transitions and recovery", async () => {
        const user = userEvent.setup()
        renderRoute(
            "/captures/demo-capture?scenario=queued&identifier=123&reason=no-match&unsafe=photo",
        )

        await waitFor(() => {
            expect(screen.getByTestId("location").textContent).toBe(
                "/captures/demo-capture?scenario=queued&identifier=123&reason=no-match",
            )
        })

        await user.click(
            screen.getByRole("button", { name: "Start demo processing" }),
        )
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/captures/demo-capture?scenario=processing&identifier=123&reason=no-match",
        )

        await user.click(
            screen.getByRole("button", { name: "Show demo result" }),
        )
        await user.click(
            screen.getByRole("button", { name: "Capture next product" }),
        )

        expect(screen.getByTestId("location")).toHaveTextContent(
            "/capture/new?step=front",
        )
    })

    test.each([
        ["failed", "Demo processing could not finish"],
        ["timed-out", "Demo processing took too long"],
        ["expired", "This demo capture has expired"],
    ])("shows direct recovery for the %s scenario", (scenario, heading) => {
        renderRoute(`/captures/demo-capture?scenario=${scenario}`)

        expect(screen.getByRole("heading", { name: heading })).toBeVisible()
        expect(screen.getByText("Evidence uncertainty")).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Try Package Capture again" }),
        ).toBeVisible()
    })

    test("requests a targeted ingredient close-up for a partial result", async () => {
        const user = userEvent.setup()
        renderRoute(
            "/captures/demo-capture?scenario=partial&identifier=123&reason=no-match",
        )

        expect(screen.getByText("Evidence uncertainty")).toBeVisible()
        await user.click(
            screen.getByRole("button", {
                name: "Take a closer ingredient photo",
            }),
        )

        expect(screen.getByTestId("location").textContent).toBe(
            "/capture/new?step=close-up&identifier=123&reason=no-match",
        )
        expect(
            screen.getByRole("heading", {
                name: "Photograph the unreadable ingredients",
            }),
        ).toHaveFocus()
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
