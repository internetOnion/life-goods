import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { TelegramBridge } from "@/app/TelegramBridge"
import { LocaleProvider } from "@/i18n/LocaleProvider"
import { useLocale } from "@/i18n/locale"
import {
    initTelegram,
    interceptExternalLinks,
    isTelegramLaunch,
    TELEGRAM_SDK_URL,
    type TelegramWebApp,
} from "@/lib/telegram"

function fakeWebApp(overrides: Partial<TelegramWebApp> = {}): TelegramWebApp {
    return {
        ready: vi.fn(),
        expand: vi.fn(),
        openLink: vi.fn(),
        disableVerticalSwipes: vi.fn(),
        setHeaderColor: vi.fn(),
        setBackgroundColor: vi.fn(),
        BackButton: {
            show: vi.fn(),
            hide: vi.fn(),
            onClick: vi.fn(),
            offClick: vi.fn(),
        },
        ...overrides,
    }
}

function LocationProbe() {
    return <output aria-label="path">{useLocation().pathname}</output>
}

function LocaleProbe() {
    return <output aria-label="locale">{useLocale().locale}</output>
}

describe("Telegram Mini App", () => {
    beforeEach(() => {
        window.sessionStorage.clear()
        window.localStorage.clear()
        window.history.replaceState(null, "", "/")
        document
            .querySelectorAll(`script[src="${TELEGRAM_SDK_URL}"]`)
            .forEach((script) => script.remove())
    })

    afterEach(() => {
        delete window.Telegram
    })

    test("loads nothing on the ordinary web", async () => {
        await expect(initTelegram()).resolves.toBeUndefined()
        expect(
            document.querySelector(`script[src="${TELEGRAM_SDK_URL}"]`),
        ).toBeNull()
    })

    test("detects a Telegram launch and remembers it for in-app reloads", () => {
        expect(
            isTelegramLaunch({
                hash: "#tgWebAppData=x&tgWebAppPlatform=ios",
                search: "",
            }),
        ).toBe(true)
        expect(isTelegramLaunch({ hash: "", search: "" })).toBe(true)
        window.sessionStorage.clear()
        expect(isTelegramLaunch({ hash: "#section", search: "" })).toBe(false)
    })

    test("signals readiness and removes launch data from the address bar", async () => {
        const webApp = fakeWebApp()
        window.Telegram = { WebApp: webApp }
        window.history.replaceState(
            null,
            "",
            "/#tgWebAppData=user%3D1&tgWebAppPlatform=android",
        )

        await expect(initTelegram()).resolves.toBe(webApp)

        expect(webApp.ready).toHaveBeenCalled()
        expect(webApp.expand).toHaveBeenCalled()
        expect(webApp.disableVerticalSwipes).toHaveBeenCalled()
        expect(window.location.hash).toBe("")
    })

    test("opens other sites through Telegram and keeps in-app links", () => {
        const webApp = fakeWebApp()
        const stop = interceptExternalLinks(webApp)
        // jsdom cannot navigate; stop in-app links after the interceptor has run.
        const block = (event: MouseEvent) => event.preventDefault()
        document.addEventListener("click", block)
        render(
            <>
                <a href="https://world.openfoodfacts.org/">Open Food Facts</a>
                <a href="/learn">Learn</a>
            </>,
        )

        screen.getByText("Open Food Facts").click()
        screen.getByText("Learn").click()
        stop()
        document.removeEventListener("click", block)

        expect(webApp.openLink).toHaveBeenCalledTimes(1)
        expect(webApp.openLink).toHaveBeenCalledWith(
            "https://world.openfoodfacts.org/",
        )
    })

    test("starts in English only when Telegram is set to English", () => {
        window.Telegram = {
            WebApp: fakeWebApp({
                initDataUnsafe: { user: { language_code: "en" } },
            }),
        }
        const { unmount } = render(
            <LocaleProvider>
                <LocaleProbe />
            </LocaleProvider>,
        )
        expect(screen.getByLabelText("locale")).toHaveTextContent("en")
        unmount()

        window.Telegram = {
            WebApp: fakeWebApp({
                initDataUnsafe: { user: { language_code: "ru" } },
            }),
        }
        render(
            <LocaleProvider>
                <LocaleProbe />
            </LocaleProvider>,
        )
        expect(screen.getByLabelText("locale")).toHaveTextContent("km")
    })

    test("a saved language choice wins over Telegram's language", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        window.Telegram = {
            WebApp: fakeWebApp({
                initDataUnsafe: { user: { language_code: "en" } },
            }),
        }
        render(
            <LocaleProvider>
                <LocaleProbe />
            </LocaleProvider>,
        )
        expect(screen.getByLabelText("locale")).toHaveTextContent("km")
    })

    test("shows Telegram's back button away from Scan and opens a start Barcode", async () => {
        const webApp = fakeWebApp({
            initDataUnsafe: { start_param: "5449000000996" },
        })
        window.Telegram = { WebApp: webApp }
        render(
            <MemoryRouter initialEntries={["/"]}>
                <TelegramBridge />
                <Routes>
                    <Route path="*" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        await waitFor(() =>
            expect(screen.getByLabelText("path")).toHaveTextContent(
                "/products/5449000000996",
            ),
        )
        expect(webApp.BackButton.show).toHaveBeenCalled()
        expect(webApp.BackButton.onClick).toHaveBeenCalled()
    })

    test("ignores a start parameter that is not a Barcode", () => {
        const webApp = fakeWebApp({
            initDataUnsafe: { start_param: "../../learn" },
        })
        window.Telegram = { WebApp: webApp }
        render(
            <MemoryRouter initialEntries={["/"]}>
                <TelegramBridge />
                <Routes>
                    <Route path="*" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByLabelText("path")).toHaveTextContent("/")
        expect(webApp.BackButton.hide).toHaveBeenCalled()
    })
})
