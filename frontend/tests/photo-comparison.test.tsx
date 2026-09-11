import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import { ComparisonSection } from "../src/features/photo-comparison/ComparisonSection"
import { PhotoComparisonPage } from "../src/features/photo-comparison/PhotoComparisonPage"
import { PhotoInspectionModal } from "../src/features/photo-comparison/PhotoInspectionModal"
import { ProductPhotoPanel } from "../src/features/photo-comparison/ProductPhotoPanel"
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

describe("Compare Products frontend page (/compare)", () => {
    test("renders Compare Products at /compare with AI disclosure and editable product titles", () => {
        renderRoute("/compare")

        // Heading & Badge
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Compare Products",
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByText("Compare Products", { selector: "div" }),
        ).toBeInTheDocument()

        // Product panels
        expect(
            screen.getByRole("region", { name: "Product photo panels" }),
        ).toBeInTheDocument()
        expect(screen.getByDisplayValue("Product A")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Product B")).toBeInTheDocument()

        // AI provider disclosure statement before submission
        expect(
            screen.getByText(
                /Photos are sent to the configured AI provider for processing\./i,
            ),
        ).toBeInTheDocument()

        // Comparison section & Compare button
        expect(
            screen.getByRole("heading", { level: 2, name: /Comparison/i }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Compare Products" }),
        ).toBeDisabled()
    })

    test("redirects previous photo-comparison URLs to /compare", () => {
        const { unmount } = renderRoute("/experimental/photo-comparison")
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Compare Products",
            }),
        ).toBeInTheDocument()
        unmount()

        renderRoute("/photo-comparison")
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Compare Products",
            }),
        ).toBeInTheDocument()
    })

    test("renders a visible entry point alongside scanning that navigates to /compare", async () => {
        const user = userEvent.setup()
        renderRoute("/")

        const compareLink = screen.getByRole("link", {
            name: /Compare Products/i,
        })
        expect(compareLink).toBeInTheDocument()
        expect(compareLink).toHaveAttribute("href", "/compare")
        expect(
            screen.getByText(/Compare nutrition labels using photos/i),
        ).toBeInTheDocument()

        await user.click(compareLink)

        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Compare Products",
            }),
        ).toBeInTheDocument()
    })

    test("allows editing product titles and resetting the session", async () => {
        const user = userEvent.setup()
        renderRoute("/compare")

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

    test("one Compare action orchestrates extraction of changed Products and deterministic comparison without separate operations", async () => {
        const user = userEvent.setup()
        const extractPhotosMock = vi.fn().mockImplementation((id: string) =>
            Promise.resolve(
                id === "left"
                    ? {
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
                          package_quantity: null,
                          nutrition_columns: [
                              {
                                  column_id: "col1",
                                  name: "Per 100g",
                                  state: "readable",
                                  basis: "per_100g",
                                  fields: [],
                              },
                          ],
                          outcome: "complete",
                          provider: "google",
                          model: "gemini",
                          configuration_version: "1.0.0",
                      }
                    : {
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
                          package_quantity: null,
                          nutrition_columns: [
                              {
                                  column_id: "col2",
                                  name: "Per 100g",
                                  state: "readable",
                                  basis: "per_100g",
                                  fields: [],
                              },
                          ],
                          outcome: "complete",
                          provider: "google",
                          model: "gemini",
                          configuration_version: "1.0.0",
                      },
            ),
        )

        const compareMock = vi.fn().mockResolvedValue({
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
                        value: "1380",
                        unit: "mg",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "1500",
                        unit: "mg",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Shopper is not asked to run extraction and calculation as separate operations
        expect(
            screen.queryByRole("button", { name: /Read nutrition photos/i }),
        ).not.toBeInTheDocument()

        const compareButton = screen.getByRole("button", {
            name: "Compare Products",
        })
        expect(compareButton).toBeDisabled()

        // Upload photo for Product A
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const fileLeft = new File(["left image"], "left.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(inputLeft, { target: { files: [fileLeft] } })

        // Compare button still disabled until both sides have photos
        expect(compareButton).toBeDisabled()

        // Upload photo for Product B
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        const fileRight = new File(["right image"], "right.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(inputRight, { target: { files: [fileRight] } })

        // Compare button is enabled now
        expect(compareButton).toBeEnabled()

        // Clicking Compare once orchestrates extractions and comparison
        await user.click(compareButton)

        expect(extractPhotosMock).toHaveBeenCalledTimes(2)
        expect(extractPhotosMock).toHaveBeenCalledWith("left", [fileLeft])
        expect(extractPhotosMock).toHaveBeenCalledWith("right", [fileRight])
        expect(compareMock).toHaveBeenCalledTimes(1)

        // Factual results rendered
        expect(screen.getByText("Sodium")).toBeInTheDocument()
        expect(screen.getByText("1,380 mg")).toBeInTheDocument()
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
                    value: "1380",
                    unit: "mg",
                    target_basis: "per_package",
                    inputs: [],
                },
                normalized_right: {
                    value: "1500",
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
                    value: "1.2",
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
                    value: "60",
                    unit: "%",
                    target_basis: "per_package",
                    inputs: [],
                },
                normalized_right: {
                    value: "65",
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
                /Amounts reported per package, not an equal-weight comparison/i,
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

    test("displays equal-weight comparison notice when target basis is per_100g and provides directional differences", () => {
        const per100gComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "sugar",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "col1",
                        observation: {
                            field_id: "f1",
                            nutrient: "sugar",
                            label: "Sugars",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "5",
                            unit_text: "g",
                            evidence: [{ image_id: "img1" }],
                        },
                    },
                    right: {
                        column_id: "col2",
                        observation: {
                            field_id: "f2",
                            nutrient: "sugar",
                            label: "Sugars",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "2",
                            unit_text: "g",
                            evidence: [{ image_id: "img2" }],
                        },
                    },
                    normalized_left: {
                        value: "5",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "2",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "3",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        render(
            <ComparisonSection
                comparison={per100gComparison}
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

        expect(
            screen.getByText("Equal-weight comparison (per 100 g)"),
        ).toBeInTheDocument()
        expect(screen.getByText("Per 100 g (normalized)")).toBeInTheDocument()
        expect(screen.getByText("+3 g")).toBeInTheDocument()
        expect(
            screen.getByText(`${mockLeftProduct.title} has more`),
        ).toBeInTheDocument()
    })

    test("displays conditional state reason and assumptions", () => {
        const conditionalComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "energy",
                    row_kind: "amount",
                    state: "conditional",
                    reason: "Different preparation states: left is prepared, right is unprepared.",
                    assumptions: [
                        "Assuming dry weight yields similar calorie density.",
                    ],
                    left: {
                        column_id: "col1",
                        observation: {
                            field_id: "f1",
                            nutrient: "energy",
                            label: "Energy",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "300",
                            unit_text: "kcal",
                            evidence: [{ image_id: "img1" }],
                        },
                    },
                    right: {
                        column_id: "col2",
                        observation: {
                            field_id: "f2",
                            nutrient: "energy",
                            label: "Energy",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "350",
                            unit_text: "kcal",
                            evidence: [{ image_id: "img2" }],
                        },
                    },
                    normalized_left: {
                        value: "300",
                        unit: "kcal",
                        target_basis: "per_package",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "350",
                        unit: "kcal",
                        target_basis: "per_package",
                        inputs: [],
                    },
                },
            ],
        }

        render(
            <ComparisonSection
                comparison={conditionalComparison}
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

        expect(screen.getByText("Conditional")).toBeInTheDocument()
        expect(
            screen.getByText(
                "Different preparation states: left is prepared, right is unprepared.",
            ),
        ).toBeInTheDocument()
        expect(
            screen.getAllByText(
                "Assuming dry weight yields similar calorie density.",
            ).length,
        ).toBeGreaterThan(0)
    })
})

describe("Photo inspection and UX features", () => {
    test("PhotoInspectionModal allows zoom toggle, next/prev navigation, and keyboard esc to close", async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const photos = [
            {
                file: new File(["1"], "photo1.jpg", { type: "image/jpeg" }),
                url: "blob:http://localhost/1",
                localId: "photo-1",
            },
            {
                file: new File(["2"], "photo2.jpg", { type: "image/jpeg" }),
                url: "blob:http://localhost/2",
                localId: "photo-2",
            },
        ]

        const { rerender } = render(
            <PhotoInspectionModal
                isOpen={true}
                onClose={onClose}
                photos={photos}
                initialIndex={0}
                title="Mama Instant Noodles"
            />,
        )

        expect(screen.getByText("Mama Instant Noodles")).toBeInTheDocument()
        expect(screen.getByText("Photo 1 of 2")).toBeInTheDocument()

        // Zoom toggle
        const zoomButton = screen.getByRole("button", { name: /Zoom in/i })
        await user.click(zoomButton)
        expect(
            screen.getByRole("button", { name: /Fit to screen/i }),
        ).toBeInTheDocument()

        // Navigate next
        const nextButton = screen.getByRole("button", { name: /Next photo/i })
        await user.click(nextButton)
        expect(screen.getByText("Photo 2 of 2")).toBeInTheDocument()

        // Escape closes
        await user.keyboard("{Escape}")
        expect(onClose).toHaveBeenCalledTimes(1)

        // Modal closed renders nothing
        rerender(
            <PhotoInspectionModal
                isOpen={false}
                onClose={onClose}
                photos={photos}
                initialIndex={0}
                title="Mama Instant Noodles"
            />,
        )
        expect(
            screen.queryByText("Mama Instant Noodles"),
        ).not.toBeInTheDocument()
    })

    test("ProductPhotoPanel shows detected product identity and allows applying it as title", async () => {
        const user = userEvent.setup()
        const onTitleChange = vi.fn()

        const productWithIdentity: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "left",
                identity: {
                    brand: {
                        field_id: "brand1",
                        label: "Brand",
                        value_text: "Mee Chiet",
                        state: "readable",
                        evidence: [],
                    },
                    name: {
                        field_id: "name1",
                        label: "Name",
                        value_text: "Beef Flavor Noodles",
                        state: "readable",
                        evidence: [],
                    },
                },
                images: [],
                package_quantity: null,
                nutrition_columns: [],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: null,
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ProductPhotoPanel
                product={productWithIdentity}
                highlightedPhotoId={null}
                previewRefs={{ current: {} }}
                onTitleChange={onTitleChange}
                onAddFiles={vi.fn()}
                onRemovePhoto={vi.fn()}
                onReplacePhoto={vi.fn()}
                onClearPhotos={vi.fn()}
                onExtract={vi.fn()}
                onSelectColumn={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        expect(screen.getByText("Detected product")).toBeInTheDocument()
        expect(
            screen.getByText("Mee Chiet Beef Flavor Noodles"),
        ).toBeInTheDocument()

        const useAsTitleBtn = screen.getByRole("button", {
            name: /Use as title/i,
        })
        await user.click(useAsTitleBtn)
        expect(onTitleChange).toHaveBeenCalledWith(
            "Mee Chiet Beef Flavor Noodles",
        )
    })

    test("validates file upload format and size limits with helpful feedback in PhotoComparisonPage", () => {
        renderRoute("/compare")

        // Input 1 is for upload-photos-left
        const fileInput = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        expect(fileInput).toBeInTheDocument()

        // 1. Upload unsupported format (PDF)
        const pdfFile = new File(["dummy pdf content"], "doc.pdf", {
            type: "application/pdf",
        })
        fireEvent.change(fileInput, { target: { files: [pdfFile] } })

        expect(
            screen.getByText(
                /Unsupported file format: only JPEG and PNG photos are supported/i,
            ),
        ).toBeInTheDocument()

        // 2. Upload oversized file (> 10 MiB)
        const hugeBlob = new Array(11 * 1024 * 1024).fill("a").join("")
        const largeFile = new File([hugeBlob], "huge.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(fileInput, { target: { files: [largeFile] } })

        expect(
            screen.getByText(/File size exceeds 10 MiB limit/i),
        ).toBeInTheDocument()

        // 3. Camera capture works via camera input with capture attribute
        const cameraInput = document.getElementById(
            "camera-photos-left",
        ) as HTMLInputElement
        expect(cameraInput).toBeInTheDocument()
        expect(cameraInput).toHaveAttribute("capture", "environment")

        const cameraPhoto = new File(["camera photo 1"], "cam1.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(cameraInput, { target: { files: [cameraPhoto] } })
        expect(screen.getByText("Photo 1")).toBeInTheDocument()

        // 4. Retaining 1 to 6 photos per Product; rejecting 7th photo with clear limit message
        const remainingPhotos = Array.from(
            { length: 5 },
            (_, i) =>
                new File([`photo ${i + 2}`], `p${i + 2}.jpg`, {
                    type: "image/jpeg",
                }),
        )
        fireEvent.change(fileInput, { target: { files: remainingPhotos } })
        expect(screen.getByText("Photo 6")).toBeInTheDocument()

        const seventhPhoto = new File(["extra photo"], "extra.jpg", {
            type: "image/jpeg",
        })
        fireEvent.change(fileInput, { target: { files: [seventhPhoto] } })
        expect(
            screen.getByText(/Maximum of 6 photos per Product reached/i),
        ).toBeInTheDocument()
    })
})

describe("Compare Products uncertainty, partial results, and recovery (#124)", () => {
    test("several columns pause for a plainly labeled selection with basis and prep state, then continue", async () => {
        const user = userEvent.setup()
        const extractPhotosMock = vi.fn().mockImplementation((id: string) =>
            Promise.resolve(
                id === "left"
                    ? {
                          schema_version: 1,
                          product_id: "left",
                          images: [
                              {
                                  image_id: "img_a1",
                                  original_image_id: "img_a1",
                                  role: "label",
                                  width: 800,
                                  height: 600,
                              },
                          ],
                          package_quantity: null,
                          nutrition_columns: [
                              {
                                  column_id: "col_dry",
                                  label: "Dry mix",
                                  state: "readable",
                                  basis: "per_100g",
                                  preparation_state: "as_sold",
                                  fields: [],
                              },
                              {
                                  column_id: "col_prep",
                                  label: "Prepared with milk",
                                  state: "readable",
                                  basis: "per_serving",
                                  preparation_state: "as_prepared",
                                  fields: [],
                              },
                          ],
                          outcome: "complete",
                          provider: "google",
                          model: "gemini",
                          configuration_version: "1.0.0",
                      }
                    : {
                          schema_version: 1,
                          product_id: "right",
                          images: [
                              {
                                  image_id: "img_b1",
                                  original_image_id: "img_b1",
                                  role: "label",
                                  width: 800,
                                  height: 600,
                              },
                          ],
                          package_quantity: null,
                          nutrition_columns: [
                              {
                                  column_id: "col_sole",
                                  label: "Per 100g",
                                  state: "readable",
                                  basis: "per_100g",
                                  preparation_state: "as_sold",
                                  fields: [],
                              },
                          ],
                          outcome: "complete",
                          provider: "google",
                          model: "gemini",
                          configuration_version: "1.0.0",
                      },
            ),
        )

        const compareMock = vi.fn().mockResolvedValue({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "protein",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "col_dry",
                        observation: {
                            field_id: "left_prot",
                            nutrient: "protein",
                            label: "Protein",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "12",
                            unit_text: "g",
                            evidence: [{ image_id: "img_a1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "col_sole",
                        observation: {
                            field_id: "right_prot",
                            nutrient: "protein",
                            label: "Protein",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "8",
                            unit_text: "g",
                            evidence: [{ image_id: "img_b1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "12",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "8",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "4",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos for both products
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        // Tap Compare Products
        const compareBtn = screen.getByRole("button", {
            name: "Compare Products",
        })
        await user.click(compareBtn)

        // Extraction runs for both
        expect(extractPhotosMock).toHaveBeenCalledTimes(2)

        // Pauses because Product A has 2 columns and none was selected!
        expect(
            screen.getByText(
                "Select a nutrition column for Product A to continue.",
            ),
        ).toBeInTheDocument()
        expect(compareMock).not.toHaveBeenCalled()

        // Plainly labeled basis and preparation states are visible
        expect(
            screen.getAllByText("Per 100 g · As sold").length,
        ).toBeGreaterThan(0)
        expect(
            screen.getByText("Per serving · As prepared"),
        ).toBeInTheDocument()

        // Sole column on Product B is labeled
        expect(screen.getByText("Sole column")).toBeInTheDocument()

        // Select the dry column for Product A -> should continue automatically
        const selectDryColBtn = screen.getAllByRole("button", {
            name: "Select column",
        })[0]
        await user.click(selectDryColBtn!)

        // Comparison continues automatically
        expect(compareMock).toHaveBeenCalledTimes(1)
        expect(compareMock).toHaveBeenCalledWith(
            expect.objectContaining({
                left_column_id: "col_dry",
                right_column_id: "col_sole",
            }),
        )

        // Comparison results render with factual difference
        expect(screen.getByText("Protein")).toBeInTheDocument()
        expect(screen.getByText("+4 g")).toBeInTheDocument()
        expect(screen.getByText("Product A has more")).toBeInTheDocument()
    })

    test("each value states basis and distinguishes dry vs prepared values", () => {
        const mockRow: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "fat",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "f1",
                            nutrient: "fat",
                            label: "Total Fat",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "15",
                            unit_text: "g",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "f2",
                            nutrient: "fat",
                            label: "Total Fat",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "10",
                            unit_text: "g",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "15",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "10",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "5",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: null,
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const rightProd: ProductSideState = {
            id: "right",
            title: "Product B",
            number: "2",
            photos: [],
            extraction: null,
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockRow}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // Basis and preparation state stated for each value (and difference)
        const basisLabels = screen.getAllByText("per 100 g · as sold")
        expect(basisLabels.length).toBeGreaterThanOrEqual(2)

        // Leads with Product identities
        expect(screen.getByText("Comparing Products")).toBeInTheDocument()
        expect(screen.getAllByText("Product A").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Product B").length).toBeGreaterThan(0)

        // Evidence and details are placed behind accessible disclosure controls
        const disclosures = screen.getAllByText("Evidence & details")
        expect(disclosures.length).toBeGreaterThan(0)
    })

    test("results lead with Product identities, comparison basis, and nutrition comparison while details sit behind accessible disclosures", () => {
        const mockDisclosedComparison: ComparisonResponse = {
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
                        column_id: "c1",
                        observation: {
                            field_id: "sod_1",
                            nutrient: "sodium",
                            label: "Sodium",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "1.38",
                            unit_text: "g",
                            evidence: [{ image_id: "img_label_1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "sod_2",
                            nutrient: "sodium",
                            label: "Sodium",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "500",
                            unit_text: "mg",
                            evidence: [{ image_id: "img_label_2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "1380",
                        unit: "mg",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "500",
                        unit: "mg",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "880",
                        unit: "mg",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Crisps A",
            number: "1",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "left",
                images: [
                    {
                        image_id: "img_label_1",
                        original_image_id: "img_label_1",
                        role: "label",
                        width: 800,
                        height: 600,
                    },
                ],
                package_quantity: null,
                nutrition_columns: [],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        const rightProd: ProductSideState = {
            id: "right",
            title: "Crisps B",
            number: "2",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "right",
                images: [
                    {
                        image_id: "img_label_2",
                        original_image_id: "img_label_2",
                        role: "label",
                        width: 800,
                        height: 600,
                    },
                ],
                package_quantity: null,
                nutrition_columns: [],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockDisclosedComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // 1. Leads with Product identities
        expect(screen.getByText("Comparing Products")).toBeInTheDocument()
        expect(screen.getAllByText("Crisps A").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Crisps B").length).toBeGreaterThan(0)

        // 2. Comparison basis notice
        expect(
            screen.getByText("Equal-weight comparison (per 100 g)"),
        ).toBeInTheDocument()

        // 3. Nutrition table leads with comparison
        expect(screen.getByText("Sodium")).toBeInTheDocument()
        expect(screen.getByText("1,380 mg")).toBeInTheDocument()
        expect(screen.getByText("+880 mg")).toBeInTheDocument()
        expect(screen.getByText("Crisps A has more")).toBeInTheDocument()

        // 4. Details sit behind accessible disclosure controls
        const disclosures = screen.getAllByText("Evidence & details")
        expect(disclosures.length).toBeGreaterThan(0)

        // Inside disclosure: reported printed values that differ from normalized
        expect(screen.getByText(/Printed:/i)).toBeInTheDocument()
        expect(screen.getByText("1.38 g")).toBeInTheDocument()

        // Inside disclosure: source photo evidence button
        expect(screen.getAllByText("View photo 1").length).toBeGreaterThan(0)
    })

    test("handles partial extractions, unreadable values, and explicit zero distinct from missing data", () => {
        const mockPartialComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "sugar",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "sug_0",
                            nutrient: "sugar",
                            label: "Sugars",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "0",
                            unit_text: "g",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "sug_5",
                            nutrient: "sugar",
                            label: "Sugars",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "5",
                            unit_text: "g",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "0",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "5",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "-5",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
                {
                    nutrient: "calcium",
                    row_kind: "amount",
                    state: "not_comparable",
                    reason: "Not found in photos for the other product.",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "calc_1",
                            nutrient: "calcium",
                            label: "Calcium",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "200",
                            unit_text: "mg",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                },
                {
                    nutrient: "iron",
                    row_kind: "amount",
                    state: "not_comparable",
                    reason: "One or both observations are not readable.",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "iron_1",
                            nutrient: "iron",
                            label: "Iron",
                            state: "unreadable",
                            row_kind: "amount",
                            qualifier: "exact",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "iron_2",
                            nutrient: "iron",
                            label: "Iron",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "4",
                            unit_text: "mg",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: null,
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const rightProd: ProductSideState = {
            id: "right",
            title: "Product B",
            number: "2",
            photos: [],
            extraction: null,
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockPartialComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // 1. Explicit zero is shown as "0 g", NOT treated as missing
        expect(screen.getByText("0 g")).toBeInTheDocument()
        expect(screen.getByText("Product B has more")).toBeInTheDocument()

        // 2. Missing calcium on right product shows "Not found in these photos" and never zero
        expect(
            screen.getByText("Not found in these photos"),
        ).toBeInTheDocument()
        expect(screen.getByText("200 mg")).toBeInTheDocument()

        // 3. Unreadable iron shows "Could not read this value" and never zero
        expect(
            screen.getByText("Could not read this value"),
        ).toBeInTheDocument()
        expect(screen.getByText("4 mg")).toBeInTheDocument()
        expect(
            screen.getByText("One or both observations are not readable."),
        ).toBeInTheDocument()
    })

    test("displays conflicting values and suppresses definitive difference for unknown preparation", () => {
        const mockConflictingAndConditional: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "sodium",
                    row_kind: "amount",
                    state: "not_comparable",
                    reason: "One or both observations are not readable.",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "sod_conflict",
                            nutrient: "sodium",
                            label: "Sodium",
                            state: "conflicting",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "500",
                            unit_text: "mg",
                            alternatives: [
                                {
                                    value_text: "650",
                                    unit_text: "mg",
                                    state: "readable",
                                    evidence: [{ image_id: "img_alt" }],
                                },
                            ],
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "sod_r",
                            nutrient: "sodium",
                            label: "Sodium",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "400",
                            unit_text: "mg",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                },
                {
                    nutrient: "energy",
                    row_kind: "amount",
                    state: "conditional",
                    reason: "Preparation state is unknown, so the normalized values are conditional.",
                    assumptions: [
                        "Preparation state is unknown for at least one Product.",
                    ],
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "nrg_1",
                            nutrient: "energy",
                            label: "Energy",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "150",
                            unit_text: "kcal",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "unknown",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "nrg_2",
                            nutrient: "energy",
                            label: "Energy",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "150",
                            unit_text: "kcal",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "150",
                        unit: "kcal",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "150",
                        unit: "kcal",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "0",
                        unit: "kcal",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: null,
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const rightProd: ProductSideState = {
            id: "right",
            title: "Product B",
            number: "2",
            photos: [],
            extraction: null,
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockConflictingAndConditional}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // Conflicting values are visible
        expect(
            screen.getByText(/Conflicting values on label:/i),
        ).toBeInTheDocument()
        expect(screen.getByText("500 mg")).toBeInTheDocument()
        expect(screen.getByText("vs 650 mg")).toBeInTheDocument()

        // Conditional unknown preparation suppresses definitive difference
        expect(screen.getByText("Conditional")).toBeInTheDocument()
        expect(
            screen.getByText(
                "Preparation state is unknown, so the normalized values are conditional.",
            ),
        ).toBeInTheDocument()
        expect(
            screen.getAllByText(
                "Preparation state is unknown for at least one Product.",
            ).length,
        ).toBeGreaterThan(0)
        expect(screen.queryByText("Equal amount")).not.toBeInTheDocument()
        expect(screen.queryByText("Identical amount")).not.toBeInTheDocument()
    })

    test("clearly indicates equal nutrient amounts", () => {
        const mockEqualComparison: ComparisonResponse = {
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [
                {
                    nutrient: "fiber",
                    row_kind: "amount",
                    state: "comparable",
                    left: {
                        column_id: "c1",
                        observation: {
                            field_id: "fib_1",
                            nutrient: "fiber",
                            label: "Dietary Fiber",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "3",
                            unit_text: "g",
                            evidence: [{ image_id: "img1" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    right: {
                        column_id: "c2",
                        observation: {
                            field_id: "fib_2",
                            nutrient: "fiber",
                            label: "Dietary Fiber",
                            state: "readable",
                            row_kind: "amount",
                            qualifier: "exact",
                            value_text: "3",
                            unit_text: "g",
                            evidence: [{ image_id: "img2" }],
                        },
                        basis: "per_100g",
                        preparation_state: "as_sold",
                    },
                    normalized_left: {
                        value: "3",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    normalized_right: {
                        value: "3",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                    derived_difference: {
                        value: "0",
                        unit: "g",
                        target_basis: "per_100g",
                        inputs: [],
                    },
                },
            ],
        }

        const leftProd: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: null,
            selectedColumnId: "c1",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }
        const rightProd: ProductSideState = {
            id: "right",
            title: "Product B",
            number: "2",
            photos: [],
            extraction: null,
            selectedColumnId: "c2",
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ComparisonSection
                comparison={mockEqualComparison}
                comparisonStatus="Comparison ready"
                comparisonError={null}
                isComparing={false}
                isReadyToCompare={true}
                leftProduct={leftProd}
                rightProduct={rightProd}
                onCompare={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // Clear equal amount badge and message
        expect(screen.getByText("Equal amount")).toBeInTheDocument()
        expect(screen.getByText("Identical amount")).toBeInTheDocument()
        expect(screen.getByText("0 g")).toBeInTheDocument()
    })

    test("actionable error recovery and retry preserves unaffected work", async () => {
        const user = userEvent.setup()
        let rightShouldFail = true

        const extractPhotosMock = vi.fn().mockImplementation((id: string) => {
            if (id === "left") {
                return Promise.resolve({
                    schema_version: 1,
                    product_id: "left",
                    images: [
                        {
                            image_id: "img_a",
                            original_image_id: "img_a",
                            role: "label",
                            width: 800,
                            height: 600,
                        },
                    ],
                    package_quantity: null,
                    nutrition_columns: [
                        {
                            column_id: "c1",
                            name: "Per 100g",
                            state: "readable",
                            basis: "per_100g",
                            preparation_state: "as_sold",
                            fields: [],
                        },
                    ],
                    outcome: "complete",
                    provider: "google",
                    model: "gemini",
                    configuration_version: "1.0.0",
                })
            }
            if (rightShouldFail) {
                return Promise.reject(
                    new Error(
                        "provider_timeout: The extraction provider timed out.",
                    ),
                )
            }
            return Promise.resolve({
                schema_version: 1,
                product_id: "right",
                images: [
                    {
                        image_id: "img_b",
                        original_image_id: "img_b",
                        role: "label",
                        width: 800,
                        height: 600,
                    },
                ],
                package_quantity: null,
                nutrition_columns: [
                    {
                        column_id: "c2",
                        name: "Per 100g",
                        state: "readable",
                        basis: "per_100g",
                        preparation_state: "as_sold",
                        fields: [],
                    },
                ],
                outcome: "complete",
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            })
        })

        const compareMock = vi.fn().mockResolvedValue({
            schema_version: 1,
            calculated_from_submitted_evidence: true,
            left_product_id: "left",
            right_product_id: "right",
            rows: [],
        })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/compare"]}>
                    <PhotoComparisonPage
                        extractPhotos={extractPhotosMock}
                        compare={compareMock}
                    />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        // Upload photos for both
        const inputLeft = document.getElementById(
            "upload-photos-left",
        ) as HTMLInputElement
        const inputRight = document.getElementById(
            "upload-photos-right",
        ) as HTMLInputElement
        fireEvent.change(inputLeft, {
            target: {
                files: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
            },
        })
        fireEvent.change(inputRight, {
            target: {
                files: [new File(["b"], "b.jpg", { type: "image/jpeg" })],
            },
        })

        const compareBtn = screen.getByRole("button", {
            name: "Compare Products",
        })
        await user.click(compareBtn)

        // Product A succeeded, Product B failed with timeout
        expect(extractPhotosMock).toHaveBeenCalledTimes(2)
        expect(
            screen.getByText(
                /Photo processing request timed out\. Please check your connection and tap Retry\./i,
            ),
        ).toBeInTheDocument()

        // Button shows "Retry comparison"
        const retryBtn = screen.getByRole("button", {
            name: "Retry comparison",
        })
        expect(retryBtn).toBeInTheDocument()

        // Now fix Product B and retry
        rightShouldFail = false
        await user.click(retryBtn)

        // Product A's work was preserved! Only Product B was called on retry!
        // So total calls to extractPhotosMock is now 3 (left: 1, right: 2)
        expect(extractPhotosMock).toHaveBeenCalledTimes(3)
        expect(extractPhotosMock).toHaveBeenLastCalledWith(
            "right",
            expect.any(Array),
        )
    })

    test("retake-required and partial outcomes show actionable guidance in ProductPhotoPanel", () => {
        const retakeProduct: ProductSideState = {
            id: "left",
            title: "Product A",
            number: "1",
            photos: [],
            extraction: {
                schema_version: 1,
                product_id: "left",
                images: [],
                package_quantity: null,
                nutrition_columns: [],
                outcome: "retake_required",
                retake_reasons: [
                    "Nutrition facts panel is blurry or out of focus.",
                    "Glare reflects across the serving size line.",
                ],
                provider: "google",
                model: "gemini",
                configuration_version: "1.0.0",
            },
            selectedColumnId: null,
            loading: false,
            error: "",
            retry: false,
            revision: 1,
        }

        render(
            <ProductPhotoPanel
                product={retakeProduct}
                highlightedPhotoId={null}
                previewRefs={{ current: {} }}
                onTitleChange={vi.fn()}
                onAddFiles={vi.fn()}
                onRemovePhoto={vi.fn()}
                onReplacePhoto={vi.fn()}
                onClearPhotos={vi.fn()}
                onSelectColumn={vi.fn()}
                onFocusEvidence={vi.fn()}
            />,
        )

        // Actionable guidance for unreadable photos
        expect(
            screen.getByText("Photos difficult to read: retake recommended"),
        ).toBeInTheDocument()
        expect(
            screen.getByText(
                /Photos could not be clearly read\. Please add or replace with well-lit, close-up photos/i,
            ),
        ).toBeInTheDocument()
        expect(
            screen.getByText(
                "Nutrition facts panel is blurry or out of focus.",
            ),
        ).toBeInTheDocument()
        expect(
            screen.getByText("Glare reflects across the serving size line."),
        ).toBeInTheDocument()
    })
})
