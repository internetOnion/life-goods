import {
    ArrowCounterClockwise,
    ArrowLeft,
    Receipt,
    WarningCircle,
} from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"

import { appRoutes } from "@/app/routes"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { GlassButton as Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhotoComparisonApiError } from "@/features/photo-evidence/api"
import {
    MAX_PHOTO_FILE_SIZE_BYTES,
    PHOTO_INPUT_ACCEPT,
    formatActionableError,
    isAcceptedPhotoFile,
    isHeicFile,
    isSupportedImageFile,
    verifiedPhotoFile,
} from "@/features/photo-evidence/helpers"
import { checkPhotoQuality } from "@/features/photo-evidence/imageQuality"
import { PhotoInspectionModal } from "@/features/photo-evidence/PhotoInspectionModal"
import { ProviderDisclosure } from "@/features/photo-evidence/ProviderDisclosure"
import { useCompareTranslation } from "@/features/photo-evidence/translations"
import { lookupProduct, type ProductLookup } from "@/features/product/api"
import { decodeBarcodeFromImage } from "@/features/scan/stillImageBarcode"
import { usePageMetadata } from "@/lib/metadata"
import { useAppShellNavigation } from "@/ui/AppShellNavigation"

import { readLabelPhotos, type LabelReading } from "./api"
import { CaptureStepCard, type StepPhoto } from "./CaptureStepCard"
import {
    CAPTURE_STEPS,
    captureStep,
    nextEmptyStep,
    neutralPhotoFile,
    type CaptureStepId,
} from "./captureSteps"
import { GuidedCaptureSheet } from "./GuidedCaptureSheet"
import { ProductPageOffer } from "./ProductPageOffer"
import { LabelReadingResult } from "./result/LabelReadingResult"
import { useLabelReadingTranslation } from "./translations"

type StepPhotos = Partial<Record<CaptureStepId, StepPhoto>>

interface ReadingState {
    reading: LabelReading | null
    loading: boolean
    error: string
    retry: boolean
}

const IDLE_READING: ReadingState = {
    reading: null,
    loading: false,
    error: "",
    retry: false,
}

/** Reads a Barcode handed over in navigation state; never from the URL. */
function readBarcodeContext(state: unknown): string | null {
    if (!state || typeof state !== "object" || !("barcode" in state)) {
        return null
    }
    const barcode = (state as { barcode?: unknown }).barcode
    return typeof barcode === "string" && /^\d{6,14}$/.test(barcode)
        ? barcode
        : null
}

function isAbortError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name?: string }).name === "AbortError"
    )
}

function orderedPhotos(photos: StepPhotos): StepPhoto[] {
    return CAPTURE_STEPS.flatMap((step) => {
        const photo = photos[step.id]
        return photo ? [photo] : []
    })
}

export type LabelReadingPageProps = {
    readLabel?: typeof readLabelPhotos
    lookup?: ProductLookup
    decodeBarcode?: typeof decodeBarcodeFromImage
    checkQuality?: typeof checkPhotoQuality
}

export function LabelReadingPage({
    readLabel = readLabelPhotos,
    lookup = lookupProduct,
    decodeBarcode = decodeBarcodeFromImage,
    checkQuality = checkPhotoQuality,
}: LabelReadingPageProps = {}) {
    const { locale, t: tc } = useCompareTranslation()
    const { t } = useLabelReadingTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { setBottomDockVisible, setPrimaryNavigationHidden } =
        useAppShellNavigation()
    const barcodeContext = readBarcodeContext(location.state)

    usePageMetadata({
        title: tc("readPageTitle"),
        description: tc("readPageDescription"),
    })

    const [photos, setPhotos] = useState<StepPhotos>({})
    const [reading, setReading] = useState<ReadingState>(IDLE_READING)
    const [captureStepId, setCaptureStepId] = useState<CaptureStepId>("front")
    const [isCaptureOpen, setIsCaptureOpen] = useState(false)
    const [inspectionIndex, setInspectionIndex] = useState<number | null>(null)
    // The decoded Barcode lives only here. It never joins the photos, the upload,
    // filenames, or any request other than its own Product Lookup (SPEC §29.2).
    const [offer, setOffer] = useState<{
        barcode: string
        photoId: string
    } | null>(null)

    const photosRef = useRef<StepPhotos>({})
    photosRef.current = photos
    const uploadInputRef = useRef<HTMLInputElement | null>(null)
    const cameraInputRef = useRef<HTMLInputElement | null>(null)
    const targetStepRef = useRef<CaptureStepId | null>(null)
    const resultsRef = useRef<HTMLElement | null>(null)
    // One request in flight at most: abort is best-effort, the request id is
    // the guarantee that a late response for stale photos is ignored.
    const abortRef = useRef<AbortController | null>(null)
    const requestIdRef = useRef(0)
    const isMountedRef = useRef(true)
    const activeUrlsRef = useRef(new Set<string>())
    const photoTasksRef = useRef(new Map<string, AbortController>())
    const lookedUpBarcodesRef = useRef(new Set<string>())

    useEffect(() => {
        isMountedRef.current = true
        const activeUrls = activeUrlsRef.current
        const photoTasks = photoTasksRef.current
        return () => {
            isMountedRef.current = false
            abortRef.current?.abort()
            for (const controller of photoTasks.values()) controller.abort()
            photoTasks.clear()
            for (const url of activeUrls) URL.revokeObjectURL(url)
            activeUrls.clear()
        }
    }, [])

    // Like Compare Nutrition, the floating photo dock replaces primary navigation.
    useEffect(() => {
        setPrimaryNavigationHidden(true)
        setBottomDockVisible(true)
        return () => {
            setBottomDockVisible(false)
            setPrimaryNavigationHidden(false)
        }
    }, [setBottomDockVisible, setPrimaryNavigationHidden])

    /** Invalidates any in-flight read because the photos changed. */
    const cancelRead = () => {
        requestIdRef.current += 1
        abortRef.current?.abort()
        abortRef.current = null
    }

    const commitPhotos = (next: StepPhotos, error = "") => {
        photosRef.current = next
        setPhotos(next)
        setReading({ ...IDLE_READING, error })
    }

    const releasePhoto = (photo: StepPhoto) => {
        URL.revokeObjectURL(photo.url)
        activeUrlsRef.current.delete(photo.url)
        photoTasksRef.current.get(photo.localId)?.abort()
        photoTasksRef.current.delete(photo.localId)
        setOffer((current) =>
            current?.photoId === photo.localId ? null : current,
        )
    }

    const updatePhoto = (
        localId: string,
        update: (photo: StepPhoto) => StepPhoto,
    ): boolean => {
        const current = photosRef.current
        const entry = Object.entries(current).find(
            ([, photo]) => photo?.localId === localId,
        )
        if (!entry || !entry[1]) return false
        const next = { ...current, [entry[0]]: update(entry[1]) }
        photosRef.current = next
        setPhotos(next)
        return true
    }

    /** Offer the Product page when a decoded Barcode has a Source Record. */
    const offerProductPage = async (barcode: string, photoId: string) => {
        if (barcode === barcodeContext) return
        if (lookedUpBarcodesRef.current.has(barcode)) return
        lookedUpBarcodesRef.current.add(barcode)
        try {
            // English lookup: a speculative Khmer lookup would spend translation.
            await queryClient.fetchQuery({
                queryKey: ["product", barcode, "en"],
                queryFn: () => lookup(barcode),
                retry: false,
                staleTime: 60_000,
            })
        } catch {
            return
        }
        if (!isMountedRef.current) return
        if (
            !Object.values(photosRef.current).some(
                (p) => p?.localId === photoId,
            )
        ) {
            return
        }
        setOffer((current) => current ?? { barcode, photoId })
    }

    /** Verify, assess, and decode one newly placed photo, all on the device. */
    const inspectPhoto = async (photo: StepPhoto) => {
        const controller = new AbortController()
        photoTasksRef.current.set(photo.localId, controller)
        const verified = await verifiedPhotoFile(photo.file)
        if (!isMountedRef.current || controller.signal.aborted) return
        if (verified === null) {
            updatePhoto(photo.localId, (p) => ({ ...p, previewError: true }))
            cancelRead()
            setReading({
                ...IDLE_READING,
                error: tc("photoUnreadableOnDevice"),
            })
            return
        }
        if (verified !== photo.file) {
            updatePhoto(photo.localId, (p) => ({ ...p, file: verified }))
        }

        const quality = await checkQuality(verified)
        if (controller.signal.aborted) return
        if (quality?.issues.length) {
            updatePhoto(photo.localId, (p) => ({
                ...p,
                qualityIssues: quality.issues,
            }))
        }

        const barcode = await decodeBarcode(verified, {
            signal: controller.signal,
        })
        if (barcode && !controller.signal.aborted) {
            void offerProductPage(barcode, photo.localId)
        }
    }

    const createPhoto = (file: File, stepId: CaptureStepId): StepPhoto => {
        const url = URL.createObjectURL(file)
        activeUrlsRef.current.add(url)
        return {
            file,
            url,
            localId: crypto.randomUUID(),
            stepId,
            qualityIssues: [],
        }
    }

    /**
     * Place photos starting at `startStep` (replacing it), then into the next
     * empty steps. Files that do not fit are reported, never silently dropped.
     */
    const handleAddFiles = (files: File[], startStep?: CaptureStepId) => {
        cancelRead()
        const errors: string[] = []
        if (files.some((file) => !isSupportedImageFile(file))) {
            errors.push(tc("unsupportedFormat"))
        }
        const oversized = files.filter(
            (file) => file.size > MAX_PHOTO_FILE_SIZE_BYTES,
        )
        if (oversized.length > 0) {
            errors.push(
                tc("fileTooLarge", {
                    files: oversized.map((file) => file.name).join(", "),
                }),
            )
        }
        const accepted = files.filter(isAcceptedPhotoFile)

        const next: StepPhotos = { ...photosRef.current }
        const taken = new Set(
            (Object.keys(next) as CaptureStepId[]).filter((id) => next[id]),
        )
        const placed: StepPhoto[] = []
        let target: CaptureStepId | null =
            startStep ?? nextEmptyStep(taken, undefined)
        for (const file of accepted) {
            if (target === null) {
                errors.push(tc("maxPhotos", { count: CAPTURE_STEPS.length }))
                break
            }
            const previous = next[target]
            if (previous) releasePhoto(previous)
            const photo = createPhoto(file, target)
            next[target] = photo
            placed.push(photo)
            taken.add(target)
            target = nextEmptyStep(taken, target)
        }

        if (placed.length === 0) {
            setReading((current) => ({
                ...current,
                error: errors.join(" ") || tc("noValidImages"),
            }))
            return
        }
        commitPhotos(next, errors.join(" "))
        for (const photo of placed) void inspectPhoto(photo)
    }

    const handleRemovePhoto = (stepId: CaptureStepId) => {
        const photo = photosRef.current[stepId]
        if (!photo) return
        cancelRead()
        releasePhoto(photo)
        const next = { ...photosRef.current }
        delete next[stepId]
        commitPhotos(next)
    }

    const handleReset = () => {
        cancelRead()
        Object.values(photosRef.current).forEach((photo) => {
            if (photo) releasePhoto(photo)
        })
        commitPhotos({})
        setOffer(null)
        setInspectionIndex(null)
    }

    const handlePreviewError = (stepId: CaptureStepId) => {
        const photo = photosRef.current[stepId]
        if (!photo || photo.previewError || photo.previewUnsupported) return
        // This browser cannot render HEIC; the backend still reads it.
        if (isHeicFile(photo.file)) {
            updatePhoto(photo.localId, (p) => ({
                ...p,
                previewUnsupported: true,
            }))
            return
        }
        updatePhoto(photo.localId, (p) => ({ ...p, previewError: true }))
        cancelRead()
        setReading({ ...IDLE_READING, error: tc("photoPreviewUnavailable") })
    }

    const openFileInput = (
        input: HTMLInputElement | null,
        stepId: CaptureStepId,
    ) => {
        targetStepRef.current = stepId
        input?.click()
    }

    const handleFileInput = (files: FileList | null) => {
        if (!files?.length) return
        const target = targetStepRef.current ?? undefined
        targetStepRef.current = null
        handleAddFiles(Array.from(files), target)
    }

    const sequence = orderedPhotos(photos)
    const takenSteps = new Set(
        CAPTURE_STEPS.filter((step) => photos[step.id]).map((step) => step.id),
    )
    const canRead =
        sequence.length > 0 &&
        !reading.loading &&
        !sequence.some((photo) => photo.previewError)

    const handleRead = async () => {
        const submitted = orderedPhotos(photosRef.current)
        if (
            submitted.length === 0 ||
            reading.loading ||
            submitted.some((photo) => photo.previewError)
        ) {
            return
        }

        cancelRead()
        const requestId = requestIdRef.current
        const controller = new AbortController()
        abortRef.current = controller
        setReading({ ...IDLE_READING, loading: true })

        const isCurrent = () =>
            isMountedRef.current && requestIdRef.current === requestId

        try {
            // Only the photos and their capture roles leave the device (SPEC §29.3).
            const result = await readLabel(
                submitted.map((photo, index) =>
                    neutralPhotoFile(photo.file, index),
                ),
                submitted.map((photo) => captureStep(photo.stepId).role),
                { signal: controller.signal },
            )
            if (!isCurrent()) return
            setReading({ ...IDLE_READING, reading: result })
            requestAnimationFrame(() =>
                resultsRef.current?.focus({ preventScroll: false }),
            )
        } catch (err) {
            if (!isCurrent() || isAbortError(err)) return
            const message =
                err instanceof Error ? err.message : tc("requestFailed")
            const code =
                err instanceof PhotoComparisonApiError ? err.code : undefined
            setReading({
                ...IDLE_READING,
                error: formatActionableError(message, code, locale),
                retry: true,
            })
        } finally {
            if (abortRef.current === controller) abortRef.current = null
        }
    }

    const handleFocusEvidence = (imageId: string) => {
        const index =
            reading.reading?.images.findIndex(
                (image) => image.image_id === imageId,
            ) ?? -1
        if (index >= 0 && sequence[index]) setInspectionIndex(index)
    }

    return (
        <div
            className="min-h-full pb-8 text-neutral-900"
            lang={locale === "km" ? "km" : "en"}
        >
            <main
                aria-busy={reading.loading}
                className="page-rail pb-32 sm:px-6 sm:pt-12 sm:pb-12"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-neutral-950">
                            {tc("readPageTitle")}
                        </h1>
                        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                            {tc("readModeDescription")}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleReset}
                        disabled={reading.loading}
                        aria-label={tc("resetReading")}
                        title={tc("resetReading")}
                        className="size-11 shrink-0 rounded-xl text-neutral-700 hover:text-neutral-900"
                    >
                        <ArrowCounterClockwise size={18} weight="bold" />
                    </Button>
                </div>

                {barcodeContext ? (
                    <p
                        className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm leading-relaxed text-neutral-700"
                        data-testid="unmatched-barcode-context"
                    >
                        {tc("unmatchedBarcodeContext", {
                            barcode: barcodeContext,
                        })}
                    </p>
                ) : null}

                {offer ? (
                    <ProductPageOffer
                        barcode={offer.barcode}
                        onOpen={() =>
                            void navigate(`/products/${offer.barcode}`)
                        }
                        onDismiss={() => setOffer(null)}
                    />
                ) : null}

                <section aria-labelledby="capture-intro-title" className="mt-5">
                    <h2
                        id="capture-intro-title"
                        className="text-base font-extrabold text-neutral-950"
                    >
                        {t("captureIntroTitle")}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                        {t("captureIntroBody")}
                    </p>
                    <ProviderDisclosure className="mt-3" />

                    <ol
                        aria-label={t("captureStepsLabel")}
                        className="mt-4 space-y-2.5"
                    >
                        {CAPTURE_STEPS.map((step, index) => (
                            <CaptureStepCard
                                key={step.id}
                                step={step}
                                index={index}
                                photo={photos[step.id]}
                                disabled={reading.loading}
                                onTakePhoto={() => {
                                    setCaptureStepId(step.id)
                                    setIsCaptureOpen(true)
                                }}
                                onChooseFromLibrary={() =>
                                    openFileInput(
                                        uploadInputRef.current,
                                        step.id,
                                    )
                                }
                                onRemove={() => handleRemovePhoto(step.id)}
                                onInspect={() =>
                                    setInspectionIndex(
                                        sequence.findIndex(
                                            (photo) =>
                                                photo === photos[step.id],
                                        ),
                                    )
                                }
                                onPreviewError={() =>
                                    handlePreviewError(step.id)
                                }
                            />
                        ))}
                    </ol>

                    {reading.error ? (
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
                                {reading.retry
                                    ? tc("labelReadingErrorTitle")
                                    : tc("photoErrorTitle")}
                            </AlertTitle>
                            <AlertDescription className="text-error-900/90">
                                <p>{reading.error}</p>
                                {reading.retry ? (
                                    <>
                                        <p className="mt-1.5">
                                            {tc("retryPhotoGuidance")}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => void handleRead()}
                                            className="border-error-200 text-error-900 hover:bg-error-50 mt-3 h-10 gap-1.5 bg-white px-3 text-xs font-bold"
                                        >
                                            <ArrowCounterClockwise
                                                size={15}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                {tc("retryReadingProduct", {
                                                    product:
                                                        tc("readSubjectTitle"),
                                                })}
                                            </span>
                                        </Button>
                                    </>
                                ) : null}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <p
                            role="status"
                            className={
                                reading.loading
                                    ? "text-primary-700 mt-3 text-xs font-medium"
                                    : "mt-3 text-xs text-neutral-500"
                            }
                        >
                            {reading.loading
                                ? tc("readingPhotos")
                                : sequence.length === 0
                                  ? t("photosNeeded")
                                  : null}
                        </p>
                    )}
                </section>

                <div
                    role="group"
                    aria-label={tc("captureNavigation")}
                    data-glass-surface=""
                    className="glass-surface fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 backdrop-blur-xl"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        aria-label={tc("backToLabels")}
                        disabled={reading.loading}
                        onClick={() => void navigate(appRoutes.labels)}
                        className="h-11 gap-1.5 rounded-full px-4 text-sm font-bold text-neutral-700 hover:bg-white/70 hover:text-neutral-950"
                    >
                        <ArrowLeft size={17} weight="bold" />
                        <span>{tc("back")}</span>
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        disabled={!canRead}
                        onClick={() => void handleRead()}
                        className="shadow-action-lift bg-primary-600 hover:bg-primary-700 h-11 gap-1.5 rounded-full px-4 text-sm font-extrabold"
                    >
                        <span>
                            {reading.loading
                                ? tc("readingPhotos")
                                : reading.reading
                                  ? tc("readAgainAction")
                                  : tc("readThisLabelAction")}
                        </span>
                        <Receipt size={17} weight="bold" />
                    </Button>
                </div>

                {reading.reading && !reading.loading ? (
                    <LabelReadingResult
                        ref={resultsRef}
                        reading={reading.reading}
                        frontPhotoUrl={
                            photos.front && !photos.front.previewError
                                ? photos.front.url
                                : undefined
                        }
                        onFocusEvidence={handleFocusEvidence}
                    />
                ) : null}

                <Input
                    ref={uploadInputRef}
                    id="label-reading-upload"
                    type="file"
                    accept={PHOTO_INPUT_ACCEPT}
                    multiple
                    tabIndex={-1}
                    aria-label={tc("chooseLibrary")}
                    className="sr-only"
                    onChange={(event) => {
                        handleFileInput(event.target.files)
                        event.target.value = ""
                    }}
                />
                <Input
                    ref={cameraInputRef}
                    id="label-reading-camera"
                    type="file"
                    accept={PHOTO_INPUT_ACCEPT}
                    capture="environment"
                    tabIndex={-1}
                    aria-label={tc("takePhoto")}
                    className="sr-only"
                    onChange={(event) => {
                        handleFileInput(event.target.files)
                        event.target.value = ""
                    }}
                />
            </main>

            <GuidedCaptureSheet
                isOpen={isCaptureOpen}
                stepId={captureStepId}
                takenSteps={takenSteps}
                onStepChange={setCaptureStepId}
                onCapture={(stepId, file) => handleAddFiles([file], stepId)}
                onClose={() => setIsCaptureOpen(false)}
                onUseDeviceCamera={(stepId) => {
                    setIsCaptureOpen(false)
                    openFileInput(cameraInputRef.current, stepId)
                }}
                onChooseFromLibrary={(stepId) => {
                    setIsCaptureOpen(false)
                    openFileInput(uploadInputRef.current, stepId)
                }}
            />

            <PhotoInspectionModal
                isOpen={inspectionIndex !== null}
                onClose={() => setInspectionIndex(null)}
                photos={sequence}
                initialIndex={inspectionIndex ?? 0}
                title={tc("readSubjectTitle")}
            />
        </div>
    )
}
