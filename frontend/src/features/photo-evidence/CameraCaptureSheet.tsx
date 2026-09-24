import {
    ArrowCounterClockwise,
    Camera,
    Check,
    ImageSquare,
    Lightbulb,
    WarningCircle,
    X,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"

import { CameraAperture } from "@/components/camera/CameraAperture"
import { GlassButton as Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
    useCompareTranslation,
    type CompareTranslationKey,
} from "./translations"
import {
    captureVideoFrame,
    hasVideoDimensions,
    useCameraStream,
    type CameraStreamProblem,
} from "./useCameraStream"

type CameraState = "starting" | "ready" | "captured" | "unavailable" | "error"
type CapturePhase = "captured" | "error" | null

export interface CameraCaptureSheetProps {
    isOpen: boolean
    productTitle: string
    productNumber: "1" | "2"
    onClose: () => void
    onCapture: (file: File) => void
    onUseDeviceCamera: () => void
    onChooseFromLibrary: () => void
}

function revokePreview(url: string | null) {
    if (url) URL.revokeObjectURL(url)
}

const PROBLEM_MESSAGE_KEYS: Record<CameraStreamProblem, CompareTranslationKey> =
    {
        unavailable: "cameraUnavailable",
        did_not_start: "cameraDidNotStart",
        denied: "cameraDenied",
    }

export function CameraCaptureSheet({
    isOpen,
    productTitle,
    productNumber,
    onClose,
    onCapture,
    onUseDeviceCamera,
    onChooseFromLibrary,
}: CameraCaptureSheetProps) {
    const { t } = useCompareTranslation()
    const videoRef = useRef<HTMLVideoElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const captureRunRef = useRef(0)
    const previewUrlRef = useRef<string | null>(null)
    const camera = useCameraStream(videoRef, { active: isOpen })
    const [phase, setPhase] = useState<CapturePhase>(null)
    const [captureError, setCaptureError] = useState<string | null>(null)
    const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isCapturing, setIsCapturing] = useState(false)

    useEffect(() => {
        captureRunRef.current += 1
        setPreviewBlob(null)
        revokePreview(previewUrlRef.current)
        previewUrlRef.current = null
        setPreviewUrl(null)
        setIsCapturing(false)
        setPhase(null)
        setCaptureError(null)
    }, [isOpen])

    const cameraState: CameraState = phase ?? camera.status
    const isVideoReady = camera.isVideoReady
    const cameraError =
        phase === "error"
            ? captureError
            : camera.problem
              ? t(PROBLEM_MESSAGE_KEYS[camera.problem])
              : null

    const handleClose = () => {
        captureRunRef.current += 1
        camera.release()
        onClose()
    }

    const handleRestartCamera = () => {
        captureRunRef.current += 1
        setIsCapturing(false)
        setPhase(null)
        setCaptureError(null)
        camera.restart()
    }

    const handleRetake = () => {
        revokePreview(previewUrlRef.current)
        previewUrlRef.current = null
        setPreviewBlob(null)
        setPreviewUrl(null)
        handleRestartCamera()
    }

    const failCapture = (key: CompareTranslationKey) => {
        setPhase("error")
        setCaptureError(t(key))
    }

    const handleCapture = () => {
        const video = videoRef.current
        if (!video || !isVideoReady || !hasVideoDimensions(video)) {
            failCapture("cameraStillStarting")
            return
        }

        const captureRun = ++captureRunRef.current
        setIsCapturing(true)
        captureVideoFrame(video).then(
            (blob) => {
                if (captureRun !== captureRunRef.current) return
                setIsCapturing(false)
                if (!blob) {
                    failCapture("cameraCaptureFailed")
                    return
                }

                revokePreview(previewUrlRef.current)
                const nextPreviewUrl = URL.createObjectURL(blob)
                previewUrlRef.current = nextPreviewUrl
                setPreviewBlob(blob)
                setPreviewUrl(nextPreviewUrl)
                setPhase("captured")
                camera.release()
            },
            () => {
                if (captureRun !== captureRunRef.current) return
                setIsCapturing(false)
                failCapture("cameraCaptureFailed")
            },
        )
    }

    const handleUsePhoto = () => {
        if (!previewBlob) return

        onCapture(
            new File([previewBlob], `product-${productNumber}-label.jpg`, {
                type: "image/jpeg",
            }),
        )
        handleClose()
    }

    if (!isOpen) return null

    const showLiveCamera = cameraState === "ready" && isVideoReady
    const showUnavailable = cameraState === "unavailable"
    const showCaptureError = cameraState === "error"
    const showPreview = cameraState === "captured" && previewUrl

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="bg-primary-100 text-primary-800 flex size-9 shrink-0 items-center justify-center rounded-xl">
                                <Camera size={19} weight="bold" />
                            </span>
                            <div className="min-w-0">
                                <DialogTitle className="truncate text-sm font-extrabold text-neutral-950 sm:text-base">
                                    {t("captureProduct", {
                                        product: productTitle,
                                    })}
                                </DialogTitle>
                                <p className="font-mono text-xs text-neutral-500">
                                    {t("panelStep", { number: productNumber })}
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            ref={closeButtonRef}
                            onClick={handleClose}
                            aria-label={t("closeCamera")}
                            className="size-11 shrink-0 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                        >
                            <X size={20} weight="bold" />
                        </Button>
                    </header>

                    <div className="flex flex-1 flex-col justify-center gap-5 px-4 py-5 sm:px-8 sm:py-8">
                        <div className="relative isolate min-h-[min(46vh,24rem)] overflow-hidden rounded-3xl bg-neutral-950 text-white shadow-[0_16px_40px_-24px_rgba(19,21,25,0.8)] ring-1 ring-neutral-800 sm:min-h-[min(50vh,28rem)]">
                            <video
                                ref={videoRef}
                                muted
                                playsInline
                                autoPlay
                                aria-label={t("livePreview")}
                                className={cn(
                                    "absolute inset-0 block h-full w-full object-cover transition-opacity duration-300",
                                    showLiveCamera || isCapturing
                                        ? "opacity-100"
                                        : "opacity-0",
                                )}
                            />

                            {showPreview && (
                                <img
                                    src={previewUrl}
                                    alt={t("capturedPreview", {
                                        product: productTitle,
                                    })}
                                    className="absolute inset-0 size-full bg-neutral-900 object-contain"
                                />
                            )}

                            {showUnavailable && (
                                <div className="absolute inset-0 flex min-h-[min(46vh,24rem)] flex-col items-center justify-center px-8 text-center">
                                    <span className="text-primary-300 flex size-16 items-center justify-center rounded-2xl bg-neutral-800">
                                        <Camera size={30} weight="bold" />
                                    </span>
                                    <h3 className="mt-5 text-lg font-extrabold text-white">
                                        {t("cameraUnavailableTitle")}
                                    </h3>
                                    <p
                                        className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-300"
                                        role="alert"
                                    >
                                        {cameraError}
                                    </p>
                                </div>
                            )}

                            {showCaptureError && (
                                <div className="absolute inset-0 flex min-h-[min(46vh,24rem)] flex-col items-center justify-center bg-neutral-950/90 px-8 text-center">
                                    <span className="bg-error-950 text-error-300 ring-error-800 flex size-16 items-center justify-center rounded-2xl ring-1">
                                        <WarningCircle
                                            size={30}
                                            weight="bold"
                                        />
                                    </span>
                                    <h3 className="mt-5 text-lg font-extrabold text-white">
                                        {t("captureFailedTitle")}
                                    </h3>
                                    <p
                                        className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-300"
                                        role="alert"
                                    >
                                        {cameraError}
                                    </p>
                                </div>
                            )}

                            {cameraState === "starting" && !cameraError && (
                                <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80">
                                    <div className="text-center">
                                        <div className="border-t-primary-300 mx-auto size-8 animate-spin rounded-full border-2 border-neutral-700" />
                                        <p className="mt-3 text-sm font-semibold text-neutral-200">
                                            {t("cameraStarting")}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {showLiveCamera && (
                                <CameraAperture
                                    status={t("readyForPhoto")}
                                    frameLabel={t("frameLabel")}
                                />
                            )}

                            {showLiveCamera && (
                                <div className="absolute inset-x-4 bottom-4 z-30 flex items-center gap-2 rounded-2xl bg-neutral-950/80 px-3 py-2.5 text-xs text-neutral-200 backdrop-blur-sm sm:inset-x-8 sm:bottom-8 sm:px-4">
                                    <Lightbulb
                                        size={17}
                                        className="text-primary-300 shrink-0"
                                    />
                                    <span>{t("avoidGlare")}</span>
                                </div>
                            )}

                            {isCapturing && (
                                <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/70">
                                    <div className="text-center">
                                        <div className="border-t-primary-300 mx-auto size-8 animate-spin rounded-full border-2 border-neutral-700" />
                                        <p className="mt-3 text-sm font-semibold text-neutral-200">
                                            {t("takingPhoto")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-600">
                            <ImageSquare
                                size={18}
                                className="text-primary-600 mt-0.5 shrink-0"
                            />
                            <p>{t("onePhotoEnough")}</p>
                        </div>
                    </div>

                    <footer className="border-t border-neutral-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-5">
                        {showPreview ? (
                            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row-reverse sm:justify-start">
                                <Button
                                    type="button"
                                    onClick={handleUsePhoto}
                                    className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 h-12 gap-2 rounded-xl px-5 font-extrabold text-white"
                                >
                                    <Check size={18} weight="bold" />
                                    <span>{t("usePhoto")}</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleRetake}
                                    className="h-12 gap-2 rounded-xl border-neutral-300 bg-white px-5 font-bold text-neutral-800 hover:bg-neutral-50 hover:text-neutral-950"
                                >
                                    <ArrowCounterClockwise
                                        size={17}
                                        weight="bold"
                                    />
                                    <span>{t("retake")}</span>
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
                                <Button
                                    type="button"
                                    disabled={!showLiveCamera || isCapturing}
                                    onClick={handleCapture}
                                    className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 h-12 gap-2 rounded-xl px-5 font-extrabold text-white disabled:bg-neutral-200 disabled:text-neutral-400"
                                >
                                    <Camera size={19} weight="bold" />
                                    <span>
                                        {isCapturing
                                            ? t("takingPhoto")
                                            : t("takePhoto")}
                                    </span>
                                </Button>
                                {(showUnavailable || showCaptureError) && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleRestartCamera}
                                        className="h-12 rounded-xl border-neutral-300 bg-white px-4 font-bold text-neutral-800 hover:bg-neutral-50 hover:text-neutral-950"
                                    >
                                        {t("tryAgain")}
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onUseDeviceCamera}
                                    className="h-12 rounded-xl border-neutral-300 bg-white px-4 font-bold text-neutral-800 hover:bg-neutral-50 hover:text-neutral-950"
                                >
                                    {t("useDeviceCamera")}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onChooseFromLibrary}
                                    className="h-12 gap-2 rounded-xl px-4 font-bold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                                >
                                    <ImageSquare size={18} />
                                    <span>{t("chooseLibrary")}</span>
                                </Button>
                            </div>
                        )}
                    </footer>
                </div>
            </DialogContent>
        </Dialog>
    )
}
