import { ArrowCounterClockwise } from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"

import { appRoutes } from "@/app/routes"
import { BrandLockup } from "@/components/brand/BrandMark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { usePageMetadata } from "@/lib/metadata"

import { compareProducts, extractProductPhotos } from "./api"
import { ComparisonSection } from "./ComparisonSection"
import { ProductPhotoPanel } from "./ProductPhotoPanel"
import type {
    ComparisonResponse,
    ProductPhoto,
    ProductSideState,
} from "./types"

function createInitialProduct(
    id: "left" | "right",
    title: string,
    number: "1" | "2",
): ProductSideState {
    return {
        id,
        title,
        number,
        photos: [],
        extraction: null,
        selectedColumnId: null,
        loading: false,
        error: "",
        retry: false,
        revision: 0,
    }
}

export function PhotoComparisonPage() {
    usePageMetadata({
        title: "Photo comparison lab",
        description:
            "Experimental side-by-side product label photo evidence extraction and deterministic comparison.",
    })

    const [leftProduct, setLeftProduct] = useState<ProductSideState>(() =>
        createInitialProduct("left", "Product A", "1"),
    )
    const [rightProduct, setRightProduct] = useState<ProductSideState>(() =>
        createInitialProduct("right", "Product B", "2"),
    )

    const [comparison, setComparison] = useState<ComparisonResponse | null>(
        null,
    )
    const [isComparing, setIsComparing] = useState(false)
    const [comparisonError, setComparisonError] = useState<string | null>(null)
    const [highlightedPhotoId, setHighlightedPhotoId] = useState<string | null>(
        null,
    )

    const previewRefs = useRef<Record<string, HTMLElement | null>>({})
    const activeUrlsRef = useRef<Set<string>>(new Set())

    // Revoke all created URLs when unmounting
    useEffect(() => {
        const activeUrls = activeUrlsRef.current
        return () => {
            for (const url of activeUrls) {
                URL.revokeObjectURL(url)
            }
            activeUrls.clear()
        }
    }, [])

    const isReadyToCompare = useMemo(() => {
        const isReady = (prod: ProductSideState) =>
            prod.extraction !== null &&
            ["complete", "partial"].includes(prod.extraction.outcome) &&
            (prod.extraction.nutrition_columns.length <= 1 ||
                Boolean(prod.selectedColumnId))
        return isReady(leftProduct) && isReady(rightProduct)
    }, [leftProduct, rightProduct])

    const comparisonStatus = useMemo(() => {
        if (comparisonError) return comparisonError
        if (isComparing) return "Calculating explicit compatible values…"
        if (comparison) {
            return "Comparison is based on submitted photo evidence."
        }
        if (isReadyToCompare) {
            return "Both extractions are ready."
        }
        return "Extract both Products to enable comparison."
    }, [comparison, comparisonError, isComparing, isReadyToCompare])

    const invalidateComparison = () => {
        setComparison(null)
        setComparisonError(null)
    }

    const handleResetSession = () => {
        for (const photo of leftProduct.photos) {
            URL.revokeObjectURL(photo.url)
            activeUrlsRef.current.delete(photo.url)
        }
        for (const photo of rightProduct.photos) {
            URL.revokeObjectURL(photo.url)
            activeUrlsRef.current.delete(photo.url)
        }
        setLeftProduct(createInitialProduct("left", "Product A", "1"))
        setRightProduct(createInitialProduct("right", "Product B", "2"))
        invalidateComparison()
    }

    const handleTitleChange = (side: "left" | "right", title: string) => {
        if (side === "left") {
            setLeftProduct((prev) => ({ ...prev, title }))
        } else {
            setRightProduct((prev) => ({ ...prev, title }))
        }
    }

    const handleAddFiles = (side: "left" | "right", files: File[]) => {
        const updater = (prev: ProductSideState): ProductSideState => {
            const available = 6 - prev.photos.length
            if (available <= 0) return prev

            const validFiles = files
                .filter((file) =>
                    ["image/jpeg", "image/png"].includes(file.type),
                )
                .slice(0, available)

            if (validFiles.length === 0) return prev

            const newPhotos: ProductPhoto[] = validFiles.map((file) => {
                const url = URL.createObjectURL(file)
                activeUrlsRef.current.add(url)
                return {
                    file,
                    url,
                    localId: crypto.randomUUID(),
                }
            })

            return {
                ...prev,
                photos: [...prev.photos, ...newPhotos],
                revision: prev.revision + 1,
                extraction: null,
                selectedColumnId: null,
                error: "",
                retry: false,
                loading: false,
            }
        }

        invalidateComparison()
        if (side === "left") {
            setLeftProduct(updater)
        } else {
            setRightProduct(updater)
        }
    }

    const handleRemovePhoto = (side: "left" | "right", index: number) => {
        const updater = (prev: ProductSideState): ProductSideState => {
            const photo = prev.photos[index]
            if (photo) {
                URL.revokeObjectURL(photo.url)
                activeUrlsRef.current.delete(photo.url)
            }
            const nextPhotos = prev.photos.filter((_, i) => i !== index)
            return {
                ...prev,
                photos: nextPhotos,
                revision: prev.revision + 1,
                extraction: null,
                selectedColumnId: null,
                error: "",
                retry: false,
                loading: false,
            }
        }

        invalidateComparison()
        if (side === "left") {
            setLeftProduct(updater)
        } else {
            setRightProduct(updater)
        }
    }

    const handleReplacePhoto = (
        side: "left" | "right",
        index: number,
        file: File,
    ) => {
        if (!["image/jpeg", "image/png"].includes(file.type)) return

        const updater = (prev: ProductSideState): ProductSideState => {
            const oldPhoto = prev.photos[index]
            if (oldPhoto) {
                URL.revokeObjectURL(oldPhoto.url)
                activeUrlsRef.current.delete(oldPhoto.url)
            }

            const url = URL.createObjectURL(file)
            activeUrlsRef.current.add(url)
            const newPhoto: ProductPhoto = {
                file,
                url,
                localId: crypto.randomUUID(),
            }

            const nextPhotos = [...prev.photos]
            nextPhotos[index] = newPhoto

            return {
                ...prev,
                photos: nextPhotos,
                revision: prev.revision + 1,
                extraction: null,
                selectedColumnId: null,
                error: "",
                retry: false,
                loading: false,
            }
        }

        invalidateComparison()
        if (side === "left") {
            setLeftProduct(updater)
        } else {
            setRightProduct(updater)
        }
    }

    const handleClearPhotos = (side: "left" | "right") => {
        const updater = (prev: ProductSideState): ProductSideState => {
            for (const photo of prev.photos) {
                URL.revokeObjectURL(photo.url)
                activeUrlsRef.current.delete(photo.url)
            }
            return {
                ...prev,
                photos: [],
                revision: prev.revision + 1,
                extraction: null,
                selectedColumnId: null,
                error: "",
                retry: false,
                loading: false,
            }
        }

        invalidateComparison()
        if (side === "left") {
            setLeftProduct(updater)
        } else {
            setRightProduct(updater)
        }
    }

    const handleSelectColumn = (
        side: "left" | "right",
        columnId: string | null,
    ) => {
        invalidateComparison()
        if (side === "left") {
            setLeftProduct((prev) => ({ ...prev, selectedColumnId: columnId }))
        } else {
            setRightProduct((prev) => ({ ...prev, selectedColumnId: columnId }))
        }
    }

    const handleExtract = async (side: "left" | "right") => {
        const product = side === "left" ? leftProduct : rightProduct
        const setProduct = side === "left" ? setLeftProduct : setRightProduct

        if (product.photos.length === 0) return

        const currentRevision = product.revision

        setProduct((prev) => ({
            ...prev,
            loading: true,
            error: "",
        }))
        invalidateComparison()

        try {
            const extraction = await extractProductPhotos(
                product.id,
                product.photos.map((p) => p.file),
            )

            setProduct((prev) => {
                if (prev.revision !== currentRevision) return prev
                const defaultColId =
                    extraction.nutrition_columns.length === 1
                        ? (extraction.nutrition_columns[0]?.column_id ?? null)
                        : null
                return {
                    ...prev,
                    loading: false,
                    extraction,
                    selectedColumnId: defaultColId,
                    retry: false,
                }
            })
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "The extraction request failed. Check the provider and retry."
            setProduct((prev) => {
                if (prev.revision !== currentRevision) return prev
                return {
                    ...prev,
                    loading: false,
                    error: message,
                    retry: true,
                }
            })
        }
    }

    const handleCompare = async () => {
        if (
            !isReadyToCompare ||
            !leftProduct.extraction ||
            !rightProduct.extraction
        ) {
            return
        }

        setIsComparing(true)
        setComparisonError(null)

        const payload = {
            left: leftProduct.extraction,
            right: rightProduct.extraction,
            left_column_id: leftProduct.selectedColumnId || undefined,
            right_column_id: rightProduct.selectedColumnId || undefined,
        }

        try {
            const result = await compareProducts(payload)
            setComparison(result)
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "The comparison request failed. Retry when both extractions are ready."
            setComparisonError(message)
        } finally {
            setIsComparing(false)
        }
    }

    const handleFocusEvidence = (imageId: string) => {
        const checkSide = (prod: ProductSideState): boolean => {
            const index = prod.extraction?.images?.findIndex(
                (img) => img.image_id === imageId,
            )
            if (index !== undefined && index >= 0 && prod.photos[index]) {
                const photo = prod.photos[index]
                const el = previewRefs.current[photo.localId]
                el?.scrollIntoView({ behavior: "smooth", block: "center" })
                setHighlightedPhotoId(photo.localId)
                setTimeout(() => {
                    setHighlightedPhotoId((current) =>
                        current === photo.localId ? null : current,
                    )
                }, 1600)
                return true
            }
            return false
        }

        if (!checkSide(leftProduct)) {
            checkSide(rightProduct)
        }
    }

    return (
        <div className="min-h-screen bg-neutral-50 pb-20 text-neutral-900">
            {/* Topbar Header */}
            <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <Link
                            to={appRoutes.home}
                            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
                            aria-label="Back to Life Goods scan"
                        >
                            <BrandLockup compact />
                        </Link>
                        <Badge
                            variant="accent"
                            className="font-mono text-[11px]"
                        >
                            Photo Lab
                        </Badge>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-xs font-semibold text-neutral-600 hover:text-neutral-950"
                    >
                        <Link to={appRoutes.home}>Return to Scan</Link>
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                {/* Header / Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl">
                            Choose two Products
                        </h1>
                        <p className="mt-1 text-xs text-neutral-500">
                            JPEG or PNG · 1–6 photos each · add a package-weight
                            photo when needed
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleResetSession}
                        className="gap-1.5 self-start font-semibold text-neutral-700 sm:self-auto"
                    >
                        <ArrowCounterClockwise size={15} weight="bold" />
                        <span>Reset session</span>
                    </Button>
                </div>

                {/* Two side-by-side Product Panels */}
                <section
                    className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2"
                    aria-label="Product photo panels"
                >
                    <ProductPhotoPanel
                        product={leftProduct}
                        highlightedPhotoId={highlightedPhotoId}
                        previewRefs={previewRefs}
                        onTitleChange={(title) =>
                            handleTitleChange("left", title)
                        }
                        onAddFiles={(files) => handleAddFiles("left", files)}
                        onRemovePhoto={(index) =>
                            handleRemovePhoto("left", index)
                        }
                        onReplacePhoto={(index, file) =>
                            handleReplacePhoto("left", index, file)
                        }
                        onClearPhotos={() => handleClearPhotos("left")}
                        onExtract={() => {
                            void handleExtract("left")
                        }}
                        onSelectColumn={(colId) =>
                            handleSelectColumn("left", colId)
                        }
                        onFocusEvidence={handleFocusEvidence}
                    />

                    <ProductPhotoPanel
                        product={rightProduct}
                        highlightedPhotoId={highlightedPhotoId}
                        previewRefs={previewRefs}
                        onTitleChange={(title) =>
                            handleTitleChange("right", title)
                        }
                        onAddFiles={(files) => handleAddFiles("right", files)}
                        onRemovePhoto={(index) =>
                            handleRemovePhoto("right", index)
                        }
                        onReplacePhoto={(index, file) =>
                            handleReplacePhoto("right", index, file)
                        }
                        onClearPhotos={() => handleClearPhotos("right")}
                        onExtract={() => {
                            void handleExtract("right")
                        }}
                        onSelectColumn={(colId) =>
                            handleSelectColumn("right", colId)
                        }
                        onFocusEvidence={handleFocusEvidence}
                    />
                </section>

                {/* Comparison Section */}
                <ComparisonSection
                    comparison={comparison}
                    comparisonStatus={comparisonStatus}
                    comparisonError={comparisonError}
                    isComparing={isComparing}
                    isReadyToCompare={isReadyToCompare}
                    leftProduct={leftProduct}
                    rightProduct={rightProduct}
                    onCompare={() => {
                        void handleCompare()
                    }}
                    onFocusEvidence={handleFocusEvidence}
                />
            </main>
        </div>
    )
}
