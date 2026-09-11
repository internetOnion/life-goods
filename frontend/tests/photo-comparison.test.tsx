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
