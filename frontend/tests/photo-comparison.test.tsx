import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { ComparisonSection } from "../src/features/photo-comparison/ComparisonSection"
import type {
    ComparisonResponse,
    ProductSideState,
} from "../src/features/photo-comparison/types"
import type { ProductLookup } from "../src/features/product/api"

function renderRoute(path: string, lookup = vi.fn<ProductLookup>()) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[path]}>
                <App lookup={lookup} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("Photo comparison lab frontend page", () => {
    test("renders the photo comparison lab under the hidden route /experimental/photo-comparison", () => {
        renderRoute("/experimental/photo-comparison")

        // Heading
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: /Choose two Products/i,
            }),
        ).toBeInTheDocument()

        // Product panels
        expect(
            screen.getByRole("region", { name: "Product photo panels" }),
        ).toBeInTheDocument()
        expect(screen.getByDisplayValue("Product A")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Product B")).toBeInTheDocument()

        // Comparison section
        expect(
            screen.getByRole("heading", { level: 2, name: /Comparison/i }),
        ).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Compare/i })).toBeDisabled()

        // Hidden from primary navigation: primary nav must not contain a link to photo comparison
        const navigation = screen.getByRole("navigation", {
            name: "Primary navigation",
        })
        expect(
            within(navigation).queryByRole("link", {
                name: /Photo/i,
            }),
        ).not.toBeInTheDocument()
    })

    test("redirects alias /photo-comparison to /experimental/photo-comparison", () => {
        renderRoute("/photo-comparison")

        expect(
            screen.getByRole("heading", {
                level: 1,
                name: /Choose two Products/i,
            }),
        ).toBeInTheDocument()
        expect(screen.getByDisplayValue("Product A")).toBeInTheDocument()
    })

    test("allows editing product titles and resetting the session", async () => {
        const user = userEvent.setup()
        renderRoute("/experimental/photo-comparison")

        const productAInput = screen.getByDisplayValue("Product A")
        await user.clear(productAInput)
        await user.type(productAInput, "Mee Chiet Noodle")

        expect(screen.getByDisplayValue("Mee Chiet Noodle")).toBeInTheDocument()

        // Reset session
        const resetButton = screen.getByRole("button", {
            name: /Reset session/i,
        })
        await user.click(resetButton)

        expect(screen.getByDisplayValue("Product A")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Product B")).toBeInTheDocument()
    })
})

describe("ComparisonSection Shopper-ready presentation", () => {
    const mockLeftProduct: ProductSideState = {
        id: "left",
        title: "Mama Instant Noodles",
        number: "1",
        photos: [],
        extraction: {
            schema_version: 1,
            product_id: "left",
            images: [
                {
                    image_id: "img_mama_1",
                    original_image_id: "img_mama_1",
                    role: "label",
                    width: 800,
                    height: 600,
                },
            ],
            package_quantity: {
                field_id: "pkg_qty_1",
                label: "Net weight",
                value_text: "60",
                unit_text: "g",
                state: "readable",
                evidence: [{ image_id: "img_mama_1" }],
            },
            nutrition_columns: [],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        },
        selectedColumnId: "col1",
        loading: false,
        error: "",
        retry: false,
        revision: 1,
    }

    const mockRightProduct: ProductSideState = {
        id: "right",
        title: "Product B",
        number: "2",
        photos: [],
        extraction: {
            schema_version: 1,
            product_id: "right",
            images: [
                {
                    image_id: "img_b_1",
                    original_image_id: "img_b_1",
                    role: "label",
                    width: 800,
                    height: 600,
                },
            ],
            package_quantity: {
                field_id: "pkg_qty_2",
                label: "Net weight",
                value_text: "70",
                unit_text: "g",
                state: "readable",
                evidence: [{ image_id: "img_b_1" }],
            },
            nutrition_columns: [],
            outcome: "complete",
            provider: "google",
            model: "gemini",
            configuration_version: "1.0.0",
        },
        selectedColumnId: "col2",
        loading: false,
        error: "",
        retry: false,
        revision: 1,
    }

    const mockComparison: ComparisonResponse = {
        schema_version: 1,
        calculated_from_submitted_evidence: true,
        left_product_id: "left",
        right_product_id: "right",
        rows: [
            {
                nutrient: "sodium",
                row_kind: "amount",
                state: "comparable",
                left: {
                    column_id: "col1",
                    observation: {
                        field_id: "left_sod",
                        nutrient: "sodium",
                        label: "Sodium",
                        state: "readable",
                        row_kind: "amount",
                        qualifier: "exact",
                        value_text: "1,380",
                        unit_text: "mg",
                        evidence: [{ image_id: "img_mama_1" }],
                    },
                },
                right: {
                    column_id: "col2",
                    observation: {
                        field_id: "right_sod",
                        nutrient: "sodium",
                        label: "Sodium",
                        state: "readable",
                        row_kind: "amount",
                        qualifier: "exact",
                        value_text: "1.5",
                        unit_text: "g",
                        evidence: [{ image_id: "img_b_1" }],
                    },
                },
                normalized_left: {
                    value: 1380,
                    unit: "mg",
                    target_basis: "per_package",
                    inputs: [],
                },
                normalized_right: {
                    value: 1500,
                    unit: "mg",
                    target_basis: "per_package",
                    inputs: [],
                },
            },
            {
                nutrient: "vitamin_b5",
                row_kind: "amount",
                state: "not_comparable",
                reason: "Not found in photos for the other product.",
                right: {
                    column_id: "col2",
                    observation: {
                        field_id: "right_b5",
                        nutrient: "vitamin_b5",
                        label: "Vitamin B5",
                        state: "readable",
                        row_kind: "amount",
                        qualifier: "exact",
                        value_text: "1.2",
                        unit_text: "mg",
                        evidence: [{ image_id: "img_b_1" }],
                    },
                },
                normalized_right: {
                    value: 1.2,
                    unit: "mg",
                    target_basis: "per_package",
                    inputs: [],
                },
            },
            {
                nutrient: "sodium",
                row_kind: "percentage",
                state: "comparable",
                left: {
                    column_id: "col1",
                    observation: {
                        field_id: "left_sod_pct",
                        nutrient: "sodium",
                        label: "Sodium",
                        state: "readable",
                        row_kind: "percentage",
                        qualifier: "exact",
                        value_text: "60",
                        unit_text: "%",
                        evidence: [{ image_id: "img_mama_1" }],
                    },
                },
                right: {
                    column_id: "col2",
                    observation: {
                        field_id: "right_sod_pct",
                        nutrient: "sodium",
                        label: "Sodium",
                        state: "readable",
                        row_kind: "percentage",
                        qualifier: "exact",
                        value_text: "65",
                        unit_text: "%",
                        evidence: [{ image_id: "img_b_1" }],
                    },
                },
                normalized_left: {
                    value: 60,
                    unit: "%",
                    target_basis: "per_package",
                    inputs: [],
                },
                normalized_right: {
                    value: 65,
                    unit: "%",
                    target_basis: "per_package",
                    inputs: [],
                },
            },
        ],
    }

    test("displays normalized amounts, printed labels, label percentages section, and no Source Data Unavailable", () => {
        render(
            <ComparisonSection
                comparison={mockComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={mockLeftProduct}
                rightProduct={mockRightProduct}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // 1. Check normalized amounts are displayed prominently
        expect(screen.getByText("1,380 mg")).toBeInTheDocument()
        expect(screen.getByText("1,500 mg")).toBeInTheDocument()
        // Product B printed value is shown underneath
        expect(screen.getByText("1.5 g")).toBeInTheDocument()
        expect(screen.getByText(/Printed:/i)).toBeInTheDocument()

        // 2. Check nutrient names are clean English, never internal hash IDs
        expect(screen.getAllByText("Sodium")).toHaveLength(2)
        expect(screen.getByText("Vitamin B5")).toBeInTheDocument()
        expect(screen.queryByText(/unmatched:/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/fat:[a-f0-9]/i)).not.toBeInTheDocument()

        // 3. Check single qualification banner
        expect(
            screen.getByText(
                /These are amounts reported per package, not an equal-weight comparison/i,
            ),
        ).toBeInTheDocument()

        // 4. Check dedicated Label percentages section exists and pairs percentages together
        expect(
            screen.getByRole("heading", {
                level: 3,
                name: /Label percentages/i,
            }),
        ).toBeInTheDocument()
        expect(screen.getByText("60 %")).toBeInTheDocument()
        expect(screen.getByText("65 %")).toBeInTheDocument()

        // 5. Check missing data uses "Not found in these photos" and NEVER "Source Data Unavailable"
        expect(
            screen.getByText("Not found in these photos"),
        ).toBeInTheDocument()
        expect(
            screen.queryByText(/Source Data Unavailable/i),
        ).not.toBeInTheDocument()

        // 6. Check photo evidence buttons show readable sequence numbers
        expect(screen.getAllByText(/View photo 1/i).length).toBeGreaterThan(0)
    })
})
