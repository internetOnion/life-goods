import {
    ArrowCounterClockwise,
    ArrowLeft,
    Receipt,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"

import { appRoutes } from "@/app/routes"
import { GlassButton as Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    PhotoComparisonApiError,
    extractProductPhotos,
} from "@/features/photo-evidence/api"
import {
    MAX_PHOTO_FILE_SIZE_BYTES,
    PHOTO_INPUT_ACCEPT,
    formatActionableError,
    isAcceptedPhotoFile,
    isHeicFile,
    isSupportedImageFile,
    verifiedPhotoFile,
} from "@/features/photo-evidence/helpers"
import { PhotoInspectionModal } from "@/features/photo-evidence/PhotoInspectionModal"
import { ProductPhotoPanel } from "@/features/photo-evidence/ProductPhotoPanel"
import {
    MAX_PHOTOS_PER_PRODUCT,
    type PhotoSubjectState,
    type ProductPhoto,
} from "@/features/photo-evidence/types"
import { useCompareTranslation } from "@/features/photo-evidence/translations"
import { usePageMetadata } from "@/lib/metadata"
import { useAppShellNavigation } from "@/ui/AppShellNavigation"

import { LabelReadingView } from "./LabelReadingView"

/**
 * The provider only ever receives this constant panel identifier and the photo
 * bytes. It is never derived from the Barcode (SPEC §29).
 */
export const LABEL_READING_PRODUCT_ID = "label"

function createSubject(title: string): PhotoSubjectState {
    return {
        id: LABEL_READING_PRODUCT_ID,
        title,
        titleSource: "default",
        number: null,
        photos: [],
        extraction: null,
        selectedColumnId: null,
        loading: false,
        error: "",
        retry: false,
        revision: 0,
    }
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

export type LabelReadingPageProps = {
    extractPhotos?: typeof extractProductPhotos
}

export function LabelReadingPage({
    extractPhotos = extractProductPhotos,
}: LabelReadingPageProps = {}) {
    const { locale, t } = useCompareTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const { setBottomDockVisible, setPrimaryNavigationHidden } =
        useAppShellNavigation()
    const barcodeContext = readBarcodeContext(location.state)

    usePageMetadata({
        title: t("readPageTitle"),
        description: t("readPageDescription"),
    })

    const [subject, setSubject] = useState(() =>
        createSubject(t("readSubjectTitle")),
    )
    const [inspectionIndex, setInspectionIndex] = useState<number | null>(null)
    const [highlightedPhotoId, setHighlightedPhotoId] = useState<string | null>(
        null,
    )

    const uploadInputRef = useRef<HTMLInputElement | null>(null)
    const cameraInputRef = useRef<HTMLInputElement | null>(null)
    const previewRefs = useRef<Record<string, HTMLElement | null>>({})
    const resultsRef = useRef<HTMLElement | null>(null)
    // One request in flight at most: abort is best-effort, the request id is
    // the guarantee that a late response for stale photos is ignored.
    const abortRef = useRef<AbortController | null>(null)
    const requestIdRef = useRef(0)
    const isMountedRef = useRef(true)
    const activeUrlsRef = useRef(new Set<string>())

    useEffect(() => {
        isMountedRef.current = true
        const activeUrls = activeUrlsRef.current
        return () => {
            isMountedRef.current = false
            abortRef.current?.abort()
            for (const url of activeUrls) {
                URL.revokeObjectURL(url)
            }
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

    // Keep the default title in the active locale until the Shopper edits it.
    useEffect(() => {
        setSubject((prev) =>
            prev.titleSource === "default"
                ? { ...prev, title: t("readSubjectTitle") }
                : prev,
        )
    }, [t])

    /** Invalidates any in-flight read because the photos changed. */
    const cancelRead = () => {
        requestIdRef.current += 1
        abortRef.current?.abort()
        abortRef.current = null
    }

    const photosChanged = (
        prev: PhotoSubjectState,
        photos: ProductPhoto[],
        error = "",
    ): PhotoSubjectState => ({
        ...prev,
        photos,
        revision: prev.revision + 1,
        extraction: null,
        error,
        retry: false,
        loading: false,
    })

    const revoke = (photo: ProductPhoto) => {
        URL.revokeObjectURL(photo.url)
        activeUrlsRef.current.delete(photo.url)
    }

    const createPhoto = (file: File): ProductPhoto => {
        const url = URL.createObjectURL(file)
        activeUrlsRef.current.add(url)
        return { file, url, localId: crypto.randomUUID() }
    }

    /**
     * Same check as Compare Nutrition: read each picked photo in full so an
     * empty or truncated photo (an iCloud-optimized photo not yet downloaded)
     * is flagged before upload, and upload the verified in-memory copy.
     */
    const verifyPhotos = async (files: File[]) => {
        const checked = await Promise.all(
            files.map(async (file) => ({
                file,
                verified: await verifiedPhotoFile(file),
            })),
        )
        const unreadable = new Set(
            checked.filter((item) => item.verified === null).map((i) => i.file),
        )
        const verified = new Map(
            checked
                .filter((item) => item.verified && item.verified !== item.file)
                .map((item) => [item.file, item.verified as File]),
        )
        if (!isMountedRef.current) return
        if (unreadable.size === 0 && verified.size === 0) return

        setSubject((prev) => {
            const affected = prev.photos.filter(
                (photo) =>
                    unreadable.has(photo.file) || verified.has(photo.file),
            )
            if (affected.length === 0) return prev
            const photos = prev.photos.map((photo) => {
                if (unreadable.has(photo.file)) {
                    return { ...photo, previewError: true }
                }
                const replacement = verified.get(photo.file)
                return replacement ? { ...photo, file: replacement } : photo
            })
            if (!affected.some((photo) => unreadable.has(photo.file))) {
                return { ...prev, photos }
            }
            return photosChanged(prev, photos, t("photoUnreadableOnDevice"))
        })
    }

    const handleAddFiles = (files: File[]) => {
        cancelRead()
        setSubject((prev) => {
            const available = MAX_PHOTOS_PER_PRODUCT - prev.photos.length
            if (available <= 0) {
                return {
                    ...prev,
                    error: t("maxPhotos", { count: MAX_PHOTOS_PER_PRODUCT }),
                }
            }

            const validationErrors: string[] = []
            if (files.some((file) => !isSupportedImageFile(file))) {
                validationErrors.push(t("unsupportedFormat"))
            }
            const oversized = files.filter(
                (file) => file.size > MAX_PHOTO_FILE_SIZE_BYTES,
            )
            if (oversized.length > 0) {
                validationErrors.push(
                    t("fileTooLarge", {
                        files: oversized.map((file) => file.name).join(", "),
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

            return photosChanged(
                prev,
                [...prev.photos, ...validFiles.map(createPhoto)],
                validationErrors.join(" "),
            )
        })
        void verifyPhotos(files.filter(isAcceptedPhotoFile))
    }

    const handleRemovePhoto = (index: number) => {
        cancelRead()
        setSubject((prev) => {
            const photo = prev.photos[index]
            if (photo) revoke(photo)
            return photosChanged(
                prev,
                prev.photos.filter((_, i) => i !== index),
            )
        })
    }

    const handleReplacePhoto = (index: number, file: File) => {
        if (!isSupportedImageFile(file)) {
            setSubject((prev) => ({ ...prev, error: t("unsupportedFormat") }))
            return
        }
        if (file.size > MAX_PHOTO_FILE_SIZE_BYTES) {
            setSubject((prev) => ({
                ...prev,
                error: t("fileTooLarge", { files: file.name }),
            }))
            return
        }
        cancelRead()
        setSubject((prev) => {
            const old = prev.photos[index]
            if (old) revoke(old)
            const photos = [...prev.photos]
            photos[index] = createPhoto(file)
            return photosChanged(prev, photos)
        })
        void verifyPhotos([file])
    }

    const handleClearPhotos = () => {
        cancelRead()
        setSubject((prev) => {
            prev.photos.forEach(revoke)
            return photosChanged(prev, [])
        })
    }

    const handleReset = () => {
        handleClearPhotos()
        setInspectionIndex(null)
        setHighlightedPhotoId(null)
    }

    const canRead =
        subject.photos.length > 0 &&
        !subject.loading &&
        !subject.photos.some((photo) => photo.previewError)

    const handlePhotoPreviewError = (index: number) => {
        setSubject((prev) => {
            const photo = prev.photos[index]
            if (!photo || photo.previewError || photo.previewUnsupported) {
                return prev
            }
            // This browser cannot render HEIC; the backend still reads it.
            const flag = isHeicFile(photo.file)
                ? { previewUnsupported: true }
                : { previewError: true }
            const photos = prev.photos.map((item, i) =>
                i === index ? { ...item, ...flag } : item,
            )
            return "previewError" in flag
                ? photosChanged(prev, photos, t("photoPreviewUnavailable"))
                : { ...prev, photos }
        })
    }

    const handleRead = async () => {
        const photos = subject.photos
        if (
            photos.length === 0 ||
            subject.loading ||
            photos.some((photo) => photo.previewError)
        ) {
            return
        }

        cancelRead()
        const requestId = requestIdRef.current
        const controller = new AbortController()
        abortRef.current = controller
        setSubject((prev) => ({
            ...prev,
            loading: true,
            error: "",
            retry: false,
        }))

        const isCurrent = () =>
            isMountedRef.current && requestIdRef.current === requestId

        try {
            const extraction = await extractPhotos(
                LABEL_READING_PRODUCT_ID,
                photos.map((photo) => photo.file),
                { signal: controller.signal },
            )
            if (!isCurrent()) return
            setSubject((prev) => ({
                ...prev,
                extraction,
                loading: false,
            }))
            requestAnimationFrame(() =>
                resultsRef.current?.focus({ preventScroll: false }),
            )
        } catch (err) {
            if (!isCurrent() || isAbortError(err)) return
            const message =
                err instanceof Error ? err.message : t("requestFailed")
            const code =
                err instanceof PhotoComparisonApiError ? err.code : undefined
            setSubject((prev) => ({
                ...prev,
                loading: false,
                error: formatActionableError(message, code, locale),
                retry: true,
            }))
        } finally {
            if (abortRef.current === controller) abortRef.current = null
        }
    }

    const handleFocusEvidence = (imageId: string) => {
        const index =
            subject.extraction?.images.findIndex(
                (image) => image.image_id === imageId,
            ) ?? -1
        const photo = index >= 0 ? subject.photos[index] : undefined
        if (!photo) return
        previewRefs.current[photo.localId]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        })
        setHighlightedPhotoId(photo.localId)
        setTimeout(() => {
            setHighlightedPhotoId((current) =>
                current === photo.localId ? null : current,
            )
        }, 1600)
        setInspectionIndex(index)
    }

    return (
        <div
            className="min-h-full pb-8 text-neutral-900"
            lang={locale === "km" ? "km" : "en"}
        >
            <main
                aria-busy={subject.loading}
                className="page-rail pb-32 sm:px-6 sm:pt-12 sm:pb-12"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-neutral-950">
                            {t("readPageTitle")}
                        </h1>
                        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                            {t("readModeDescription")}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleReset}
                        disabled={subject.loading}
                        aria-label={t("resetReading")}
                        title={t("resetReading")}
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
                        {t("unmatchedBarcodeContext", {
                            barcode: barcodeContext,
                        })}
                    </p>
                ) : null}

                <section aria-label={t("readPageTitle")} className="mt-5">
                    <ProductPhotoPanel
                        product={subject}
                        highlightedPhotoId={highlightedPhotoId}
                        previewRefs={previewRefs}
                        onTitleChange={() => undefined}
                        onAddFiles={handleAddFiles}
                        onRemovePhoto={handleRemovePhoto}
                        onReplacePhoto={handleReplacePhoto}
                        onClearPhotos={handleClearPhotos}
                        onOpenCamera={() => cameraInputRef.current?.click()}
                        onOpenLibrary={() => uploadInputRef.current?.click()}
                        onRetry={() => void handleRead()}
                        onPhotoPreviewError={handlePhotoPreviewError}
                        onFocusEvidence={handleFocusEvidence}
                        onInspectPhoto={setInspectionIndex}
                        showTitleInput={false}
                        showExtractionResults={false}
                    />
                </section>

                <div
                    role="group"
                    aria-label={t("captureNavigation")}
                    data-glass-surface=""
                    className="glass-surface fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 backdrop-blur-xl"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        aria-label={t("backToLabels")}
                        disabled={subject.loading}
                        onClick={() => void navigate(appRoutes.labels)}
                        className="h-11 gap-1.5 rounded-full px-4 text-sm font-bold text-neutral-700 hover:bg-white/70 hover:text-neutral-950"
                    >
                        <ArrowLeft size={17} weight="bold" />
                        <span>{t("back")}</span>
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        disabled={!canRead}
                        onClick={() => void handleRead()}
                        className="shadow-action-lift bg-primary-600 hover:bg-primary-700 h-11 gap-1.5 rounded-full px-4 text-sm font-extrabold"
                    >
                        <span>
                            {subject.loading
                                ? t("readingPhotos")
                                : subject.extraction
                                  ? t("readAgainAction")
                                  : t("readThisLabelAction")}
                        </span>
                        <Receipt size={17} weight="bold" />
                    </Button>
                </div>

                {subject.extraction && !subject.loading ? (
                    <LabelReadingView
                        ref={resultsRef}
                        extraction={subject.extraction}
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
                    aria-label={t("chooseLibrary")}
                    className="sr-only"
                    onChange={(event) => {
                        if (event.target.files?.length) {
                            handleAddFiles(Array.from(event.target.files))
                        }
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
                    aria-label={t("takePhoto")}
                    className="sr-only"
                    onChange={(event) => {
                        if (event.target.files?.length) {
                            handleAddFiles(Array.from(event.target.files))
                        }
                        event.target.value = ""
                    }}
                />
            </main>

            <PhotoInspectionModal
                isOpen={inspectionIndex !== null}
                onClose={() => setInspectionIndex(null)}
                photos={subject.photos}
                initialIndex={inspectionIndex ?? 0}
                title={subject.title}
            />
        </div>
    )
}
