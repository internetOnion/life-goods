import {
    ArrowCounterClockwise,
    Camera,
    Check,
    ImageSquare,
    Lightbulb,
    X,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"

import { CameraAperture } from "@/components/camera/CameraAperture"
import { GlassButton as Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useCompareTranslation } from "@/features/photo-evidence/translations"
import {
    captureVideoFrame,
    hasVideoDimensions,
    useCameraStream,
    type CameraResolution,
    type CameraStreamProblem,
} from "@/features/photo-evidence/useCameraStream"
import { cn } from "@/lib/utils"

import {
    CAPTURE_STEPS,
    captureStep,
    nextEmptyStep,
    type CaptureStepId,
} from "./captureSteps"
import { useLabelReadingTranslation } from "./translations"

/** Label text is small; ask for 4K and let the browser clamp to what it supports. */
const LABEL_CAMERA_RESOLUTION: CameraResolution = { width: 3840, height: 2160 }

const PROBLEM_KEYS = {
    unavailable: "cameraUnavailable",
    did_not_start: "cameraDidNotStart",
    denied: "cameraDenied",
} as const satisfies Record<CameraStreamProblem, string>

export interface GuidedCaptureSheetProps {
    isOpen: boolean
    stepId: CaptureStepId
    takenSteps: ReadonlySet<CaptureStepId>
    onStepChange: (step: CaptureStepId) => void
    onCapture: (step: CaptureStepId, file: File) => void
    onClose: () => void
    onUseDeviceCamera: (step: CaptureStepId) => void
    onChooseFromLibrary: (step: CaptureStepId) => void
}

export function GuidedCaptureSheet({
    isOpen,
    stepId,
    takenSteps,
    onStepChange,
    onCapture,
    onClose,
    onUseDeviceCamera,
    onChooseFromLibrary,
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
    const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(
        null,
    )
    const [isCapturing, setIsCapturing] = useState(false)
    const [captureFailed, setCaptureFailed] = useState(false)

    const clearPreview = () => {
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
                setPreview({ blob, url: URL.createObjectURL(blob) })
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
                className="inset-0 flex h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 grid-cols-1 flex-col gap-0 rounded-none border-0 bg-neutral-50/95 p-0 text-neutral-950 backdrop-blur-sm sm:p-5"
            >
                <div className="shadow-source-sheet mx-auto flex min-h-full w-full max-w-3xl flex-col overflow-hidden border border-neutral-200 bg-white sm:rounded-3xl">
                    <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-4 sm:px-6">
                        <div className="min-w-0">
                            <DialogTitle className="truncate text-sm font-extrabold text-neutral-950 sm:text-base">
                                {t("guidedCaptureTitle", { step: stepTitle })}
                            </DialogTitle>
                            <p className="font-mono text-xs text-neutral-500">
                                {t("guidedStepProgress", {
                                    current: stepIndex + 1,
                                    total: CAPTURE_STEPS.length,
                                })}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            ref={closeButtonRef}
                            onClick={onClose}
                            aria-label={tc("closeCamera")}
                            className="size-11 shrink-0 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                        >
                            <X size={20} weight="bold" />
                        </Button>
                    </header>

                    <ol
                        aria-label={t("captureStepsLabel")}
                        className="flex gap-1.5 px-4 pt-4 sm:px-8"
                    >
                        {CAPTURE_STEPS.map((candidate) => (
                            <li key={candidate.id} className="flex-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onStepChange(candidate.id)}
                                    aria-current={
                                        candidate.id === stepId
                                            ? "step"
                                            : undefined
                                    }
                                    className={cn(
                                        "flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border text-xs font-bold",
                                        candidate.id === stepId
                                            ? "border-primary-500 bg-primary-50 text-primary-900"
                                            : "border-neutral-200 bg-white text-neutral-600",
                                    )}
                                >
                                    {takenSteps.has(candidate.id) ? (
                                        <Check
                                            size={14}
                                            weight="bold"
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    <span className="truncate">
                                        {t(candidate.titleKey)}
                                    </span>
                                </Button>
                            </li>
                        ))}
                    </ol>

                    <div className="flex flex-1 flex-col justify-center gap-4 px-4 py-4 sm:px-8 sm:py-6">
                        <div className="relative isolate min-h-[min(52vh,28rem)] overflow-hidden rounded-3xl bg-neutral-950 text-white ring-1 ring-neutral-800">
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
                                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                                    <span className="text-primary-300 flex size-16 items-center justify-center rounded-2xl bg-neutral-800">
                                        <Camera size={30} weight="bold" />
                                    </span>
                                    <h3 className="mt-5 text-lg font-extrabold text-white">
                                        {tc("cameraUnavailableTitle")}
                                    </h3>
                                    <p
                                        className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-300"
                                        role="alert"
                                    >
                                        {cameraError}
                                    </p>
                                </div>
                            ) : null}

                            {camera.status === "starting" ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80">
                                    <div className="text-center">
                                        <div className="border-t-primary-300 mx-auto size-8 animate-spin rounded-full border-2 border-neutral-700" />
                                        <p className="mt-3 text-sm font-semibold text-neutral-200">
                                            {tc("cameraStarting")}
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {showLive ? (
                                <CameraAperture
                                    status={tc("readyForPhoto")}
                                    frameLabel={stepTitle}
                                    frameClassName={step.frameClassName}
                                    showScanLine={false}
                                />
                            ) : null}

                            {showLive || preview ? (
                                <div className="absolute inset-x-4 bottom-4 z-30 flex items-center gap-2 rounded-2xl bg-neutral-950/80 px-3 py-2.5 text-xs text-neutral-200 backdrop-blur-sm sm:inset-x-8 sm:bottom-8 sm:px-4">
                                    <Lightbulb
                                        size={17}
                                        className="text-primary-300 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <span>{t(step.tipKey)}</span>
                                </div>
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
                    </div>

                    <footer className="border-t border-neutral-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-5">
                        {preview ? (
                            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row-reverse sm:justify-start">
                                <Button
                                    type="button"
                                    onClick={handleUsePhoto}
                                    className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 h-12 gap-2 rounded-xl px-5 font-extrabold text-white"
                                >
                                    <Check size={18} weight="bold" />
                                    <span>{tc("usePhoto")}</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={clearPreview}
                                    className="h-12 gap-2 rounded-xl border-neutral-300 bg-white px-5 font-bold text-neutral-800 hover:bg-neutral-50 hover:text-neutral-950"
                                >
                                    <ArrowCounterClockwise
                                        size={17}
                                        weight="bold"
                                    />
                                    <span>{tc("retake")}</span>
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
                                <Button
                                    type="button"
                                    disabled={!showLive || isCapturing}
                                    onClick={handleCapture}
                                    className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 h-12 gap-2 rounded-xl px-5 font-extrabold text-white disabled:bg-neutral-200 disabled:text-neutral-400"
                                >
                                    <Camera size={19} weight="bold" />
                                    <span>
                                        {isCapturing
                                            ? tc("takingPhoto")
                                            : tc("takePhoto")}
                                    </span>
                                </Button>
                                {camera.status === "unavailable" ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={camera.restart}
                                        className="h-12 rounded-xl border-neutral-300 bg-white px-4 font-bold text-neutral-800"
                                    >
                                        {tc("tryAgain")}
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onUseDeviceCamera(stepId)}
                                    className="h-12 rounded-xl border-neutral-300 bg-white px-4 font-bold text-neutral-800 hover:bg-neutral-50 hover:text-neutral-950"
                                >
                                    {tc("useDeviceCamera")}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onChooseFromLibrary(stepId)}
                                    className="h-12 gap-2 rounded-xl px-4 font-bold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                                >
                                    <ImageSquare size={18} />
                                    <span>{tc("chooseLibrary")}</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleSkip}
                                    className="h-12 rounded-xl px-4 font-bold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                                >
                                    {nextEmptyStep(takenSteps, stepId, {
                                        wrap: false,
                                    }) === null
                                        ? t("doneCapturing")
                                        : t("skipStep")}
                                </Button>
                            </div>
                        )}
                    </footer>
                </div>
            </DialogContent>
        </Dialog>
    )
}
