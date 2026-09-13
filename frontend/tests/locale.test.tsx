import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

describe("application locale", () => {
    beforeEach(() => {
        window.localStorage.clear()
        document.documentElement.lang = ""
        vi.restoreAllMocks()
    })

    test("defaults to English and ignores unavailable stored Khmer", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "kh")

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
})
