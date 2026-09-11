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
import { formatActionableError } from "./helpers"
import { PhotoInspectionModal } from "./PhotoInspectionModal"
import { ProductPhotoPanel } from "./ProductPhotoPanel"
import type {
    ComparisonRequest,
    ComparisonResponse,
    ProductPhoto,
    ProductSideState,
} from "./types"

const MAX_PHOTOS = 6
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MiB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"]

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

function getDefaultColumnId(
    extraction: ProductSideState["extraction"],
): string | null {
    if (
        !extraction?.nutrition_columns ||
        extraction.nutrition_columns.length !== 1
    ) {
        return null
    }
    return extraction.nutrition_columns[0]?.column_id ?? null
}

function isAbortError(err: unknown): boolean {
    if (!err) return false
    if (typeof err === "object") {
        if ("name" in err && (err as { name?: string }).name === "AbortError") {
            return true
        }
    }
    return false
}

export type PhotoComparisonPageProps = {
    extractPhotos?: typeof extractProductPhotos
    compare?: typeof compareProducts
}

export function PhotoComparisonPage({
    extractPhotos = extractProductPhotos,
    compare = compareProducts,
}: PhotoComparisonPageProps = {}) {
    usePageMetadata({
        title: "Compare Products",
        description: "Compare nutrition labels using photos.",
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
    const [processingStep, setProcessingStep] = useState<
        "idle" | "extracting_left" | "extracting_right" | "comparing"
    >("idle")
    const [comparisonError, setComparisonError] = useState<string | null>(null)
    const [highlightedPhotoId, setHighlightedPhotoId] = useState<string | null>(
        null,
    )
    const [inspectionState, setInspectionState] = useState<{
        isOpen: boolean
        side: "left" | "right"
        index: number
    }>({
        isOpen: false,
        side: "left",
        index: 0,
    })

    const previewRefs = useRef<Record<string, HTMLElement | null>>({})
    const activeUrlsRef = useRef<Set<string>>(new Set())
    const comparisonRequestIdRef = useRef<number>(0)
    const isMountedRef = useRef<boolean>(true)
    const sessionIdRef = useRef<number>(1)
    const leftAbortControllerRef = useRef<AbortController | null>(null)
    const rightAbortControllerRef = useRef<AbortController | null>(null)
    const compareAbortControllerRef = useRef<AbortController | null>(null)
    const leftProductRef = useRef<ProductSideState>(leftProduct)
    const rightProductRef = useRef<ProductSideState>(rightProduct)
    leftProductRef.current = leftProduct
    rightProductRef.current = rightProduct

    const abortInFlightExtraction = (side?: "left" | "right") => {
        if (!side || side === "left") {
            if (leftAbortControllerRef.current) {
                leftAbortControllerRef.current.abort()
                leftAbortControllerRef.current = null
            }
        }
        if (!side || side === "right") {
            if (rightAbortControllerRef.current) {
                rightAbortControllerRef.current.abort()
                rightAbortControllerRef.current = null
            }
        }
    }

    const abortInFlightComparison = () => {
        if (compareAbortControllerRef.current) {
            compareAbortControllerRef.current.abort()
            compareAbortControllerRef.current = null
        }
    }

    // Revoke all created URLs and abort pending requests when unmounting
    useEffect(() => {
        isMountedRef.current = true
        const activeUrls = activeUrlsRef.current
        return () => {
            isMountedRef.current = false
            abortInFlightExtraction()
            abortInFlightComparison()
            for (const url of activeUrls) {
                URL.revokeObjectURL(url)
            }
            activeUrls.clear()
        }
    }, [])

    const isReadyToCompare = useMemo(() => {
        if (
            leftProduct.photos.length === 0 ||
            rightProduct.photos.length === 0
        ) {
            return false
        }
        if (
            leftProduct.extraction &&
            (leftProduct.extraction.nutrition_columns?.length ?? 0) > 1 &&
            !leftProduct.selectedColumnId
        ) {
            return false
        }
        if (
            rightProduct.extraction &&
            (rightProduct.extraction.nutrition_columns?.length ?? 0) > 1 &&
            !rightProduct.selectedColumnId
        ) {
            return false
        }
        return true
    }, [leftProduct, rightProduct])

    const compareButtonLabel = useMemo(() => {
        if (processingStep === "extracting_left") {
            return `Reading ${leftProduct.title}…`
        }
        if (processingStep === "extracting_right") {
            return `Reading ${rightProduct.title}…`
        }
        if (processingStep === "comparing") {
            return "Comparing…"
        }
        if (comparisonError || leftProduct.retry || rightProduct.retry) {
            return "Retry comparison"
        }
        return "Compare Products"
    }, [
        processingStep,
        leftProduct.title,
        rightProduct.title,
        leftProduct.retry,
        rightProduct.retry,
        comparisonError,
    ])

    const comparisonStatus = useMemo(() => {
        if (comparisonError) return comparisonError
        if (processingStep === "extracting_left") {
            return `Reading ${leftProduct.title} photos…`
        }
        if (processingStep === "extracting_right") {
            return `Reading ${rightProduct.title} photos…`
        }
        if (processingStep === "comparing") {
            return "Calculating explicit compatible values…"
        }
        if (comparison) {
            return "Comparison is based on submitted photo evidence."
        }
        if (
            leftProduct.photos.length === 0 ||
            rightProduct.photos.length === 0
        ) {
            return "Add photos for both products to compare."
        }
        if (
            leftProduct.extraction &&
            (leftProduct.extraction.nutrition_columns?.length ?? 0) > 1 &&
            !leftProduct.selectedColumnId
        ) {
            return `Select a nutrition column for ${leftProduct.title} to continue.`
        }
        if (
            rightProduct.extraction &&
            (rightProduct.extraction.nutrition_columns?.length ?? 0) > 1 &&
            !rightProduct.selectedColumnId
        ) {
            return `Select a nutrition column for ${rightProduct.title} to continue.`
        }
        return "Both products have photos. Ready to compare."
    }, [comparison, comparisonError, processingStep, leftProduct, rightProduct])

    const invalidateComparison = () => {
        abortInFlightComparison()
        comparisonRequestIdRef.current += 1
        setComparison(null)
        setComparisonError(null)
    }

    const resetSideProcessing = (side: "left" | "right") => {
        abortInFlightExtraction(side)
        invalidateComparison()
        setProcessingStep((step) => {
            if (side === "left" && step === "extracting_left") return "idle"
            if (side === "right" && step === "extracting_right") return "idle"
            if (step === "comparing") return "idle"
            return step
        })
    }

    const handleResetSession = () => {
        sessionIdRef.current += 1
        abortInFlightExtraction()
        abortInFlightComparison()
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
        setInspectionState({ isOpen: false, side: "left", index: 0 })
        setHighlightedPhotoId(null)
        setProcessingStep("idle")
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
        resetSideProcessing(side)

        const setProduct = side === "left" ? setLeftProduct : setRightProduct

        setProduct((prev) => {
            const available = MAX_PHOTOS - prev.photos.length
            if (available <= 0) {
                return {
                    ...prev,
                    error: "Maximum of 6 photos per Product reached.",
                }
            }

            const validationErrors: string[] = []
            const oversizedFiles = files.filter(
                (f) => f.size > MAX_FILE_SIZE_BYTES,
            )
            const invalidTypeFiles = files.filter(
                (f) => !ALLOWED_IMAGE_TYPES.includes(f.type),
            )

            if (invalidTypeFiles.length > 0) {
                validationErrors.push(
                    "Unsupported file format: only JPEG and PNG photos are supported. Please select JPEG or PNG images, or take a photo with your camera.",
                )
            }
            if (oversizedFiles.length > 0) {
                validationErrors.push(
                    `File size exceeds 10 MiB limit (${oversizedFiles.map((f) => f.name).join(", ")}). Please choose smaller photos or retake with standard camera resolution.`,
                )
            }

            const validFiles = files
                .filter(
                    (file) =>
                        ALLOWED_IMAGE_TYPES.includes(file.type) &&
                        file.size <= MAX_FILE_SIZE_BYTES,
                )
                .slice(0, available)

            if (validFiles.length === 0) {
                return {
                    ...prev,
                    error:
                        validationErrors.join(" ") ||
                        "No valid JPEG or PNG images to add.",
                }
            }

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
                error: validationErrors.join(" "),
                retry: false,
                loading: false,
            }
        })
    }

    const handleRemovePhoto = (side: "left" | "right", index: number) => {
        resetSideProcessing(side)

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
        resetSideProcessing(side)

        const setProduct = side === "left" ? setLeftProduct : setRightProduct

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            setProduct((prev) => ({
                ...prev,
                error: "Unsupported file format: only JPEG and PNG photos are supported. Please select JPEG or PNG images, or take a photo with your camera.",
            }))
            return
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            setProduct((prev) => ({
                ...prev,
                error: `File size exceeds 10 MiB limit (${file.name}). Please choose a smaller photo or retake with standard camera resolution.`,
            }))
            return
        }

        setProduct((prev) => {
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
        })
    }

    const handleClearPhotos = (side: "left" | "right") => {
        resetSideProcessing(side)

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
        abortInFlightComparison()
        invalidateComparison()

        if (side === "left") {
            leftProductRef.current = {
                ...leftProductRef.current,
                selectedColumnId: columnId,
            }
            setLeftProduct((prev) => ({ ...prev, selectedColumnId: columnId }))
        } else {
            rightProductRef.current = {
                ...rightProductRef.current,
                selectedColumnId: columnId,
            }
            setRightProduct((prev) => ({ ...prev, selectedColumnId: columnId }))
        }

        const currentLeft = leftProductRef.current
        const currentRight = rightProductRef.current

        const leftExt = currentLeft.extraction
        const rightExt = currentRight.extraction

        const nextLeftColId =
            side === "left"
                ? columnId
                : currentLeft.selectedColumnId || getDefaultColumnId(leftExt)

        const nextRightColId =
            side === "right"
                ? columnId
                : currentRight.selectedColumnId || getDefaultColumnId(rightExt)

        if (leftExt && rightExt && nextLeftColId && nextRightColId) {
            const reqId = ++comparisonRequestIdRef.current
            const compareSessionId = sessionIdRef.current
            const compController = new AbortController()
            compareAbortControllerRef.current = compController

            void (async () => {
                setProcessingStep("comparing")
                try {
                    const result = await compare(
                        {
                            left: leftExt,
                            right: rightExt,
                            left_column_id: nextLeftColId,
                            right_column_id: nextRightColId,
                        },
                        { signal: compController.signal },
                    )
                    if (
                        !isMountedRef.current ||
                        sessionIdRef.current !== compareSessionId ||
                        comparisonRequestIdRef.current !== reqId ||
                        compController.signal.aborted
                    ) {
                        return
                    }
                    setComparison(result)
                } catch (err: unknown) {
                    if (
                        !isMountedRef.current ||
                        sessionIdRef.current !== compareSessionId ||
                        comparisonRequestIdRef.current !== reqId ||
                        compController.signal.aborted ||
                        isAbortError(err)
                    ) {
                        return
                    }
                    const raw =
                        err instanceof Error
                            ? err.message
                            : "The comparison request failed."
                    setComparisonError(formatActionableError(raw))
                } finally {
                    if (compareAbortControllerRef.current === compController) {
                        compareAbortControllerRef.current = null
                    }
                    if (
                        isMountedRef.current &&
                        sessionIdRef.current === compareSessionId &&
                        comparisonRequestIdRef.current === reqId
                    ) {
                        setProcessingStep("idle")
                    }
                }
            })()
        }
    }

    const handleCompare = async () => {
        if (
            leftProduct.photos.length === 0 ||
            rightProduct.photos.length === 0 ||
            processingStep !== "idle"
        ) {
            return
        }

        setComparisonError(null)
        const compareSessionId = sessionIdRef.current
        const initialLeftRevision = leftProductRef.current.revision
        const initialRightRevision = rightProductRef.current.revision

        try {
            let leftExt = leftProductRef.current.extraction

            if (!leftExt) {
                if (leftProductRef.current.photos.length === 0) {
                    return
                }
                setProcessingStep("extracting_left")
                setLeftProduct((prev) => ({
                    ...prev,
                    loading: true,
                    error: "",
                }))
                const controller = new AbortController()
                leftAbortControllerRef.current = controller

                try {
                    const ext = await extractPhotos(
                        leftProductRef.current.id,
                        leftProductRef.current.photos.map((p) => p.file),
                        { signal: controller.signal },
                    )

                    if (
                        !isMountedRef.current ||
                        sessionIdRef.current !== compareSessionId ||
                        leftProductRef.current.revision !==
                            initialLeftRevision ||
                        controller.signal.aborted
                    ) {
                        return
                    }

                    leftExt = ext
                    const defaultColId =
                        (ext.nutrition_columns?.length ?? 0) === 1
                            ? (ext.nutrition_columns?.[0]?.column_id ?? null)
                            : null

                    let updatedTitle = leftProductRef.current.title
                    const isDefaultTitle =
                        updatedTitle === "Product A" ||
                        updatedTitle === "Product B"
                    if (isDefaultTitle) {
                        const brand = ext.identity?.brand?.value_text?.trim()
                        const name = ext.identity?.name?.value_text?.trim()
                        const detected = [brand, name].filter(Boolean).join(" ")
                        if (detected) {
                            updatedTitle = detected
                        }
                    }

                    leftProductRef.current = {
                        ...leftProductRef.current,
                        loading: false,
                        extraction: ext,
                        selectedColumnId: defaultColId,
                        title: updatedTitle,
                        retry: false,
                    }

                    setLeftProduct((prev) => {
                        if (prev.revision !== initialLeftRevision) return prev
                        return {
                            ...prev,
                            loading: false,
                            extraction: ext,
                            selectedColumnId: defaultColId,
                            title: updatedTitle,
                            retry: false,
                        }
                    })
                } catch (err: unknown) {
                    if (
                        !isMountedRef.current ||
                        sessionIdRef.current !== compareSessionId ||
                        leftProductRef.current.revision !==
                            initialLeftRevision ||
                        controller.signal.aborted ||
                        isAbortError(err)
                    ) {
                        return
                    }
                    const raw =
                        err instanceof Error
                            ? err.message
                            : "The extraction request failed. Check the provider and retry."
                    const message = formatActionableError(raw)
                    setLeftProduct((prev) => {
                        if (prev.revision !== initialLeftRevision) return prev
                        return {
                            ...prev,
                            loading: false,
                            error: message,
                            retry: true,
                        }
                    })
                    return
                } finally {
                    if (leftAbortControllerRef.current === controller) {
                        leftAbortControllerRef.current = null
                    }
                }
            }

            if (
                !isMountedRef.current ||
                sessionIdRef.current !== compareSessionId ||
                !leftExt ||
                leftProductRef.current.revision !== initialLeftRevision ||
                leftProductRef.current.photos.length === 0 ||
                rightProductRef.current.photos.length === 0 ||
                rightProductRef.current.revision !== initialRightRevision
            ) {
                return
            }

            let rightExt = rightProductRef.current.extraction
            const rightRevision = rightProductRef.current.revision

            if (!rightExt) {
                if (rightProductRef.current.photos.length === 0) {
                    return
                }
                setProcessingStep("extracting_right")
                setRightProduct((prev) => ({
                    ...prev,
                    loading: true,
                    error: "",
                }))
                const controller = new AbortController()
                rightAbortControllerRef.current = controller

                try {
                    const ext = await extractPhotos(
                        rightProductRef.current.id,
                        rightProductRef.current.photos.map((p) => p.file),
                        { signal: controller.signal },
                    )

                    if (
                        !isMountedRef.current ||
                        sessionIdRef.current !== compareSessionId ||
                        rightProductRef.current.revision !== rightRevision ||
                        controller.signal.aborted
                    ) {
                        return
                    }

                    rightExt = ext
                    const defaultColId =
                        (ext.nutrition_columns?.length ?? 0) === 1
                            ? (ext.nutrition_columns?.[0]?.column_id ?? null)
                            : null

                    let updatedTitle = rightProductRef.current.title
                    const isDefaultTitle =
                        updatedTitle === "Product A" ||
                        updatedTitle === "Product B"
                    if (isDefaultTitle) {
                        const brand = ext.identity?.brand?.value_text?.trim()
                        const name = ext.identity?.name?.value_text?.trim()
                        const detected = [brand, name].filter(Boolean).join(" ")
                        if (detected) {
                            updatedTitle = detected
                        }
                    }

                    rightProductRef.current = {
                        ...rightProductRef.current,
                        loading: false,
                        extraction: ext,
                        selectedColumnId: defaultColId,
                        title: updatedTitle,
                        retry: false,
                    }

                    setRightProduct((prev) => {
                        if (prev.revision !== rightRevision) return prev
                        return {
                            ...prev,
                            loading: false,
                            extraction: ext,
                            selectedColumnId: defaultColId,
                            title: updatedTitle,
                            retry: false,
                        }
                    })
                } catch (err: unknown) {
                    if (
                        !isMountedRef.current ||
                        sessionIdRef.current !== compareSessionId ||
                        rightProductRef.current.revision !== rightRevision ||
                        controller.signal.aborted ||
                        isAbortError(err)
                    ) {
                        return
                    }
                    const raw =
                        err instanceof Error
                            ? err.message
                            : "The extraction request failed. Check the provider and retry."
                    const message = formatActionableError(raw)
                    setRightProduct((prev) => {
                        if (prev.revision !== rightRevision) return prev
                        return {
                            ...prev,
                            loading: false,
                            error: message,
                            retry: true,
                        }
                    })
                    return
                } finally {
                    if (rightAbortControllerRef.current === controller) {
                        rightAbortControllerRef.current = null
                    }
                }
            }

            if (
                !isMountedRef.current ||
                sessionIdRef.current !== compareSessionId ||
                !leftExt ||
                !rightExt ||
                leftProductRef.current.revision !== initialLeftRevision ||
                rightProductRef.current.revision !== rightRevision ||
                leftProductRef.current.photos.length === 0 ||
                rightProductRef.current.photos.length === 0
            ) {
                return
            }

            const leftColId =
                leftProductRef.current.selectedColumnId ||
                getDefaultColumnId(leftExt)

            const rightColId =
                rightProductRef.current.selectedColumnId ||
                getDefaultColumnId(rightExt)

            if ((leftExt.nutrition_columns?.length ?? 0) > 1 && !leftColId) {
                return
            }
            if ((rightExt.nutrition_columns?.length ?? 0) > 1 && !rightColId) {
                return
            }

            setProcessingStep("comparing")
            abortInFlightComparison()
            const reqId = ++comparisonRequestIdRef.current
            const compController = new AbortController()
            compareAbortControllerRef.current = compController

            const payload: ComparisonRequest = {
                left: leftExt,
                right: rightExt,
                left_column_id: leftColId || undefined,
                right_column_id: rightColId || undefined,
            }

            try {
                const result = await compare(payload, {
                    signal: compController.signal,
                })
                if (
                    !isMountedRef.current ||
                    sessionIdRef.current !== compareSessionId ||
                    comparisonRequestIdRef.current !== reqId ||
                    compController.signal.aborted
                ) {
                    return
                }
                setComparison(result)
            } catch (err: unknown) {
                if (
                    !isMountedRef.current ||
                    sessionIdRef.current !== compareSessionId ||
                    comparisonRequestIdRef.current !== reqId ||
                    compController.signal.aborted ||
                    isAbortError(err)
                ) {
                    return
                }
                const raw =
                    err instanceof Error
                        ? err.message
                        : "The comparison request failed. Retry when both extractions are ready."
                setComparisonError(formatActionableError(raw))
            } finally {
                if (compareAbortControllerRef.current === compController) {
                    compareAbortControllerRef.current = null
                }
            }
        } finally {
            if (
                isMountedRef.current &&
                sessionIdRef.current === compareSessionId
            ) {
                setProcessingStep("idle")
            }
        }
    }

    const handleFocusEvidence = (imageId: string) => {
        const checkSide = (
            prod: ProductSideState,
            side: "left" | "right",
        ): boolean => {
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
                setInspectionState({
                    isOpen: true,
                    side,
                    index,
                })
                return true
            }
            return false
        }

        if (!checkSide(leftProduct, "left")) {
            checkSide(rightProduct, "right")
        }
    }

    return (
        <div className="min-h-full pb-8 text-neutral-900">
            {/* Topbar Header */}
            <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-2.5">
                        <Link
                            to={appRoutes.home}
                            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
                            aria-label="Back to Life Goods scan"
                        >
                            <BrandLockup compact />
                        </Link>
                        <Badge
                            variant="accent"
                            className="shrink-0 font-mono text-[11px]"
                        >
                            Compare Products
                        </Badge>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="shrink-0 text-xs font-semibold text-neutral-600 hover:text-neutral-950"
                    >
                        <Link to={appRoutes.home}>
                            <span className="hidden sm:inline">Return to </span>
                            Scan
                        </Link>
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
                {/* Header / Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl">
                            Compare Products
                        </h1>
                        <p className="mt-1 text-xs text-neutral-500">
                            Compare nutrition labels using photos · 1–6 JPEG or
                            PNG photos each
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

                {/* Product Panels */}
                <section
                    className="mt-6 grid grid-cols-1 items-start gap-6"
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
                        onSelectColumn={(colId) =>
                            handleSelectColumn("left", colId)
                        }
                        onFocusEvidence={handleFocusEvidence}
                        onInspectPhoto={(index) =>
                            setInspectionState({
                                isOpen: true,
                                side: "left",
                                index,
                            })
                        }
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
                        onSelectColumn={(colId) =>
                            handleSelectColumn("right", colId)
                        }
                        onFocusEvidence={handleFocusEvidence}
                        onInspectPhoto={(index) =>
                            setInspectionState({
                                isOpen: true,
                                side: "right",
                                index,
                            })
                        }
                    />
                </section>

                {/* Comparison Section */}
                <ComparisonSection
                    comparison={comparison}
                    comparisonStatus={comparisonStatus}
                    comparisonError={comparisonError}
                    isComparing={processingStep !== "idle"}
                    isReadyToCompare={isReadyToCompare}
                    leftProduct={leftProduct}
                    rightProduct={rightProduct}
                    compareButtonLabel={compareButtonLabel}
                    onCompare={() => {
                        void handleCompare()
                    }}
                    onFocusEvidence={handleFocusEvidence}
                />
            </main>

            {/* Photo Inspection Modal */}
            <PhotoInspectionModal
                isOpen={inspectionState.isOpen}
                onClose={() =>
                    setInspectionState((prev) => ({ ...prev, isOpen: false }))
                }
                photos={
                    inspectionState.side === "left"
                        ? leftProduct.photos
                        : rightProduct.photos
                }
                initialIndex={inspectionState.index}
                title={
                    inspectionState.side === "left"
                        ? leftProduct.title
                        : rightProduct.title
                }
            />
        </div>
    )
}
