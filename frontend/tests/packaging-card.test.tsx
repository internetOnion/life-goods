import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"

import { PackagingCard } from "../src/features/product/cards/PackagingCard"
import { LocaleProvider } from "../src/i18n/LocaleProvider"

describe("PackagingCard geography", () => {
    afterEach(() => {
        localStorage.clear()
    })

    test("translates recognized countries without changing other places", () => {
        localStorage.setItem("lifegoods.locale.v1", "km")

        render(
            <LocaleProvider>
                <PackagingCard
                    labelEvidence={[
                        {
                            field: "countries_sold",
                            value: [
                                "en:armenia",
                                "Belgium",
                                "en:unknown-place",
                            ],
                            source_field: "countries_tags",
                            source_name: "Open Food Facts",
                            source_url:
                                "https://world.openfoodfacts.org/product/1",
                            language: null,
                            observed_at: null,
                            retrieved_at: "2026-09-08T00:00:00Z",
                        },
                        {
                            field: "manufacturing_places",
                            value: "Rouen, en:france, Rice Land",
                            source_field: "manufacturing_places",
                            source_name: "Open Food Facts",
                            source_url:
                                "https://world.openfoodfacts.org/product/1",
                            language: null,
                            observed_at: null,
                            retrieved_at: "2026-09-08T00:00:00Z",
                        },
                    ]}
                />
            </LocaleProvider>,
        )

        expect(screen.getByText("Rouen, បារាំង, Rice Land")).toBeVisible()
        expect(screen.getByText("អាមេនី")).toBeVisible()
        expect(screen.getByText("បែលហ្ស៊ិក")).toBeVisible()
        expect(screen.getByText("en:unknown-place")).toBeVisible()
    })
})
