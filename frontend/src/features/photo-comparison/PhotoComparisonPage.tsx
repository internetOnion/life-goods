import {
    ArrowCounterClockwise,
    ArrowLeft,
    ArrowRight,
    Scales,
    WarningCircle,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { GlassButton as Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/i18n/locale"
import { usePageMetadata } from "@/lib/metadata"
import { useAppShellNavigation } from "@/ui/AppShellNavigation"

import {
    compareProducts,
    extractProductPhotos,
    PhotoComparisonApiError,
} from "./api"
import { ComparisonProcessingSheet } from "./ComparisonProcessingSheet"
import { ComparisonSection } from "./ComparisonSection"
import { CompareStepper } from "./CompareStepper"
import {
    MAX_PHOTO_FILE_SIZE_BYTES,
    PHOTO_INPUT_ACCEPT,
    formatActionableError,
    isAcceptedPhotoFile,
    isHeicFile,
    isSupportedImageFile,
    pickDefaultColumnId,
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
import { useCompareTranslation } from "./translations"

type CompareSide = "left" | "right"
type CompareFlowPhase =
    "intro" | "capture" | "review" | "processing" | "results"

function createInitialProduct(
    id: "left" | "right",
    title: string,
    number: "1" | "2",
): ProductSideState {
    return {
        id,
        title,
        titleSource: "default",
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

function hasUnusablePhoto(product: ProductSideState): boolean {
    return product.photos.some((photo) => photo.previewError)
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

function actionableRequestError(
    err: unknown,
    fallback: string,
    locale: "en" | "km",
): string {
    const message = err instanceof Error ? err.message : fallback
    const code = err instanceof PhotoComparisonApiError ? err.code : undefined
    return formatActionableError(message, code, locale)
}

export type PhotoComparisonPageProps = {
    extractPhotos?: typeof extractProductPhotos
    compare?: typeof compareProducts
}

export function PhotoComparisonPage({
    extractPhotos = extractProductPhotos,
    compare = compareProducts,
}: PhotoComparisonPageProps = {}) {
    const { setBottomDockVisible, setPrimaryNavigationHidden } =
        useAppShellNavigation()
    const { locale } = useLocale()
    const { t } = useCompareTranslation()

    usePageMetadata({
        title: t("pageTitle"),
        description: t("pageDescription"),
    })

    const [leftProduct, setLeftProduct] = useState<ProductSideState>(() =>
        createInitialProduct("left", t("productA"), "1"),
    )
    const [rightProduct, setRightProduct] = useState<ProductSideState>(() =>
        createInitialProduct("right", t("productB"), "2"),
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
    const [comparisonNotice, setComparisonNotice] = useState<string | null>(
        null,
    )

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
    const lastFocusTargetRef = useRef<string | null>(null)

    useEffect(() => {
        setLeftProduct((product) =>
            product.titleSource === "default"
                ? { ...product, title: t("productA") }
                : product,
        )
        setRightProduct((product) =>
            product.titleSource === "default"
                ? { ...product, title: t("productB") }
                : product,
        )
    }, [locale, t])

    useEffect(() => {
        const targetId =
            flowPhase === "intro"
                ? "compare-intro-heading"
                : flowPhase === "results"
                  ? "compare-results-heading"
                  : flowPhase === "capture" || flowPhase === "review"
                    ? `panel-heading-${activeSide}`
                    : null
        if (!targetId || targetId === lastFocusTargetRef.current) return
        lastFocusTargetRef.current = targetId
        window.requestAnimationFrame(() => {
            document.getElementById(targetId)?.focus()
        })
    }, [activeSide, flowPhase])

    useEffect(() => {
        setPrimaryNavigationHidden(flowPhase !== "intro")
        setBottomDockVisible(flowPhase === "capture" || flowPhase === "review")

        return () => {
            setBottomDockVisible(false)
            setPrimaryNavigationHidden(false)
        }
    }, [flowPhase, setBottomDockVisible, setPrimaryNavigationHidden])

    useEffect(() => {
        if (
            flowPhase === "results" &&
            typeof window !== "undefined" &&
            typeof window.scrollTo === "function"
        ) {
            window.scrollTo(0, 0)
        }
    }, [flowPhase])

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
        if (product.photos.length === 0 || hasUnusablePhoto(product)) return

        if (side === "left") {
            setActiveSide("right")
            setFlowPhase(
                rightProductRef.current.photos.length > 0
                    ? "review"
                    : "capture",
            )
            return
        }

        if (comparison) {
            setFlowPhase("results")
            return
        }

        void handleCompare()
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

        handleBackToStart()
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
            rightProduct.photos.length === 0 ||
            hasUnusablePhoto(leftProduct) ||
            hasUnusablePhoto(rightProduct)
        ) {
            return false
        }
        return true
    }, [leftProduct, rightProduct])

    const compareButtonLabel = useMemo(() => {
        if (processingStep === "extracting_left") {
            return t("readingProduct", { product: leftProduct.title })
        }
        if (processingStep === "extracting_right") {
            return t("readingProduct", { product: rightProduct.title })
        }
        if (processingStep === "comparing") {
            return t("comparing")
        }
        if (comparisonError || leftProduct.retry || rightProduct.retry) {
            return t("retryComparison")
        }
        return t("compareProducts")
    }, [
        processingStep,
        leftProduct.title,
        rightProduct.title,
        leftProduct.retry,
        rightProduct.retry,
        comparisonError,
        t,
    ])

    const comparisonStatus = useMemo(() => {
        if (comparisonError) return comparisonError
        if (processingStep === "extracting_left") {
            return t("readingProductPhotos", { product: leftProduct.title })
        }
        if (processingStep === "extracting_right") {
            return t("readingProductPhotos", { product: rightProduct.title })
        }
        if (processingStep === "comparing") {
            return t("comparingNutrition")
        }
        if (comparison) {
            return t("basedOnEvidence")
        }
        if (
            leftProduct.photos.length === 0 ||
            rightProduct.photos.length === 0
        ) {
            return t("addEachProduct")
        }
        if (hasUnusablePhoto(leftProduct) || hasUnusablePhoto(rightProduct)) {
            return t("photoPreviewUnavailable")
        }
        return t("readyToCompare")
    }, [
        comparison,
        comparisonError,
        processingStep,
        leftProduct,
        rightProduct,
        t,
    ])

    const invalidateComparison = () => {
        abortInFlightComparison()
        comparisonRequestIdRef.current += 1
        setComparison(null)
        setComparisonError(null)
        setComparisonNotice(null)
    }

    const resetSideProcessing = (side: "left" | "right") => {
        abortInFlightExtraction(side)
        invalidateComparison()
        setFlowPhase("review")
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
        setFlowPhase("review")
        setComparisonNotice(t("comparisonCancelled"))
        setLeftProduct((prev) => ({ ...prev, loading: false }))
        setRightProduct((prev) => ({ ...prev, loading: false }))
    }

    const clearSession = (destination: "intro" | "capture") => {
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
        setLeftProduct(createInitialProduct("left", t("productA"), "1"))
        setRightProduct(createInitialProduct("right", t("productB"), "2"))
        setInspectionState({ isOpen: false, side: "left", index: 0 })
        setHighlightedPhotoId(null)
        setActiveSide("left")
        previewRefs.current = {}
        lastFocusTargetRef.current = null
        setFlowPhase(destination)
        setProcessingStep("idle")
        invalidateComparison()
        window.requestAnimationFrame(() => {
            document
                .getElementById(
                    destination === "intro"
                        ? "compare-intro-heading"
                        : "panel-heading-left",
                )
                ?.focus()
        })
    }

    const handleResetSession = () => clearSession("capture")
    const handleBackToStart = () => clearSession("intro")

    const handleTitleChange = (
        side: "left" | "right",
        title: string,
        titleSource: ProductSideState["titleSource"] = "shopper",
    ) => {
        if (side === "left") {
            setLeftProduct((prev) => ({
                ...prev,
                title,
                titleSource,
            }))
        } else {
            setRightProduct((prev) => ({
                ...prev,
                title,
                titleSource,
            }))
        }
    }

    const handlePhotoPreviewError = (side: "left" | "right", index: number) => {
        resetSideProcessing(side)

        const setProduct = side === "left" ? setLeftProduct : setRightProduct
        setProduct((prev) => {
            const photo = prev.photos[index]
            if (!photo || photo.previewError || photo.previewUnsupported) {
                return prev
            }

            // This browser cannot render HEIC; the backend still reads the photo.
            if (isHeicFile(photo.file)) {
                return {
                    ...prev,
                    photos: prev.photos.map((item, itemIndex) =>
                        itemIndex === index
                            ? { ...item, previewUnsupported: true }
                            : item,
                    ),
                }
            }

            return {
                ...prev,
                photos: prev.photos.map((item, itemIndex) =>
                    itemIndex === index
                        ? { ...item, previewError: true }
                        : item,
                ),
                extraction: null,
                selectedColumnId: null,
                error: t("photoPreviewUnavailable"),
                retry: false,
                loading: false,
                revision: prev.revision + 1,
            }
        })
    }

    const handleAddFiles = (side: "left" | "right", files: File[]) => {
        resetSideProcessing(side)

        const hasAcceptedFile = files.some(isAcceptedPhotoFile)
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
                    error: t("maxPhotos", {
                        count: MAX_PHOTOS_PER_PRODUCT,
                    }),
                }
            }

            const validationErrors: string[] = []
            const oversizedFiles = files.filter(
                (f) => f.size > MAX_PHOTO_FILE_SIZE_BYTES,
            )
            const invalidTypeFiles = files.filter(
                (f) => !isSupportedImageFile(f),
            )

            if (invalidTypeFiles.length > 0) {
                validationErrors.push(t("unsupportedFormat"))
            }
            if (oversizedFiles.length > 0) {
                validationErrors.push(
                    t("fileTooLarge", {
                        files: oversizedFiles.map((f) => f.name).join(", "),
                    }),
                )
            }

            const validFiles = files
                .filter(isAcceptedPhotoFile)
                .slice(0, available)

            if (validFiles.length === 0) {
                return {
                    ...prev,
                    error: validationErrors.join(" ") || t("noValidImages"),
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

        if (!isSupportedImageFile(file)) {
            setProduct((prev) => ({
                ...prev,
                error: t("unsupportedFormat"),
            }))
            return
        }

        if (file.size > MAX_PHOTO_FILE_SIZE_BYTES) {
            setProduct((prev) => ({
                ...prev,
                error: t("fileTooLarge", { files: file.name }),
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

    const handleCompare = async () => {
        if (
            leftProduct.photos.length === 0 ||
            rightProduct.photos.length === 0 ||
            hasUnusablePhoto(leftProduct) ||
            hasUnusablePhoto(rightProduct) ||
            processingStep !== "idle"
        ) {
            return
        }

        setFlowPhase("processing")
        setComparisonError(null)
        setComparisonNotice(null)
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
                    const defaultColId = pickDefaultColumnId(
                        ext.nutrition_columns,
                    )

                    let updatedTitle = leftProductRef.current.title
                    let updatedTitleSource = leftProductRef.current.titleSource
                    if (updatedTitleSource === "default") {
                        const brand = ext.identity?.brand?.value_text?.trim()
                        const name = ext.identity?.name?.value_text?.trim()
                        const detected = [brand, name].filter(Boolean).join(" ")
                        if (detected) {
                            updatedTitle = detected
                            updatedTitleSource = "photo_evidence"
                        }
                    }

                    leftProductRef.current = {
                        ...leftProductRef.current,
                        loading: false,
                        extraction: ext,
                        selectedColumnId: defaultColId,
                        title: updatedTitle,
                        titleSource: updatedTitleSource,
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
                            titleSource: updatedTitleSource,
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
                        t("extractionFailed"),
                        locale,
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
                    // Only the active side's panel is rendered; show the failure where it happened.
                    setActiveSide("left")
                    setFlowPhase("review")
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
                    const defaultColId = pickDefaultColumnId(
                        ext.nutrition_columns,
                    )

                    let updatedTitle = rightProductRef.current.title
                    let updatedTitleSource = rightProductRef.current.titleSource
                    if (updatedTitleSource === "default") {
                        const brand = ext.identity?.brand?.value_text?.trim()
                        const name = ext.identity?.name?.value_text?.trim()
                        const detected = [brand, name].filter(Boolean).join(" ")
                        if (detected) {
                            updatedTitle = detected
                            updatedTitleSource = "photo_evidence"
                        }
                    }

                    rightProductRef.current = {
                        ...rightProductRef.current,
                        loading: false,
                        extraction: ext,
                        selectedColumnId: defaultColId,
                        title: updatedTitle,
                        titleSource: updatedTitleSource,
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
                            titleSource: updatedTitleSource,
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
                        t("extractionFailed"),
                        locale,
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
                    setActiveSide("right")
                    setFlowPhase("review")
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
                pickDefaultColumnId(leftExt?.nutrition_columns)

            const rightColId =
                rightProductRef.current.selectedColumnId ||
                pickDefaultColumnId(rightExt?.nutrition_columns)

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
                    actionableRequestError(err, t("comparisonFailed"), locale),
                )
                setFlowPhase("review")
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

    const isResultsPage = Boolean(comparison) && flowPhase === "results"

    const currentCompareStep: 1 | 2 = activeSide === "left" ? 1 : 2
    const inactiveSideProduct =
        activeSide === "left" ? rightProduct : leftProduct
    // A failed extraction on the other Product is otherwise invisible from this panel.
    const inactiveSideError =
        inactiveSideProduct.retry && inactiveSideProduct.error !== ""

    const handleStepChange = (step: 1 | 2) => {
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

        if (comparison) {
            handleEditSide("right")
            return
        }
        setActiveSide("right")
        setFlowPhase(rightProduct.photos.length > 0 ? "review" : "capture")
    }

    return (
        <div
            className="min-h-full pb-8 text-neutral-900"
            lang={locale === "km" ? "km" : "en"}
        >
            <div
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {comparisonError || leftProduct.error || rightProduct.error
                    ? ""
                    : comparisonStatus
                      ? `${t("statusPrefix")}: ${comparisonStatus}`
                      : ""}
            </div>
            {/* Main Content */}
            <main
                aria-busy={processingStep !== "idle"}
                className="page-rail pb-32 sm:px-6 sm:pt-12 sm:pb-12"
            >
                {/* Header / Toolbar */}
                {isResultsPage ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEditSide(activeSide)}
                            className="gap-1.5 font-semibold text-neutral-700 hover:text-neutral-900"
                        >
                            <ArrowLeft size={17} weight="bold" />
                            <span>{t("editProducts")}</span>
                        </Button>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleResetSession}
                                aria-label={t("resetSession")}
                                title={t("resetSession")}
                                className="size-11 shrink-0 rounded-xl text-neutral-700 hover:text-neutral-900"
                            >
                                <ArrowCounterClockwise
                                    size={18}
                                    weight="bold"
                                />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-neutral-950">
                                    {t("pageTitle")}
                                </h1>
                                <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                                    {t("pageSubtitle")}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {flowPhase !== "intro" &&
                                    flowPhase !== "processing" && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={handleResetSession}
                                            aria-label={t("resetSession")}
                                            title={t("resetSession")}
                                            className="size-11 shrink-0 rounded-xl text-neutral-700 hover:text-neutral-900"
                                        >
                                            <ArrowCounterClockwise
                                                size={18}
                                                weight="bold"
                                            />
                                        </Button>
                                    )}
                            </div>
                        </div>
                    </div>
                )}

                <Input
                    ref={(element) => {
                        uploadInputRefs.current.left = element
                    }}
                    id="upload-photos-left"
                    type="file"
                    accept={PHOTO_INPUT_ACCEPT}
                    multiple
                    tabIndex={-1}
                    aria-label={t("choosePhotosA")}
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
                    accept={PHOTO_INPUT_ACCEPT}
                    multiple
                    tabIndex={-1}
                    aria-label={t("choosePhotosB")}
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
                    accept={PHOTO_INPUT_ACCEPT}
                    capture="environment"
                    tabIndex={-1}
                    aria-label={t("takePhotoA")}
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
                    accept={PHOTO_INPUT_ACCEPT}
                    capture="environment"
                    tabIndex={-1}
                    aria-label={t("takePhotoB")}
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
                                accept={PHOTO_INPUT_ACCEPT}
                                tabIndex={-1}
                                aria-label={t(
                                    side === "left"
                                        ? "replacePhotoA"
                                        : "replacePhotoB",
                                    { number: index + 1 },
                                )}
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

                {!isResultsPage &&
                    flowPhase !== "intro" &&
                    flowPhase !== "processing" && (
                        <div className="mt-3 mb-3 sm:mt-4 sm:mb-4">
                            <CompareStepper
                                currentStep={currentCompareStep}
                                onStepChange={handleStepChange}
                                productACount={leftProduct.photos.length}
                                productBCount={rightProduct.photos.length}
                                disabled={processingStep !== "idle"}
                            />
                        </div>
                    )}

                {!isResultsPage && (
                    <div
                        className={
                            flowPhase === "intro"
                                ? "mt-5 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-xs sm:mt-6 sm:p-6"
                                : ""
                        }
                    >
                        {flowPhase === "processing" ? (
                            <ComparisonProcessingSheet
                                processingStep={processingStep}
                                leftProduct={leftProduct}
                                rightProduct={rightProduct}
                                onCancel={handleCancelProcessing}
                            />
                        ) : flowPhase === "intro" ? (
                            <section
                                className=""
                                aria-labelledby="compare-intro-heading"
                            >
                                <div className="icon-heading-row">
                                    <span className="bg-primary-100 text-primary-800 flex size-10 shrink-0 items-center justify-center rounded-xl">
                                        <Scales size={25} weight="bold" />
                                    </span>
                                    <h2
                                        id="compare-intro-heading"
                                        tabIndex={-1}
                                        className="icon-heading-title text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl"
                                    >
                                        {t("compareTwo")}
                                    </h2>
                                </div>
                                <p className="icon-heading-supporting mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
                                    {t("intro")}
                                </p>

                                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        type="button"
                                        onClick={handleStartProductCapture}
                                        className="shadow-action-lift h-12 gap-2 rounded-xl px-5 font-extrabold"
                                    >
                                        <ArrowRight size={19} weight="bold" />
                                        <span>{t("getStarted")}</span>
                                    </Button>
                                </div>

                                {(leftProduct.error || rightProduct.error) && (
                                    <p
                                        className="border-error-200 bg-error-50 text-error-800 mt-4 rounded-xl border p-3 text-sm font-medium"
                                        role="alert"
                                    >
                                        {leftProduct.error ||
                                            rightProduct.error}
                                    </p>
                                )}
                            </section>
                        ) : flowPhase !== "results" || !comparison ? (
                            <section
                                aria-label={t("guidedCapture")}
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
                                    onTitleChange={(title, source) =>
                                        handleTitleChange(
                                            activeSide,
                                            title,
                                            source,
                                        )
                                    }
                                    onAddFiles={(files) =>
                                        handleAddFiles(activeSide, files)
                                    }
                                    onRemovePhoto={(index) =>
                                        handleRemovePhoto(activeSide, index)
                                    }
                                    onReplacePhoto={(index, file) =>
                                        handleReplacePhoto(
                                            activeSide,
                                            index,
                                            file,
                                        )
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
                                    onRetry={() => void handleCompare()}
                                    onPhotoPreviewError={(index) =>
                                        handlePhotoPreviewError(
                                            activeSide,
                                            index,
                                        )
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

                                {comparisonNotice && (
                                    <p
                                        className="bg-primary-50 text-primary-950 mt-3 rounded-xl px-3 py-2.5 text-sm leading-relaxed font-bold"
                                        role="status"
                                    >
                                        {comparisonNotice}
                                    </p>
                                )}

                                {!comparison &&
                                    inactiveSideError &&
                                    !inactiveSideProduct.loading && (
                                        <p
                                            className="border-error-200 bg-error-50 text-error-900 mt-3 rounded-xl border px-3 py-2.5 text-sm leading-relaxed font-bold"
                                            role="status"
                                        >
                                            {t("otherSideNeedsAttention", {
                                                product:
                                                    inactiveSideProduct.title,
                                            })}
                                        </p>
                                    )}

                                {!comparison &&
                                    activeSide === "right" &&
                                    comparisonError && (
                                        <Alert
                                            variant="destructive"
                                            role="alert"
                                            className="border-error-200 bg-error-50 text-error-900 mt-3"
                                        >
                                            <WarningCircle
                                                size={20}
                                                weight="bold"
                                                className="text-error-700"
                                                aria-hidden="true"
                                            />
                                            <AlertTitle className="text-sm font-extrabold">
                                                {t("comparisonErrorTitle")}
                                            </AlertTitle>
                                            <AlertDescription className="text-error-900/90">
                                                <p>{comparisonError}</p>
                                                <p className="mt-1.5">
                                                    {t(
                                                        "comparisonErrorGuidance",
                                                    )}
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        void handleCompare()
                                                    }
                                                    className="border-error-200 text-error-900 hover:bg-error-50 mt-3 h-10 gap-1.5 bg-white px-3 text-xs font-bold"
                                                >
                                                    <ArrowCounterClockwise
                                                        size={15}
                                                        weight="bold"
                                                        aria-hidden="true"
                                                    />
                                                    <span>
                                                        {t("retryComparison")}
                                                    </span>
                                                </Button>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                {!comparison &&
                                    activeSide === "right" &&
                                    !comparisonError &&
                                    processingStep === "idle" &&
                                    leftProduct.photos.length > 0 &&
                                    rightProduct.photos.length > 0 &&
                                    !isReadyToCompare && (
                                        <p
                                            className="mt-3 text-sm leading-relaxed font-bold text-neutral-900"
                                            role="status"
                                        >
                                            {comparisonStatus}
                                        </p>
                                    )}

                                {(flowPhase === "capture" ||
                                    flowPhase === "review") && (
                                    <div
                                        role="group"
                                        aria-label={t("captureNavigation")}
                                        data-glass-surface=""
                                        className="glass-surface fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 backdrop-blur-xl"
                                    >
                                        {activeSide === "left" && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                aria-label={t("backToStart")}
                                                disabled={
                                                    processingStep !== "idle"
                                                }
                                                onClick={() =>
                                                    handleBackFromSide("left")
                                                }
                                                className="h-11 gap-1.5 rounded-full px-4 text-sm font-bold text-neutral-700 hover:bg-white/70 hover:text-neutral-950"
                                            >
                                                <ArrowLeft
                                                    size={17}
                                                    weight="bold"
                                                />
                                                <span>{t("back")}</span>
                                            </Button>
                                        )}
                                        {activeSide === "right" && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                aria-label={t("backToProductA")}
                                                disabled={
                                                    processingStep !== "idle"
                                                }
                                                onClick={() =>
                                                    handleBackFromSide("right")
                                                }
                                                className="h-11 gap-1.5 rounded-full px-4 text-sm font-bold text-neutral-700 hover:bg-white/70 hover:text-neutral-950"
                                            >
                                                <ArrowLeft
                                                    size={17}
                                                    weight="bold"
                                                />
                                                <span>{t("back")}</span>
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="default"
                                            aria-label={
                                                activeSide === "left"
                                                    ? t("continueToProductB")
                                                    : comparison
                                                      ? t("returnToResults")
                                                      : compareButtonLabel
                                            }
                                            disabled={
                                                activeSide === "left"
                                                    ? leftProduct.photos
                                                          .length === 0 ||
                                                      hasUnusablePhoto(
                                                          leftProduct,
                                                      )
                                                    : rightProduct.photos
                                                          .length === 0 ||
                                                      hasUnusablePhoto(
                                                          rightProduct,
                                                      )
                                            }
                                            onClick={() => {
                                                handleContinueFromSide(
                                                    activeSide,
                                                )
                                            }}
                                            className="shadow-action-lift bg-primary-600 hover:bg-primary-700 h-11 gap-1.5 rounded-full px-4 text-sm font-extrabold"
                                        >
                                            <span>
                                                {activeSide === "left"
                                                    ? t("next")
                                                    : comparison
                                                      ? t("results")
                                                      : compareButtonLabel}
                                            </span>
                                            {activeSide === "right" &&
                                            !comparison ? (
                                                <Scales
                                                    size={17}
                                                    weight="bold"
                                                />
                                            ) : (
                                                <ArrowRight
                                                    size={17}
                                                    weight="bold"
                                                />
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </section>
                        ) : null}
                    </div>
                )}

                {/* Results page */}
                {isResultsPage && (
                    <section
                        id="compare-results-page"
                        role="region"
                        aria-label={t("comparisonResults")}
                        className="flex flex-col gap-4"
                    >
                        <h1
                            id="compare-results-heading"
                            tabIndex={-1}
                            className="sr-only"
                        >
                            {t("comparisonResults")}
                        </h1>
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
                    </section>
                )}
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
