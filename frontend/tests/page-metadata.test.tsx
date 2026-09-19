import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { AppLocale } from "../src/i18n/locale"
import type { ProductLookup } from "../src/features/product/api"
import { productResponse } from "./product-fixtures"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(currentDir, "..")
const indexHtmlPath = path.join(rootDir, "index.html")
const publicDirPath = path.join(rootDir, "public")

function renderRoute(
    routePath: string,
    locale: AppLocale = "en",
    lookup = vi.fn<ProductLookup>(),
) {
    window.localStorage.setItem("lifegoods.locale.v1", locale)
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[routePath]}>
                <App lookup={lookup} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("Page metadata and favicons", () => {
    test("index.html contains complete favicon links and web manifest", () => {
        const html = readFileSync(indexHtmlPath, "utf8")

        expect(html).toContain(
            '<link rel="icon" href="/favicon.ico" sizes="any" />',
        )
        expect(html).toContain(
            '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
        )
        expect(html).toContain(
            '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
        )
        expect(html).toContain(
            '<link rel="manifest" href="/site.webmanifest" />',
        )
    })

    test("public directory contains all referenced icon and manifest assets", () => {
        expect(existsSync(path.join(publicDirPath, "favicon.ico"))).toBe(true)
        expect(existsSync(path.join(publicDirPath, "favicon.svg"))).toBe(true)
        expect(
            existsSync(path.join(publicDirPath, "apple-touch-icon.png")),
        ).toBe(true)
        expect(existsSync(path.join(publicDirPath, "icon-192.png"))).toBe(true)
        expect(existsSync(path.join(publicDirPath, "icon-512.png"))).toBe(true)
        expect(existsSync(path.join(publicDirPath, "site.webmanifest"))).toBe(
            true,
        )

        const manifestRaw = readFileSync(
            path.join(publicDirPath, "site.webmanifest"),
            "utf8",
        )
        type WebManifest = {
            name: string
            short_name: string
            theme_color: string
            background_color: string
            icons: Array<{ src: string }>
        }
        const manifest = JSON.parse(manifestRaw) as unknown as WebManifest
        expect(manifest.name).toBe("Life Goods")
        expect(manifest.short_name).toBe("Life Goods")
        expect(manifest.theme_color).toBe("#F3F5F6")
        expect(manifest.background_color).toBe("#F3F5F6")
        expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
    })

    test("index.html contains correct Open Graph, Twitter, and mobile meta tags", () => {
        const html = readFileSync(indexHtmlPath, "utf8")

        expect(html).toContain("<title>Life Goods</title>")
        expect(html).toContain(
            'content="Scan a Barcode to read attributed Open Food Facts Product information with Life Goods."',
        )
        expect(html).toContain('name="theme-color" content="#F3F5F6"')
        expect(html).toContain('name="application-name" content="Life Goods"')
        expect(html).toContain(
            'name="apple-mobile-web-app-title" content="Life Goods"',
        )

        // Open Graph
        expect(html).toContain('property="og:title" content="Life Goods"')
        expect(html).toContain('property="og:site_name" content="Life Goods"')
        expect(html).toContain('property="og:type" content="website"')
        expect(html).toContain(
            'property="og:image" content="/branding/lifegoods-logo.png"',
        )

        // Twitter Card
        expect(html).toContain(
            'name="twitter:card" content="summary_large_image"',
        )
        expect(html).toContain('name="twitter:title" content="Life Goods"')
        expect(html).toContain(
            'name="twitter:image" content="/branding/lifegoods-logo.png"',
        )
    })

    test("updates document title per route", async () => {
        const { unmount: unmountHome } = renderRoute("/")
        expect(document.title).toBe("Life Goods")
        unmountHome()

        const { unmount: unmountSearch } = renderRoute("/search")
        expect(document.title).toBe("Search | Life Goods")
        unmountSearch()

        const { unmount: unmountLearn } = renderRoute("/learn")
        expect(document.title).toBe("Learn | Life Goods")
        unmountLearn()

        const { unmount: unmountConcerns } = renderRoute("/concerns")
        expect(document.title).toBe("Allergy | Life Goods")
        unmountConcerns()

        const { unmount: unmountLicenses } = renderRoute("/data-and-licenses")
        expect(document.title).toBe("Data and licenses | Life Goods")
        unmountLicenses()

        const { unmount: unmountNotFound } = renderRoute("/nonexistent")
        expect(document.title).toBe("Page not found | Life Goods")
        unmountNotFound()

        const lookup = vi
            .fn<ProductLookup>()
            .mockResolvedValue(productResponse())
        renderRoute("/products/4006381333931", "en", lookup)
        await waitFor(() => {
            expect(document.title).toBe("Dark Chocolate | Life Goods")
        })
    })

    test("localizes Learn page, guide, and article metadata titles", () => {
        const { unmount: unmountLearn } = renderRoute("/learn", "km")
        expect(document.title).toBe("ស្វែងយល់ | Life Goods")
        unmountLearn()

        const { unmount: unmountGuide } = renderRoute(
            "/learn/guides/how-to-read-a-label",
            "km",
        )
        expect(document.title).toBe("របៀបអានស្លាកអាហារ | Life Goods")
        unmountGuide()

        renderRoute("/learn/where-product-data-comes-from", "km")
        expect(document.title).toBe("ព័ត៌មានផលិតផលមកពីណា | Life Goods")
    })
})
