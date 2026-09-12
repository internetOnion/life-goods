import {
    ArrowCounterClockwise,
    ArrowLeft,
    ArrowRight,
    Scales,
    X,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"

import { GlassButton as Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePageMetadata } from "@/lib/metadata"
import { cn } from "@/lib/utils"
import { useAppShellNavigation } from "@/ui/AppShellNavigation"

import {
    compareProducts,
    extractProductPhotos,
    PhotoComparisonApiError,
} from "./api"
import { ColumnSelectionModal } from "./ColumnSelectionModal"
import { ComparisonSection } from "./ComparisonSection"
import { CompareStepper } from "./CompareStepper"
import {
    displayBasisLabel,
    formatActionableError,
    formatPreparationLabel,
} from "./helpers"
import { PhotoInspectionModal } from "./PhotoInspectionModal"
import { ProductPhotoPanel } from "./ProductPhotoPanel"
import type {
    ComparisonRequest,
    ComparisonResponse,
    ProductPhoto,
    ProductSideState,
} from "./types"
import { MAX_PHOTOS_PER_PRODUCT } from "./types"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MiB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"]
type CompareSide = "left" | "right"
type CompareFlowPhase =
    "intro" | "capture" | "review" | "ready" | "processing" | "results"

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

function actionableRequestError(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : fallback
    const code = err instanceof PhotoComparisonApiError ? err.code : undefined
    return formatActionableError(message, code)
}

export type PhotoComparisonPageProps = {
    extractPhotos?: typeof extractProductPhotos
    compare?: typeof compareProducts
}

export function PhotoComparisonPage({
    extractPhotos = extractProductPhotos,
    compare = compareProducts,
}: PhotoComparisonPageProps = {}) {
    const { setPrimaryNavigationHidden } = useAppShellNavigation()

    usePageMetadata({
        title: "Compare Products",
        description: "Compare nutrition from label photos for two Products.",
    })

    const [leftProduct, setLeftProduct] = useState<ProductSideState>(() =>
        createInitialProduct("left", "Product A", "1"),
    )
    const [rightProduct, setRightProduct] = useState<ProductSideState>(() =>
        createInitialProduct("right", "Product B", "2"),
    )
    const [flowPhase, setFlowPhase] = useState<CompareFlowPhase>("intro")
    const [activeSide, setActiveSide] = useState<CompareSide>("left")
    const [comparison, setComparison] = useState<ComparisonResponse | null>(
        null,
    )
    const [processingStep, setProcessingStep] = useState<
        "idle" | "extracting_left" | "extracting_right" | "comparing"
    >("idle")
    const [comparisonError, setComparisonError] = useState<string | null>(null)

    const [columnModalSide, setColumnModalSide] = useState<
        "left" | "right" | null
    >(null)
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
    const uploadInputRefs = useRef<
        Record<CompareSide, HTMLInputElement | null>
    >({
        left: null,
        right: null,
    })
    const cameraInputRefs = useRef<
        Record<CompareSide, HTMLInputElement | null>
    >({
        left: null,
        right: null,
    })
    const leftProductRef = useRef<ProductSideState>(leftProduct)
    const rightProductRef = useRef<ProductSideState>(rightProduct)
    leftProductRef.current = leftProduct
    rightProductRef.current = rightProduct

    useEffect(() => {
        setPrimaryNavigationHidden(flowPhase !== "intro")

        return () => {
            setPrimaryNavigationHidden(false)
        }
    }, [flowPhase, setPrimaryNavigationHidden])

    const getProductForSide = (side: CompareSide) =>
        side === "left" ? leftProduct : rightProduct

    const handleStartProductCapture = () => {
        setActiveSide("left")
        setFlowPhase("capture")
    }

    const handleOpenLibrary = (side: CompareSide) => {
        setActiveSide(side)
        setFlowPhase("capture")
        uploadInputRefs.current[side]?.click()
    }

    const handleOpenDeviceCamera = (side: CompareSide) => {
        setActiveSide(side)
        setFlowPhase("capture")
        cameraInputRefs.current[side]?.click()
    }

    const handleContinueFromSide = (side: CompareSide) => {
        const product = getProductForSide(side)
        if (product.photos.length === 0) return

        if (side === "left") {
            setActiveSide("right")
            setFlowPhase(
                rightProductRef.current.photos.length > 0
                    ? "review"
                    : "capture",
            )
            return
        }

        setFlowPhase(comparison ? "results" : "ready")
    }

    const handleEditSide = (side: CompareSide) => {
        setActiveSide(side)
        setFlowPhase("review")
    }

    const handleBackFromSide = (side: CompareSide) => {
        if (side === "right") {
            setActiveSide("left")
            setFlowPhase("review")
            return
        }

        setFlowPhase(comparison ? "results" : "intro")
    }

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
            return "Comparing nutrition…"
        }
        if (comparison) {
            return "Based on Photo Evidence."
        }
        if (
            leftProduct.photos.length === 0 ||
            rightProduct.photos.length === 0
        ) {
            return "Add a photo for each Product."
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
        return "Ready to compare."
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

    const handleCancelProcessing = () => {
        sessionIdRef.current += 1
        abortInFlightExtraction()
        abortInFlightComparison()
        comparisonRequestIdRef.current += 1
        setProcessingStep("idle")
        setFlowPhase(
            leftProductRef.current.photos.length > 0 &&
                rightProductRef.current.photos.length > 0
                ? "ready"
                : "review",
        )
        setLeftProduct((prev) => ({ ...prev, loading: false }))
        setRightProduct((prev) => ({ ...prev, loading: false }))
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
        setColumnModalSide(null)
        setHighlightedPhotoId(null)
        setActiveSide("left")
        setFlowPhase("intro")
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

        const hasAcceptedFile = files.some(
            (file) =>
                ALLOWED_IMAGE_TYPES.includes(file.type) &&
                file.size <= MAX_FILE_SIZE_BYTES,
        )
        if (hasAcceptedFile) {
            setActiveSide(side)
            setFlowPhase("review")
        }

        const setProduct = side === "left" ? setLeftProduct : setRightProduct

        setProduct((prev) => {
            const available = MAX_PHOTOS_PER_PRODUCT - prev.photos.length
            if (available <= 0) {
                return {
                    ...prev,
                    error: `Maximum of ${MAX_PHOTOS_PER_PRODUCT} photos per Product reached.`,
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

        setColumnModalSide((current) => {
            if (current === side) {
                const otherSide = side === "left" ? "right" : "left"
                const otherExt =
                    side === "left"
                        ? rightProductRef.current.extraction
                        : leftProductRef.current.extraction
                const otherColId =
                    side === "left"
                        ? rightProductRef.current.selectedColumnId
                        : leftProductRef.current.selectedColumnId
                if (
                    otherExt &&
                    (otherExt.nutrition_columns?.length ?? 0) > 1 &&
                    !otherColId
                ) {
                    return otherSide
                }
                return null
            }
            return current
        })

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
                setFlowPhase("processing")
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
                    setFlowPhase("results")
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
                    setComparisonError(
                        actionableRequestError(
                            err,
                            "The comparison request failed.",
                        ),
                    )
                    setFlowPhase("ready")
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

        setFlowPhase("processing")
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
                    const message = actionableRequestError(
                        err,
                        "The extraction request failed. Check the provider and retry.",
                    )
                    setLeftProduct((prev) => {
                        if (prev.revision !== initialLeftRevision) return prev
                        return {
                            ...prev,
                            loading: false,
                            error: message,
                            retry: true,
                        }
                    })
                    setFlowPhase("ready")
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
                    const message = actionableRequestError(
                        err,
                        "The extraction request failed. Check the provider and retry.",
                    )
                    setRightProduct((prev) => {
                        if (prev.revision !== rightRevision) return prev
                        return {
                            ...prev,
                            loading: false,
                            error: message,
                            retry: true,
                        }
                    })
                    setFlowPhase("ready")
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
                setColumnModalSide("left")
                setFlowPhase("ready")
                return
            }
            if ((rightExt.nutrition_columns?.length ?? 0) > 1 && !rightColId) {
                setColumnModalSide("right")
                setFlowPhase("ready")
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
                setFlowPhase("results")
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
                setComparisonError(
                    actionableRequestError(
                        err,
                        "The comparison request failed. Retry when both extractions are ready.",
                    ),
                )
                setFlowPhase("ready")
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

    const currentCompareStep: 1 | 2 | 3 =
        flowPhase === "ready" ||
        flowPhase === "processing" ||
        flowPhase === "results"
            ? 3
            : activeSide === "left"
              ? 1
              : 2

    const handleStepChange = (step: 1 | 2 | 3) => {
        if (processingStep !== "idle") return

        if (step === 1) {
            if (comparison) {
                handleEditSide("left")
                return
            }
            setActiveSide("left")
            setFlowPhase(leftProduct.photos.length > 0 ? "review" : "capture")
            return
        }

        if (step === 2) {
            if (comparison) {
                handleEditSide("right")
                return
            }
            setActiveSide("right")
            setFlowPhase(rightProduct.photos.length > 0 ? "review" : "capture")
            return
        }

        if (comparison) {
            setFlowPhase("results")
            return
        }

        if (isReadyToCompare) {
            setFlowPhase("ready")
        }
    }

    return (
        <div className="min-h-full pb-8 text-neutral-900">
            {/* Main Content */}
            <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-32 sm:px-6 sm:py-7 sm:pb-12">
                {/* Header / Toolbar */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl">
                                Compare Products
                            </h1>
                            <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                                Compare nutrition from two label photos.
                            </p>
                        </div>
                        {flowPhase !== "intro" && (
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleResetSession}
                                aria-label="Reset session"
                                title="Reset session"
                                className="size-10 shrink-0 rounded-xl text-neutral-700 hover:text-neutral-900 sm:size-11"
                            >
                                <ArrowCounterClockwise
                                    size={18}
                                    weight="bold"
                                />
                            </Button>
                        )}
                    </div>

                    {(processingStep !== "idle" ||
                        leftProduct.photos.length > 0 ||
                        rightProduct.photos.length > 0) && (
                        <div className="flex flex-wrap items-center gap-2">
                            {processingStep !== "idle" && (
                                <>
                                    {!getProductForSide(activeSide).loading && (
                                        <p
                                            className="text-primary-700 text-xs font-semibold"
                                            role="status"
                                        >
                                            {comparisonStatus}
                                        </p>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCancelProcessing}
                                        className="gap-1.5 font-semibold text-neutral-700 hover:text-neutral-900"
                                    >
                                        <X size={15} weight="bold" />
                                        <span>Cancel</span>
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <Input
                    ref={(element) => {
                        uploadInputRefs.current.left = element
                    }}
                    id="upload-photos-left"
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    tabIndex={-1}
                    aria-label="Choose photos for Product A"
                    className="sr-only"
                    onChange={(event) => {
                        if (event.target.files?.length) {
                            handleAddFiles(
                                "left",
                                Array.from(event.target.files),
                            )
                        }
                        event.target.value = ""
                    }}
                />
                <Input
                    ref={(element) => {
                        uploadInputRefs.current.right = element
                    }}
                    id="upload-photos-right"
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    tabIndex={-1}
                    aria-label="Choose photos for Product B"
                    className="sr-only"
                    onChange={(event) => {
                        if (event.target.files?.length) {
                            handleAddFiles(
                                "right",
                                Array.from(event.target.files),
                            )
                        }
                        event.target.value = ""
                    }}
                />
                <Input
                    ref={(element) => {
                        cameraInputRefs.current.left = element
                    }}
                    id="camera-photos-left"
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    tabIndex={-1}
                    aria-label="Take a photo for Product A"
                    className="sr-only"
                    onChange={(event) => {
                        if (event.target.files?.length) {
                            handleAddFiles(
                                "left",
                                Array.from(event.target.files),
                            )
                        }
                        event.target.value = ""
                    }}
                />
                <Input
                    ref={(element) => {
                        cameraInputRefs.current.right = element
                    }}
                    id="camera-photos-right"
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    tabIndex={-1}
                    aria-label="Take a photo for Product B"
                    className="sr-only"
                    onChange={(event) => {
                        if (event.target.files?.length) {
                            handleAddFiles(
                                "right",
                                Array.from(event.target.files),
                            )
                        }
                        event.target.value = ""
                    }}
                />

                {(["left", "right"] as const)
                    .filter((side) => side !== activeSide)
                    .map((side) =>
                        getProductForSide(side).photos.map((photo, index) => (
                            <Input
                                key={`${side}-${photo.localId}`}
                                id={`replace-file-${side}-${index}`}
                                type="file"
                                accept="image/jpeg,image/png"
                                tabIndex={-1}
                                aria-label={`Replace ${side === "left" ? "Product A" : "Product B"} photo ${index + 1}`}
                                className="sr-only"
                                onChange={(event) => {
                                    const file = event.target.files?.[0]
                                    if (file) {
                                        handleReplacePhoto(side, index, file)
                                    }
                                    event.target.value = ""
                                }}
                            />
                        )),
                    )}

                {flowPhase !== "intro" && (
                    <div className="mt-3 mb-3 sm:mt-4 sm:mb-4">
                        <CompareStepper
                            currentStep={currentCompareStep}
                            onStepChange={handleStepChange}
                            productACount={leftProduct.photos.length}
                            productBCount={rightProduct.photos.length}
                            isReadyToCompare={isReadyToCompare}
                            hasComparison={Boolean(comparison)}
                            disabled={processingStep !== "idle"}
                        />
                    </div>
                )}

                <div
                    className={
                        flowPhase === "intro"
                            ? "mt-5 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-xs sm:mt-6 sm:p-6"
                            : ""
                    }
                >
                    {flowPhase === "intro" ? (
                        <section
                            className=""
                            aria-labelledby="compare-intro-heading"
                        >
                            <div className="flex items-start gap-3">
                                <span className="bg-primary-100 text-primary-800 flex size-10 shrink-0 items-center justify-center rounded-xl">
                                    <Scales size={25} weight="bold" />
                                </span>
                                <div className="min-w-0">
                                    <h2
                                        id="compare-intro-heading"
                                        className="text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl"
                                    >
                                        Compare two Products
                                    </h2>
                                    <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
                                        Add a clear Nutrition Facts photo for
                                        each Product. You can take a photo or
                                        choose one from your library.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    onClick={handleStartProductCapture}
                                    className="shadow-action-lift h-12 gap-2 rounded-xl px-5 font-extrabold"
                                >
                                    <ArrowRight size={19} weight="bold" />
                                    <span>Get started</span>
                                </Button>
                            </div>

                            {(leftProduct.error || rightProduct.error) && (
                                <p
                                    className="border-error-200 bg-error-50 text-error-800 mt-4 rounded-xl border p-3 text-sm font-medium"
                                    role="alert"
                                >
                                    {leftProduct.error || rightProduct.error}
                                </p>
                            )}
                        </section>
                    ) : flowPhase !== "results" || !comparison ? (
                        <section
                            aria-label="Guided Product capture"
                            className="mt-3 sm:mt-4"
                        >
                            <ProductPhotoPanel
                                product={
                                    activeSide === "left"
                                        ? leftProduct
                                        : rightProduct
                                }
                                highlightedPhotoId={highlightedPhotoId}
                                previewRefs={previewRefs}
                                onTitleChange={(title) =>
                                    handleTitleChange(activeSide, title)
                                }
                                onAddFiles={(files) =>
                                    handleAddFiles(activeSide, files)
                                }
                                onRemovePhoto={(index) =>
                                    handleRemovePhoto(activeSide, index)
                                }
                                onReplacePhoto={(index, file) =>
                                    handleReplacePhoto(activeSide, index, file)
                                }
                                onClearPhotos={() =>
                                    handleClearPhotos(activeSide)
                                }
                                onOpenCamera={() =>
                                    handleOpenDeviceCamera(activeSide)
                                }
                                onOpenLibrary={() =>
                                    handleOpenLibrary(activeSide)
                                }
                                onSelectColumn={(colId) =>
                                    handleSelectColumn(activeSide, colId)
                                }
                                onFocusEvidence={handleFocusEvidence}
                                onInspectPhoto={(index) =>
                                    setInspectionState({
                                        isOpen: true,
                                        side: activeSide,
                                        index,
                                    })
                                }
                            />

                            {!comparison &&
                                leftProduct.extraction &&
                                rightProduct.extraction &&
                                ((leftProduct.extraction.nutrition_columns
                                    ?.length ?? 0) > 1 ||
                                    (rightProduct.extraction.nutrition_columns
                                        ?.length ?? 0) > 1) && (
                                    <section
                                        className="mt-3 border-y border-neutral-200/80 py-3"
                                        aria-labelledby="compare-basis-heading"
                                    >
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                                            <h3
                                                id="compare-basis-heading"
                                                className="text-sm font-extrabold text-neutral-900"
                                            >
                                                Choose the nutrition basis
                                            </h3>
                                            <p className="text-xs text-neutral-500">
                                                You can change this while a
                                                comparison is in progress.
                                            </p>
                                        </div>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                            {(["left", "right"] as const).map(
                                                (side) => {
                                                    const product =
                                                        getProductForSide(side)
                                                    const columns =
                                                        product.extraction
                                                            ?.nutrition_columns ??
                                                        []
                                                    if (columns.length <= 1)
                                                        return null

                                                    return (
                                                        <div
                                                            key={side}
                                                            className="rounded-lg border border-neutral-200/80 bg-neutral-50/60 p-3"
                                                        >
                                                            <p className="text-xs font-bold text-neutral-700">
                                                                {product.title}
                                                            </p>
                                                            <div className="mt-2 flex flex-col gap-2">
                                                                {columns.map(
                                                                    (
                                                                        column,
                                                                    ) => {
                                                                        const isSelected =
                                                                            product.selectedColumnId ===
                                                                            column.column_id
                                                                        return (
                                                                            <div
                                                                                key={
                                                                                    column.column_id
                                                                                }
                                                                                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2"
                                                                            >
                                                                                <div className="min-w-0">
                                                                                    <p className="truncate text-xs font-semibold text-neutral-800">
                                                                                        {column.label ||
                                                                                            "Nutrition column"}
                                                                                    </p>
                                                                                    <p className="mt-0.5 text-xs text-neutral-500">
                                                                                        {displayBasisLabel(
                                                                                            column.basis,
                                                                                        )}{" "}
                                                                                        ·{" "}
                                                                                        {formatPreparationLabel(
                                                                                            column.preparation_state,
                                                                                        )}
                                                                                    </p>
                                                                                </div>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant={
                                                                                        isSelected
                                                                                            ? "default"
                                                                                            : "outline"
                                                                                    }
                                                                                    size="sm"
                                                                                    onClick={() =>
                                                                                        handleSelectColumn(
                                                                                            side,
                                                                                            column.column_id,
                                                                                        )
                                                                                    }
                                                                                    className="h-8 shrink-0 text-xs font-semibold"
                                                                                >
                                                                                    {isSelected
                                                                                        ? "Selected"
                                                                                        : "Select column"}
                                                                                </Button>
                                                                            </div>
                                                                        )
                                                                    },
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                },
                                            )}
                                        </div>
                                    </section>
                                )}

                            {(flowPhase === "capture" ||
                                flowPhase === "review") && (
                                <div
                                    role="group"
                                    aria-label="Photo capture navigation"
                                    data-glass-surface=""
                                    className="glass-surface fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 backdrop-blur-xl"
                                >
                                    {activeSide === "left" && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            aria-label={
                                                comparison
                                                    ? "Back to comparison results"
                                                    : "Back to start"
                                            }
                                            disabled={processingStep !== "idle"}
                                            onClick={() =>
                                                handleBackFromSide("left")
                                            }
                                            className="h-11 gap-1.5 rounded-full px-4 text-sm font-bold text-neutral-700 hover:bg-white/70 hover:text-neutral-950"
                                        >
                                            <ArrowLeft
                                                size={17}
                                                weight="bold"
                                            />
                                            <span>Back</span>
                                        </Button>
                                    )}
                                    {activeSide === "right" && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            aria-label="Back to Product A"
                                            onClick={() =>
                                                handleBackFromSide("right")
                                            }
                                            className="h-11 gap-1.5 rounded-full px-4 text-sm font-bold text-neutral-700 hover:bg-white/70 hover:text-neutral-950"
                                        >
                                            <ArrowLeft
                                                size={17}
                                                weight="bold"
                                            />
                                            <span>Back</span>
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        aria-label={
                                            activeSide === "left"
                                                ? "Continue to Product B"
                                                : comparison
                                                  ? "Return to comparison results"
                                                  : "Review both Products"
                                        }
                                        disabled={
                                            processingStep !== "idle" ||
                                            (activeSide === "left"
                                                ? leftProduct.photos.length ===
                                                  0
                                                : rightProduct.photos.length ===
                                                  0)
                                        }
                                        onClick={() =>
                                            handleContinueFromSide(activeSide)
                                        }
                                        className="shadow-action-lift bg-primary-600 hover:bg-primary-700 h-11 gap-1.5 rounded-full px-4 text-sm font-extrabold"
                                    >
                                        <span>
                                            {activeSide === "left"
                                                ? "Next"
                                                : comparison
                                                  ? "Results"
                                                  : "Review"}
                                        </span>
                                        <ArrowRight size={17} weight="bold" />
                                    </Button>
                                </div>
                            )}
                        </section>
                    ) : null}

                    {!comparison &&
                        (flowPhase === "ready" ||
                            (flowPhase === "processing" &&
                                processingStep === "idle")) && (
                            <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p
                                        className={cn(
                                            "text-sm leading-relaxed",
                                            comparisonError
                                                ? "text-error-700 font-bold"
                                                : isReadyToCompare
                                                  ? "font-bold text-neutral-900"
                                                  : "font-medium text-neutral-700",
                                        )}
                                        role={
                                            comparisonError ? "alert" : "status"
                                        }
                                    >
                                        {comparisonStatus}
                                    </p>
                                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                                        Photos are processed by the configured
                                        AI provider and are not retained by Life
                                        Goods.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="default"
                                    size="default"
                                    disabled={
                                        !isReadyToCompare ||
                                        processingStep !== "idle"
                                    }
                                    onClick={() => void handleCompare()}
                                    className="shadow-action-lift h-11 gap-2 self-start rounded-xl px-5 font-extrabold sm:self-auto"
                                >
                                    <Scales size={18} weight="bold" />
                                    <span>{compareButtonLabel}</span>
                                </Button>
                            </div>
                        )}
                </div>

                {/* Results panel */}
                {comparison && flowPhase === "results" && (
                    <div
                        id="compare-step-panel-3"
                        role="region"
                        aria-label="Comparison results"
                        className="mt-3 flex flex-col gap-4 sm:mt-4"
                    >
                        {/* Multi-column basis selector in Step 3 */}
                        {((leftProduct.extraction?.nutrition_columns?.length ??
                            0) > 1 ||
                            (rightProduct.extraction?.nutrition_columns
                                ?.length ?? 0) > 1) && (
                            <section
                                className="border-y border-neutral-200/80 py-3"
                                aria-labelledby="results-basis-heading"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h3
                                        id="results-basis-heading"
                                        className="text-sm font-bold text-neutral-900"
                                    >
                                        Nutrition basis
                                    </h3>
                                    <p className="text-xs text-neutral-500">
                                        Switch the column used for comparison.
                                    </p>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                                    {(leftProduct.extraction?.nutrition_columns
                                        ?.length ?? 0) > 1 && (
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <span className="text-xs font-semibold text-neutral-700">
                                                {leftProduct.title}:
                                            </span>
                                            {leftProduct.extraction?.nutrition_columns?.map(
                                                (col) => {
                                                    const isSelected =
                                                        leftProduct.selectedColumnId ===
                                                        col.column_id
                                                    return (
                                                        <Button
                                                            key={col.column_id}
                                                            type="button"
                                                            variant={
                                                                isSelected
                                                                    ? "default"
                                                                    : "outline"
                                                            }
                                                            size="sm"
                                                            onClick={() =>
                                                                handleSelectColumn(
                                                                    "left",
                                                                    col.column_id,
                                                                )
                                                            }
                                                            className="h-8 text-xs font-semibold"
                                                        >
                                                            {col.label ||
                                                                "Nutrition column"}
                                                        </Button>
                                                    )
                                                },
                                            )}
                                        </div>
                                    )}
                                    {(rightProduct.extraction?.nutrition_columns
                                        ?.length ?? 0) > 1 && (
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <span className="text-xs font-semibold text-neutral-700">
                                                {rightProduct.title}:
                                            </span>
                                            {rightProduct.extraction?.nutrition_columns?.map(
                                                (col) => {
                                                    const isSelected =
                                                        rightProduct.selectedColumnId ===
                                                        col.column_id
                                                    return (
                                                        <Button
                                                            key={col.column_id}
                                                            type="button"
                                                            variant={
                                                                isSelected
                                                                    ? "default"
                                                                    : "outline"
                                                            }
                                                            size="sm"
                                                            onClick={() =>
                                                                handleSelectColumn(
                                                                    "right",
                                                                    col.column_id,
                                                                )
                                                            }
                                                            className="h-8 text-xs font-semibold"
                                                        >
                                                            {col.label ||
                                                                "Nutrition column"}
                                                        </Button>
                                                    )
                                                },
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

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
                    </div>
                )}
            </main>

            {/* Column Selection Modal */}
            <ColumnSelectionModal
                isOpen={columnModalSide !== null}
                onClose={() => setColumnModalSide(null)}
                product={
                    columnModalSide === "left"
                        ? leftProduct
                        : columnModalSide === "right"
                          ? rightProduct
                          : null
                }
                otherProductTitle={
                    columnModalSide === "left"
                        ? rightProduct.title
                        : leftProduct.title
                }
                onSelectColumn={(colId) => {
                    if (columnModalSide) {
                        handleSelectColumn(columnModalSide, colId)
                    }
                }}
                stepIndicator={
                    columnModalSide === "left" &&
                    rightProduct.extraction &&
                    (rightProduct.extraction.nutrition_columns?.length ?? 0) >
                        1 &&
                    !rightProduct.selectedColumnId
                        ? "Step 1 of 2"
                        : columnModalSide === "right" &&
                            leftProduct.extraction &&
                            (leftProduct.extraction.nutrition_columns?.length ??
                                0) > 1 &&
                            !leftProduct.selectedColumnId
                          ? "Step 2 of 2"
                          : undefined
                }
            />

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
