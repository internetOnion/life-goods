import { CameraIcon, WarningCircleIcon } from "@phosphor-icons/react"
import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type { CapturedPackagePhoto } from "./browserPackageCamera"
import type { CaptureStep } from "./captureRoute"
import type { CameraError, CameraState } from "./usePackageCaptureJourney"

type CameraStageProps = {
    step: Exclude<CaptureStep, "review">
    headingRef: RefObject<HTMLHeadingElement | null>
    photo: CapturedPackagePhoto | null
    cameraState: CameraState
    cameraReady: boolean
    cameraError: CameraError | null
    videoRef: RefObject<HTMLVideoElement | null>
    onCameraReady: () => void
    onCameraInterrupted: () => void
    onOpen: () => void
    onCapture: () => void
}

export function CameraStage({
    step,
    headingRef,
    photo,
    cameraState,
    cameraReady,
    cameraError,
    videoRef,
    onCameraReady,
    onCameraInterrupted,
    onOpen,
    onCapture,
}: CameraStageProps) {
    const { t } = useTranslation()
    const cameraVisible = cameraState === "opening" || cameraState === "live"
    const errorKey = cameraError ?? "capture"
    const showStartingState = !photo && !cameraError && cameraState === "idle"

    return (
        <div className="sm:mt-1">
            <div
                className="border-border relative left-1/2 h-[clamp(22rem,68svh,42rem)] w-screen -translate-x-1/2 overflow-hidden rounded-[1.75rem] border bg-black"
                data-testid="camera-stage"
            >
                <video
                    ref={videoRef}
                    className={
                        cameraVisible
                            ? "h-full w-full bg-black object-cover"
                            : "hidden"
                    }
                    aria-label={t("capture.camera.livePreview")}
                    autoPlay
                    muted
                    playsInline
                    onCanPlay={onCameraReady}
                    onEnded={onCameraInterrupted}
                    onError={onCameraInterrupted}
                />

                {!photo ? (
                    <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                        {t(`capture.${step}.title`)}
                    </h1>
                ) : null}

                {photo ? (
                    <img
                        className="h-full w-full object-cover"
                        src={photo.previewUrl}
                        alt={t(`capture.${step}.previewAlt`)}
                    />
                ) : null}

                <div
                    className="border-foreground/35 pointer-events-none absolute inset-[13%_10%] z-[1] rounded-[1.5rem] border border-dashed"
                    aria-hidden="true"
                />

                {cameraState === "live" ? (
                    <div className="absolute inset-x-0 bottom-10 z-10 grid justify-items-center gap-2 px-4">
                        <Button
                            type="button"
                            size="icon"
                            className="border-background size-16 rounded-full border-4 [&_svg]:size-6"
                            aria-label={t(
                                step === "front"
                                    ? "capture.camera.takeFront"
                                    : step === "back"
                                      ? "capture.camera.takeBack"
                                      : step === "close-up"
                                        ? "capture.camera.takeCloseUp"
                                        : "capture.camera.takeIngredients",
                            )}
                            disabled={!cameraReady}
                            onClick={onCapture}
                        >
                            <CameraIcon aria-hidden="true" weight="fill" />
                        </Button>
                        <p className="bg-background/60 rounded-lg px-3 py-1 text-center text-xs font-semibold backdrop-blur-sm">
                            {t(
                                cameraReady
                                    ? "capture.camera.ready"
                                    : "capture.camera.waiting",
                            )}
                        </p>
                    </div>
                ) : null}

                {cameraState === "opening" || showStartingState ? (
                    <p
                        className="bg-background/70 absolute top-1/2 left-1/2 w-fit max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-center font-semibold backdrop-blur-sm"
                        role="status"
                    >
                        {t("capture.camera.opening")}
                    </p>
                ) : null}
            </div>

            {cameraError ? (
                <Alert className="mt-4" variant="destructive" role="alert">
                    <WarningCircleIcon aria-hidden="true" weight="bold" />
                    <AlertTitle>
                        {t(`capture.camera.errors.${errorKey}Title`)}
                    </AlertTitle>
                    <AlertDescription>
                        {t(`capture.camera.errors.${errorKey}Body`)}
                    </AlertDescription>
                </Alert>
            ) : null}

            {!photo &&
            cameraError &&
            cameraState !== "live" &&
            cameraState !== "opening" ? (
                <Button className="mt-4 w-full" type="button" onClick={onOpen}>
                    <CameraIcon aria-hidden="true" weight="bold" />
                    {t("capture.camera.tryAgain")}
                </Button>
            ) : null}
        </div>
    )
}
