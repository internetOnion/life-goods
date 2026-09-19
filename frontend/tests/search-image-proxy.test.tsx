import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, test } from "vitest"

import { ProductListItem } from "../src/features/search/ProductListItem"

describe("ProductListItem image loading", () => {
    test("routes an Open Food Facts thumbnail through the backend proxy", () => {
        render(
            <MemoryRouter>
                <ProductListItem
                    product={{
                        barcode: "123456789",
                        name: "Example Product",
                        thumbnail: {
                            url: "https://images.openfoodfacts.org/images/products/123/front_en.1.400.jpg",
                        },
                    }}
                    to="/products/123456789"
                />
            </MemoryRouter>,
        )

        expect(document.querySelector("img")).toHaveAttribute(
            "src",
            "/api/v1/open-food-facts-images?url=https%3A%2F%2Fimages.openfoodfacts.org%2Fimages%2Fproducts%2F123%2Ffront_en.1.400.jpg",
        )
    })

    test("keeps an unsupported fallback image URL direct", () => {
        render(
            <MemoryRouter>
                <ProductListItem
                    product={{
                        barcode: "123456789",
                        name: "Example Product",
                        thumbnail: {
                            url: "https://images.openfoodfacts.org/front.jpg",
                        },
                    }}
                    to="/products/123456789"
                />
            </MemoryRouter>,
        )

        expect(document.querySelector("img")).toHaveAttribute(
            "src",
            "https://images.openfoodfacts.org/front.jpg",
        )
    })

    test("keeps a credential-bearing image URL direct", () => {
        render(
            <MemoryRouter>
                <ProductListItem
                    product={{
                        barcode: "123456789",
                        name: "Example Product",
                        thumbnail: {
                            url: "https://user:secret@images.openfoodfacts.org/images/products/123/front_en.1.400.jpg",
                        },
                    }}
                    to="/products/123456789"
                />
            </MemoryRouter>,
        )

        expect(document.querySelector("img")).toHaveAttribute(
            "src",
            "https://user:secret@images.openfoodfacts.org/images/products/123/front_en.1.400.jpg",
        )
    })
})
