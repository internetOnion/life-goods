import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, test } from "vitest"

import { LocaleProvider } from "../src/i18n/LocaleProvider"
import { RecentProductViewsPage } from "../src/features/search/RecentProductViewsPage"

const viewedProduct = {
    identifier: "3017620422003",
    timestamp: 1,
}

function renderPage(locale: "en" | "km" = "en") {
    window.localStorage.setItem("lifegoods.locale.v1", locale)
    return render(
        <LocaleProvider>
            <MemoryRouter initialEntries={["/search/recent"]}>
                <RecentProductViewsPage />
            </MemoryRouter>
        </LocaleProvider>,
    )
}

describe("recent Product views page", () => {
    beforeEach(() => {
        localStorage.clear()
        sessionStorage.clear()
    })

    test("renders the empty viewed-Products state in Khmer", () => {
        renderPage("km")

        expect(
            screen.getByRole("heading", { name: "ផលិតផលដែលបានមើល" }),
        ).toBeVisible()
        expect(
            screen.getByRole("heading", {
                name: "ផលិតផលដែលអ្នកបានមើល",
            }),
        ).toBeVisible()
        expect(
            screen.getByText("អ្នកមិនទាន់បានមើលផលិតផលណាមួយទេ។"),
        ).toBeVisible()
        expect(
            screen.getByText("ស្វែងរកផលិតផល ដើម្បីចាប់ផ្តើមប្រវត្តិរបស់អ្នក។"),
        ).toBeVisible()
        expect(
            screen.getByRole("link", { name: "ស្វែងរកផលិតផល" }),
        ).toHaveAttribute("href", "/search")
        expect(
            screen.getByRole("link", { name: "ត្រឡប់ទៅការស្វែងរក" }),
        ).toHaveAttribute("href", "/search")
        expect(document.title).toBe("ផលិតផលដែលបានមើល | Life Goods")
    })

    test("localizes viewed-Product controls and missing source data in Khmer", async () => {
        const user = userEvent.setup()
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([viewedProduct]),
        )
        renderPage("km")

        expect(screen.getByRole("button", { name: "លុបទាំងអស់" })).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "មិនមានទិន្នន័យ" }),
        ).toBeVisible()
        expect(
            screen.getByRole("link", {
                name: "មើលផលិតផល 3017620422003",
            }),
        ).toBeVisible()
        await user.click(screen.getByRole("button", { name: "លុបទាំងអស់" }))

        expect(
            await screen.findByText(/អ្នកមិនទាន់បានមើលផលិតផលណាមួយទេ/),
        ).toBeVisible()
        expect(sessionStorage.getItem("lifegoods_scan_history_v1")).toBeNull()
    })
})
