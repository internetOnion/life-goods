import { expect, test } from "@playwright/test"

test("invalid input stays in the browser and valid no-match crosses the API boundary", async ({
    page,
}) => {
    let packageMatchRequests = 0
    page.on("request", (request) => {
        if (request.url().includes("/api/v1/package-matches"))
            packageMatchRequests += 1
    })

    await page.goto("/")
    const input = page.getByRole("textbox", { name: "លេខបាកូដ" })
    await input.fill("1234")
    await page.getByRole("button", { name: "ពិនិត្យបាកូដ" }).click()

    await expect(input).toHaveAttribute("aria-invalid", "true")
    expect(packageMatchRequests).toBe(0)

    await input.fill("4 006381 333931")
    await page.getByRole("button", { name: "ពិនិត្យបាកូដ" }).click()

    await expect(
        page.getByRole("heading", { name: "រកមិនឃើញព័ត៌មានកញ្ចប់" }),
    ).toBeVisible()
    await expect(page.getByText("4006381333931")).toBeVisible()
    expect(packageMatchRequests).toBe(1)
})

test("keyboard order, Khmer layout, announcements, and reduced motion remain usable", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")

    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "ខ្មែរ" })).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "English" })).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("textbox", { name: "លេខបាកូដ" })).toBeFocused()
    await page.keyboard.type("4006381333931")
    await page.keyboard.press("Tab")
    await expect(
        page.getByRole("button", { name: "ពិនិត្យបាកូដ" }),
    ).toBeFocused()
    await page.keyboard.press("Enter")

    await expect(page.getByRole("status")).toContainText(
        "រកមិនឃើញព័ត៌មានកញ្ចប់",
    )
    const outcome = page.locator(".outcome")
    await expect(outcome).toBeVisible()
    expect(
        await outcome.evaluate((element) =>
            parseFloat(getComputedStyle(element).animationDuration),
        ),
    ).toBeLessThanOrEqual(0.001)
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
})

test("keyboard and live regions expose invalid, loading, failure, and retry states", async ({
    page,
}) => {
    let attempts = 0
    await page.route("**/api/v1/package-matches**", async (route) => {
        attempts += 1
        await new Promise((resolve) => setTimeout(resolve, 150))
        if (attempts === 1) {
            await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                    error: {
                        code: "PACKAGE_MATCH_SOURCE_UNAVAILABLE",
                        message:
                            "Package Match lookup is temporarily unavailable.",
                    },
                }),
            })
            return
        }
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                normalized_identifier: "4006381333931",
                scheme: "EAN_13",
                candidates: [],
            }),
        })
    })
    await page.goto("/")

    const input = page.getByRole("textbox", { name: "លេខបាកូដ" })
    await input.fill("1234")
    await input.press("Enter")
    await expect(page.getByRole("alert")).toContainText("ប្រវែងលេខបាកូដ")

    await input.fill("4006381333931")
    await input.press("Enter")
    await expect(page.getByRole("status")).toContainText("កំពុងពិនិត្យ")
    await expect(
        page.getByRole("heading", { name: "មិនអាចពិនិត្យបានឥឡូវនេះ" }),
    ).toBeVisible()
    await expect(page.getByRole("status")).toContainText(
        "មិនអាចពិនិត្យបានឥឡូវនេះ",
    )

    await expect(
        page.getByRole("heading", { name: "មិនអាចពិនិត្យបានឥឡូវនេះ" }),
    ).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(
        page.getByRole("button", { name: "ព្យាយាមម្ដងទៀត" }),
    ).toBeFocused()
    await page.keyboard.press("Enter")

    await expect(page.getByRole("status")).toContainText("កំពុងពិនិត្យ")
    await expect(
        page.getByRole("heading", { name: "រកមិនឃើញព័ត៌មានកញ្ចប់" }),
    ).toBeVisible()
    expect(attempts).toBe(2)
})

test("real Khmer copy wraps without clipping at representative narrow widths", async ({
    page,
}) => {
    for (const viewport of [
        { width: 320, height: 568 },
        { width: 360, height: 640 },
        { width: 393, height: 852 },
    ]) {
        await page.setViewportSize(viewport)
        await page.goto("/")
        const clippedElements = await page
            .locator("h1, p, label, button")
            .evaluateAll(
                (elements) =>
                    elements.filter(
                        (element) =>
                            element.scrollWidth > element.clientWidth + 1 ||
                            element.scrollHeight > element.clientHeight + 1,
                    ).length,
            )
        expect(clippedElements).toBe(0)
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width)
    }
})
