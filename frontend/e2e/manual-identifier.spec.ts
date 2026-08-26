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
    await expect(page.getByText("4006381333931").first()).toBeVisible()
    expect(packageMatchRequests).toBe(1)
})

test("keyboard order, Khmer layout, announcements, and reduced motion remain usable", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")

    await page.keyboard.press("Tab")
    await expect(
        page.getByRole("button", { name: "ប្តូរទៅភាសាអង់គ្លេស" }),
    ).toBeFocused()
    await expect(page.getByRole("banner")).toHaveCount(0)
    await expect(page.locator('[data-language-flag="km"]')).toBeVisible()
    await page.keyboard.press("Tab")
    await expect(
        page.getByRole("button", { name: "បង្ហាញព័ត៌មានអំពីលេខបាកូដ" }),
    ).toBeFocused()
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
    const outcome = page
        .getByRole("heading", { name: "រកមិនឃើញព័ត៌មានកញ្ចប់" })
        .locator("..")
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

test("Open Food Facts evidence is fetched only through the LifeGoods backend", async ({
    page,
}) => {
    const requestedHosts: string[] = []
    page.on("request", (request) => {
        requestedHosts.push(new URL(request.url()).host)
    })
    await page.route("**/api/v1/package-matches**", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                normalized_identifier: "4006381333931",
                scheme: "EAN_13",
                candidates: [
                    {
                        external_record_id: "4006381333931",
                        identity_evidence: [
                            {
                                field: "name",
                                value: "សូកូឡាខ្មៅ",
                                language: "km",
                                observed_at: null,
                                retrieved_at: "2026-08-24T10:00:00Z",
                                source_field: "product_name_km",
                                source_name: "Open Food Facts",
                                source_url:
                                    "https://world.openfoodfacts.org/product/4006381333931",
                            },
                        ],
                        is_current: true,
                        label_evidence: [],
                        package_variant_id: null,
                        product_id: null,
                        reference_images: [],
                        retrieved_at: "2026-08-24T10:00:00Z",
                        source: {
                            attribution: "Open Food Facts contributors",
                            base_url: "https://world.openfoodfacts.org",
                            contents_license: "Database Contents License",
                            database_license: "ODbL",
                            image_license: "CC BY-SA",
                            name: "Open Food Facts",
                            record_url:
                                "https://world.openfoodfacts.org/product/4006381333931",
                            source_type: "COMMUNITY_DATABASE",
                            terms_version: null,
                        },
                        source_kind: "OPEN_FOOD_FACTS",
                        source_revision: "1787462400",
                    },
                ],
            }),
        })
    })

    await page.goto("/")
    await page.getByRole("textbox", { name: "លេខបាកូដ" }).fill("4006381333931")
    await page.getByRole("button", { name: "ពិនិត្យបាកូដ" }).click()

    await expect(
        page.getByRole("heading", { name: "សូកូឡាខ្មៅ" }),
    ).toBeFocused()
    await expect(
        page.getByText(/មិនទាន់ត្រូវបានពិនិត្យដោយគម្រោង LifeGoods/),
    ).toBeVisible()
    expect(requestedHosts.every((host) => host === "127.0.0.1:4173")).toBe(true)
    await expect(page.getByRole("navigation")).not.toBeVisible()

    await page.getByRole("button", { name: "ត្រឡប់ទៅទំព័រដើម" }).click()
    await expect(page.getByRole("textbox", { name: "លេខបាកូដ" })).toHaveValue(
        "4006381333931",
    )
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
            .evaluateAll((elements) =>
                elements
                    .filter(
                        (element) =>
                            element.scrollWidth > element.clientWidth + 1 ||
                            element.scrollHeight > element.clientHeight + 1,
                    )
                    .map((element) => ({
                        tag: element.tagName,
                        className: element.getAttribute("class") ?? "",
                        text: element.textContent,
                        clientWidth: element.clientWidth,
                        scrollWidth: element.scrollWidth,
                        clientHeight: element.clientHeight,
                        scrollHeight: element.scrollHeight,
                    })),
            )
        expect(clippedElements).toEqual([])
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width)
    }
})
