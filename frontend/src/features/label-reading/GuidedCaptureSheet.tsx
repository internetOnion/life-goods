import {
    ArrowCounterClockwise,
    ArrowRight,
    Camera,
    Check,
    DeviceMobileCamera,
    ImageSquare,
    WarningCircle,
    X,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"

import { CameraAperture } from "@/components/camera/CameraAperture"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type {
    PhotoQuality,
    PhotoQualityIssue,
} from "@/features/photo-evidence/imageQuality"
import { useCompareTranslation } from "@/features/photo-evidence/translations"
import {
    captureVideoFrame,
    hasVideoDimensions,
    useCameraStream,
    type CameraResolution,
    type CameraStreamProblem,
} from "@/features/photo-evidence/useCameraStream"
import { cn } from "@/lib/utils"

import { CapturePathRail } from "./CapturePathRail"
import {
    CAPTURE_STEPS,
    QUALITY_KEYS,
    captureStep,
    nextEmptyStep,
    type CaptureStepId,
    type StepPhotos,
} from "./captureSteps"
import { StepFrameGuide } from "./StepFrameGuide"
import { useLabelReadingTranslation } from "./translations"

/** Label text is small; ask for 4K and let the browser clamp to what it supports. */
const LABEL_CAMERA_RESOLUTION: CameraResolution = { width: 3840, height: 2160 }

const PROBLEM_KEYS = {
    unavailable: "cameraUnavailable",
    did_not_start: "cameraDidNotStart",
    denied: "cameraDenied",
} as const satisfies Record<CameraStreamProblem, string>

interface Preview {
    blob: Blob
    url: string
    /** null until the on-device check finishes, or when it could not run. */
    issues: PhotoQualityIssue[] | null
}

export interface GuidedCaptureSheetProps {
    isOpen: boolean
    stepId: CaptureStepId
    photos: StepPhotos
    onStepChange: (step: CaptureStepId) => void
    /** `qualityIssues` is null when the photo was not assessed here. */
    onCapture: (
        step: CaptureStepId,
        file: File,
        qualityIssues: PhotoQualityIssue[] | null,
    ) => void
    onClose: () => void
    onUseDeviceCamera: (step: CaptureStepId) => void
    onChooseFromLibrary: (step: CaptureStepId) => void
    assessPhoto?: (photo: Blob) => Promise<PhotoQuality | null>
}

/**
 * The camera-first capture path: one stream stays open while the Shopper is
 * walked from the front, to the back, to an optional side panel. Each shot is
 * previewed with advisory quality hints before it joins the path.
 */
export function GuidedCaptureSheet({
    isOpen,
    stepId,
    photos,
    onStepChange,
    onCapture,
    onClose,
    onUseDeviceCamera,
    onChooseFromLibrary,
    assessPhoto,
}: GuidedCaptureSheetProps) {
    const { t: tc } = useCompareTranslation()
    const { t } = useLabelReadingTranslation()
    const videoRef = useRef<HTMLVideoElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const captureRunRef = useRef(0)
    const camera = useCameraStream(videoRef, {
        active: isOpen,
        resolution: LABEL_CAMERA_RESOLUTION,
    })
    const [preview, setPreview] = useState<Preview | null>(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const [captureFailed, setCaptureFailed] = useState(false)

    const clearPreview = () => {
        captureRunRef.current += 1
        setPreview((current) => {
            if (current) URL.revokeObjectURL(current.url)
            return null
        })
    }

    // A new step or a closed sheet never shows the previous step's preview.
    useEffect(() => {
        captureRunRef.current += 1
        setIsCapturing(false)
        setCaptureFailed(false)
        setPreview((current) => {
            if (current) URL.revokeObjectURL(current.url)
            return null
        })
    }, [isOpen, stepId])

    const step = captureStep(stepId)
    const stepIndex = CAPTURE_STEPS.findIndex((s) => s.id === stepId)
    const stepTitle = t(step.titleKey)
    const showLive =
        camera.status === "ready" && camera.isVideoReady && !preview
    const cameraError = camera.problem ? tc(PROBLEM_KEYS[camera.problem]) : null
    const takenSteps = new Set(
        CAPTURE_STEPS.filter((s) => photos[s.id]).map((s) => s.id),
    )
    const isLastOpenStep =
        nextEmptyStep(takenSteps, stepId, { wrap: false }) === null

    const advance = (taken: ReadonlySet<CaptureStepId>) => {
        const next = nextEmptyStep(taken, stepId, { wrap: false })
        if (next === null) {
            onClose()
        } else {
            onStepChange(next)
        }
    }

    const handleCapture = () => {
        const video = videoRef.current
        if (!video || !camera.isVideoReady || !hasVideoDimensions(video)) return
        const run = ++captureRunRef.current
        setIsCapturing(true)
        setCaptureFailed(false)
        captureVideoFrame(video).then(
            (blob) => {
                if (run !== captureRunRef.current) return
                setIsCapturing(false)
                if (!blob) {
                    setCaptureFailed(true)
                    return
                }
                setPreview({
                    blob,
                    url: URL.createObjectURL(blob),
                    issues: null,
                })
                if (!assessPhoto) return
                assessPhoto(blob).then(
                    (quality) => {
                        if (run !== captureRunRef.current || !quality) return
                        setPreview((current) =>
                            current?.blob === blob
                                ? { ...current, issues: quality.issues }
                                : current,
                        )
                    },
                    () => undefined,
                )
            },
            () => {
                if (run !== captureRunRef.current) return
                setIsCapturing(false)
                setCaptureFailed(true)
            },
        )
    }

    const handleUsePhoto = () => {
        if (!preview) return
        onCapture(
            stepId,
            new File([preview.blob], `${stepId}.jpg`, { type: "image/jpeg" }),
            preview.issues,
        )
        clearPreview()
        advance(new Set([...takenSteps, stepId]))
    }

    const handleSkip = () => advance(new Set([...takenSteps, stepId]))

    if (!isOpen) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showClose={false}
                onOpenAutoFocus={(event) => {
                    event.preventDefault()
                    closeButtonRef.current?.focus()
                    camera.restart()
                }}
                className="inset-0 flex h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 grid-cols-1 flex-col gap-0 rounded-none border-0 bg-neutral-950 p-0 text-white sm:p-5"
            >
                <div className="mx-auto flex min-h-full w-full max-w-xl flex-col">
                    <header className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-2">
                        <p className="font-mono text-xs font-semibold tracking-wide text-neutral-400">
                            {t("guidedStepProgress", {
                                current: stepIndex + 1,
                                total: CAPTURE_STEPS.length,
                            })}
                        </p>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            ref={closeButtonRef}
                            onClick={onClose}
                            aria-label={tc("closeCamera")}
                            className="size-11 shrink-0 rounded-full text-neutral-300 hover:bg-white/10 hover:text-white"
                        >
                            <X size={20} weight="bold" />
                        </Button>
                    </header>

                    <div className="px-4 pt-1 sm:px-2">
                        <CapturePathRail
                            photos={photos}
                            currentStepId={stepId}
                            onSelect={onStepChange}
                        />
                    </div>

                    <div
                        key={stepId}
                        className="motion-safe:animate-step-enter px-4 pt-5 pb-4 sm:px-2"
                    >
                        <DialogTitle className="text-xl leading-snug font-extrabold tracking-[-0.02em] text-white">
                            {stepTitle}
                            {step.optional ? (
                                <span className="ml-2 align-middle text-xs font-semibold tracking-normal text-neutral-400">
                                    {t("stepOptional")}
                                </span>
                            ) : null}
                        </DialogTitle>
                        <p className="mt-1 max-w-[36ch] text-sm leading-relaxed text-neutral-300">
                            {t(step.tipKey)}
                        </p>
                    </div>

                    <div className="relative isolate mx-4 min-h-[18rem] flex-1 overflow-hidden rounded-3xl bg-black ring-1 ring-white/10 sm:mx-2">
                        <video
                            ref={videoRef}
                            muted
                            playsInline
                            autoPlay
                            aria-label={tc("livePreview")}
                            className={cn(
                                "absolute inset-0 block h-full w-full object-cover transition-opacity duration-300",
                                showLive || isCapturing
                                    ? "opacity-100"
                                    : "opacity-0",
                            )}
                        />

                        {preview ? (
                            <img
                                src={preview.url}
                                alt={t("stepPhotoAlt", { step: stepTitle })}
                                className="absolute inset-0 size-full bg-neutral-900 object-contain"
                            />
                        ) : null}

                        {camera.status === "unavailable" ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                                <span className="text-primary-300 flex size-14 items-center justify-center rounded-2xl bg-neutral-800">
                                    <Camera size={26} weight="bold" />
                                </span>
                                <h3 className="mt-4 text-lg font-extrabold text-white">
                                    {tc("cameraUnavailableTitle")}
                                </h3>
                                <p
                                    className="mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-300"
                                    role="alert"
                                >
                                    {cameraError}
                                </p>
                                <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
                                    <Button
                                        type="button"
                                        onClick={() =>
                                            onUseDeviceCamera(stepId)
                                        }
                                        className="bg-primary-600 hover:bg-primary-700 h-12 gap-2 rounded-xl font-extrabold text-white"
                                    >
                                        <DeviceMobileCamera
                                            size={18}
                                            weight="bold"
                                        />
                                        <span>{tc("useDeviceCamera")}</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() =>
                                            onChooseFromLibrary(stepId)
                                        }
                                        className="h-11 gap-2 rounded-xl font-bold text-neutral-200 hover:bg-white/10 hover:text-white"
                                    >
                                        <ImageSquare size={18} />
                                        <span>{tc("chooseLibrary")}</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={camera.restart}
                                        className="h-11 rounded-xl font-bold text-neutral-400 hover:bg-white/10 hover:text-white"
                                    >
                                        {tc("tryAgain")}
                                    </Button>
                                </div>
                            </div>
                        ) : null}

                        {camera.status === "starting" ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80">
                                <div className="text-center">
                                    <div className="border-t-primary-300 mx-auto size-8 rounded-full border-2 border-neutral-700 motion-safe:animate-spin" />
                                    <p className="mt-3 text-sm font-semibold text-neutral-200">
                                        {tc("cameraStarting")}
                                    </p>
                                </div>
                            </div>
                        ) : null}

                        {showLive ? (
                            <CameraAperture
                                status={tc("readyForPhoto")}
                                frameLabel={t(step.shortKey)}
                                frameClassName={step.frameClassName}
                                showScanLine={false}
                                frameContent={
                                    <StepFrameGuide stepId={stepId} />
                                }
                            />
                        ) : null}

                        {preview?.issues?.length ? (
                            <ul className="absolute inset-x-3 top-3 z-30 space-y-1.5">
                                {preview.issues.map((issue) => (
                                    <li
                                        key={issue}
                                        className="flex items-start gap-2 rounded-xl bg-neutral-950/85 px-3 py-2 text-xs leading-relaxed text-neutral-100 ring-1 ring-white/10 backdrop-blur-sm"
                                    >
                                        <WarningCircle
                                            size={15}
                                            weight="bold"
                                            aria-hidden="true"
                                            className="text-warning-300 mt-0.5 shrink-0"
                                        />
                                        <span>{t(QUALITY_KEYS[issue])}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        {captureFailed ? (
                            <p
                                role="alert"
                                className="absolute inset-x-4 top-4 z-40 rounded-xl bg-neutral-950/90 px-3 py-2 text-center text-xs text-neutral-100"
                            >
                                {tc("cameraCaptureFailed")}
                            </p>
                        ) : null}
                    </div>

                    <footer className="px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-2">
                        {preview ? (
                            <div className="grid grid-cols-2 gap-2.5">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={clearPreview}
                                    className="h-14 gap-2 rounded-2xl bg-white/10 px-5 font-bold text-white hover:bg-white/15 hover:text-white"
                                >
                                    <ArrowCounterClockwise
                                        size={18}
                                        weight="bold"
                                    />
                                    <span>{tc("retake")}</span>
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleUsePhoto}
                                    className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 h-14 gap-2 rounded-2xl px-5 font-extrabold text-white"
                                >
                                    <Check size={18} weight="bold" />
                                    <span>{tc("usePhoto")}</span>
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                    {camera.status === "unavailable" ? (
                                        // The problem panel already offers the library and device camera.
                                        <span className="col-span-2" />
                                    ) : (
                                        <>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() =>
                                                    onChooseFromLibrary(stepId)
                                                }
                                                className="h-auto min-h-11 flex-col gap-1 justify-self-start rounded-xl px-2 py-1.5 text-xs font-bold text-neutral-300 hover:bg-white/10 hover:text-white"
                                            >
                                                <ImageSquare size={22} />
                                                <span>{t("libraryShort")}</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                disabled={
                                                    !showLive || isCapturing
                                                }
                                                onClick={handleCapture}
                                                aria-label={
                                                    isCapturing
                                                        ? tc("takingPhoto")
                                                        : tc("takePhoto")
                                                }
                                                className="group size-[4.75rem] rounded-full p-0 ring-4 ring-white/85 ring-offset-4 ring-offset-neutral-950 transition-transform hover:bg-transparent active:scale-95 disabled:opacity-40"
                                            >
                                                <span className="bg-primary-400 group-hover:bg-primary-300 size-full rounded-full transition-colors" />
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={handleSkip}
                                        className="h-11 gap-1 justify-self-end rounded-xl px-3 text-sm font-bold text-neutral-300 hover:bg-white/10 hover:text-white"
                                    >
                                        <span>
                                            {isLastOpenStep
                                                ? t("doneCapturing")
                                                : t("skipStep")}
                                        </span>
                                        {isLastOpenStep ? (
                                            <Check
                                                size={15}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <ArrowRight
                                                size={15}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </Button>
                                </div>
                                {camera.status !== "unavailable" ? (
                                    <div className="mt-2 flex justify-center">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() =>
                                                onUseDeviceCamera(stepId)
                                            }
                                            className="h-11 gap-1.5 rounded-xl px-3 text-xs font-semibold text-neutral-400 hover:bg-white/10 hover:text-white"
                                        >
                                            <DeviceMobileCamera size={15} />
                                            <span>{tc("useDeviceCamera")}</span>
                                        </Button>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </footer>
                </div>
            </DialogContent>
        </Dialog>
    )
}
