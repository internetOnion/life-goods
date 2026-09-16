import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { LanguageSelector } from "@/components/layout/LanguageSelector"
import { Header } from "@/components/layout/Header"
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

    test("defaults to Khmer and ignores an unavailable stored locale", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "fr")

        renderLocaleUi()

        expect(screen.getByText("km:km,en")).toBeVisible()
        expect(document.documentElement).toHaveAttribute("lang", "km")
    })

    test("preserves a stored English preference", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "en")

        renderLocaleUi()

        expect(screen.getByText("en:km,en")).toBeVisible()
        expect(document.documentElement).toHaveAttribute("lang", "en")
    })

    test("persists a selected Khmer preference", async () => {
        const user = userEvent.setup()
        window.localStorage.setItem("lifegoods.locale.v1", "en")
        renderLocaleUi()

        await user.click(
            screen.getByRole("button", { name: "Language: English" }),
        )
        await user.click(
            screen.getByRole("menuitemradio", { name: "Khmer (ខ្មែរ)" }),
        )

        expect(screen.getByText("km:km,en")).toBeVisible()
        expect(window.localStorage.getItem("lifegoods.locale.v1")).toBe("km")
        expect(document.documentElement).toHaveAttribute("lang", "km")
    })

    test("presents English as available when Khmer is selected", async () => {
        const user = userEvent.setup()
        window.localStorage.setItem("lifegoods.locale.v1", "en")
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
                name: "Khmer (ខ្មែរ)",
            }),
        ).not.toBeDisabled()
    })

    test("falls back to Khmer when local storage cannot be read", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("storage unavailable")
        })

        renderLocaleUi()

        expect(screen.getByText("km:km,en")).toBeVisible()
    })

    test("supports keyboard menu navigation and restores trigger focus", async () => {
        const user = userEvent.setup()
        render(
            <LocaleProvider enabledLocales={["en", "km"]}>
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

    test("supports keyboard navigation and focus restoration from Khmer", async () => {
        const user = userEvent.setup()
        window.localStorage.setItem("lifegoods.locale.v1", "km")
        render(
            <LocaleProvider enabledLocales={["en", "km"]}>
                <LanguageSelector />
            </LocaleProvider>,
        )

        const trigger = screen.getByRole("button", { name: "ភាសា៖ ខ្មែរ" })
        trigger.focus()
        await user.keyboard("{Enter}")
        await waitFor(() =>
            expect(
                screen.getByRole("menuitemradio", { name: "ខ្មែរ" }),
            ).toHaveFocus(),
        )
        await user.keyboard("{ArrowUp}")
        expect(
            screen.getByRole("menuitemradio", { name: "អង់គ្លេស" }),
        ).toHaveFocus()
        await user.keyboard("{Escape}")
        expect(trigger).toHaveFocus()
    })

    test("supports the optional glass trigger without changing solid mode", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "en")
        const { rerender } = render(
            <LocaleProvider>
                <LanguageSelector />
            </LocaleProvider>,
        )

        expect(
            screen.getByRole("button", { name: "Language: English" }),
        ).not.toHaveAttribute("data-glass")

        rerender(
            <LocaleProvider>
                <LanguageSelector appearance="glass" />
            </LocaleProvider>,
        )

        expect(
            screen.getByRole("button", { name: "Language: English" }),
        ).toHaveAttribute("data-glass", "neutral")
    })

    test("localizes the Header back-button fallback in Khmer", () => {
        render(
            <LocaleProvider>
                <Header showBackButton />
            </LocaleProvider>,
        )

        expect(
            screen.getByRole("button", { name: "ត្រឡប់ទៅម៉ាស៊ីនស្កេន" }),
        ).toBeVisible()
    })
})
