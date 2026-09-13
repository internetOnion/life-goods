import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { LanguageSelector } from "@/components/layout/LanguageSelector"
import { LocaleProvider } from "@/i18n/LocaleProvider"
import { useLocale } from "@/i18n/locale"

function LocaleProbe() {
    const { locale, enabledLocales } = useLocale()
    return (
        <output>
            {locale}:{enabledLocales.join(",")}
        </output>
    )
}

function renderLocaleUi() {
    return render(
        <LocaleProvider>
            <LanguageSelector />
            <LocaleProbe />
        </LocaleProvider>,
    )
}

function ScopedCompareLocale() {
    const [showCompare, setShowCompare] = useState(true)
    return (
        <LocaleProvider>
            <button type="button" onClick={() => setShowCompare(false)}>
                Leave compare
            </button>
            {showCompare ? (
                <LocaleProvider
                    enabledLocales={["en", "km"]}
                    storageKey="lifegoods.compare.locale.v1"
                >
                    <LanguageSelector />
                    <LocaleProbe />
                </LocaleProvider>
            ) : (
                <LocaleProbe />
            )}
        </LocaleProvider>
    )
}

describe("application locale", () => {
    beforeEach(() => {
        window.localStorage.clear()
        document.documentElement.lang = ""
        vi.restoreAllMocks()
    })

    test("defaults to English and ignores unavailable stored Khmer", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "km")

        renderLocaleUi()

        expect(screen.getByText("en:en")).toBeVisible()
        expect(document.documentElement).toHaveAttribute("lang", "en")
    })

    test("presents English as selected and Khmer as coming soon", async () => {
        const user = userEvent.setup()
        renderLocaleUi()

        const trigger = screen.getByRole("button", {
            name: "Language: English",
        })
        expect(trigger).toHaveClass("h-11", "min-w-11")

        await user.click(trigger)

        expect(
            screen.getByRole("menuitemradio", { name: "English" }),
        ).toHaveAttribute("aria-checked", "true")
        expect(
            screen.getByRole("menuitemradio", {
                name: "Khmer (ខ្មែរ) Coming soon",
            }),
        ).toBeDisabled()
    })

    test("falls back to English when local storage cannot be read", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("storage unavailable")
        })

        renderLocaleUi()

        expect(screen.getByText("en:en")).toBeVisible()
    })

    test("enables and persists Khmer only inside the Compare locale scope", async () => {
        const user = userEvent.setup()
        render(<ScopedCompareLocale />)

        const trigger = screen.getByRole("button", {
            name: "Language: English",
        })
        await user.click(trigger)
        await user.click(
            screen.getByRole("menuitemradio", { name: "Khmer (ខ្មែរ)" }),
        )

        expect(screen.getByText("km:en,km")).toBeVisible()
        expect(window.localStorage.getItem("lifegoods.compare.locale.v1")).toBe(
            "km",
        )
        expect(window.localStorage.getItem("lifegoods.locale.v1")).toBeNull()
        expect(document.documentElement).toHaveAttribute("lang", "km")

        await user.click(screen.getByRole("button", { name: "Leave compare" }))
        await waitFor(() =>
            expect(document.documentElement).toHaveAttribute("lang", "en"),
        )
        expect(screen.getByText("en:en")).toBeVisible()
    })

    test("supports keyboard menu navigation and restores trigger focus", async () => {
        const user = userEvent.setup()
        render(
            <LocaleProvider
                enabledLocales={["en", "km"]}
                storageKey="lifegoods.compare.locale.v1"
            >
                <LanguageSelector />
            </LocaleProvider>,
        )

        const trigger = screen.getByRole("button", {
            name: "Language: English",
        })
        trigger.focus()
        await user.keyboard("{Enter}")
        await waitFor(() =>
            expect(
                screen.getByRole("menuitemradio", { name: "English" }),
            ).toHaveFocus(),
        )
        await user.keyboard("{ArrowDown}")
        expect(
            screen.getByRole("menuitemradio", { name: "Khmer (ខ្មែរ)" }),
        ).toHaveFocus()
        await user.keyboard("{Escape}")
        expect(trigger).toHaveFocus()
    })
})
