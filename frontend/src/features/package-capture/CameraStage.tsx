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
    photo: CapturedPackagePhoto | null
    cameraState: CameraState
    cameraReady: boolean
    cameraError: CameraError | null
    videoRef: RefObject<HTMLVideoElement | null>
    onCameraReady: () => void
    onCameraInterrupted: () => void
    onOpen: () => void
    onCapture: () => void
    onRetake: () => void
}

export function CameraStage({
    step,
    photo,
    cameraState,
    cameraReady,
    cameraError,
    videoRef,
    onCameraReady,
    onCameraInterrupted,
    onOpen,
    onCapture,
    onRetake,
}: CameraStageProps) {
    const { t } = useTranslation()
    const cameraVisible = cameraState === "opening" || cameraState === "live"
    const errorKey = cameraError ?? "capture"

    return (
        <div className="mt-5 sm:mt-6">
            <div className="border-border bg-muted relative h-[clamp(14rem,44svh,34rem)] overflow-hidden rounded-2xl border">
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

                {photo ? (
                    <img
                        className="h-full w-full object-cover"
                        src={photo.previewUrl}
                        alt={t(`capture.${step}.previewAlt`)}
                    />
                ) : !cameraVisible ? (
                    <div className="grid h-full place-items-center px-7 text-center">
                        <div>
                            <span className="bg-brand-soft text-primary mx-auto grid size-16 place-items-center rounded-full">
                                <CameraIcon
                                    aria-hidden="true"
                                    size={30}
                                    weight="regular"
                                />
                            </span>
                            <p className="text-muted-foreground mt-4 font-semibold">
                                {t("capture.camera.off")}
                            </p>
                            {!cameraError ? (
                                <Button
                                    className="mt-5 min-w-48"
                                    type="button"
                                    onClick={onOpen}
                                >
                                    <CameraIcon
                                        aria-hidden="true"
                                        weight="bold"
                                    />
                                    {t("capture.camera.open")}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {cameraState === "live" ? (
                    <div className="bg-background/95 absolute top-3 left-3 flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-sm font-bold">
                        <span
                            className="bg-primary size-2 rounded-full"
                            aria-hidden="true"
                        />
                        {t("capture.camera.active")}
                    </div>
                ) : null}

                {cameraState === "live" ? (
                    <div className="absolute inset-x-0 bottom-5 grid justify-items-center gap-2 px-4">
                        <Button
                            type="button"
                            size="icon"
                            className="border-background size-16 rounded-full border-4 shadow-[0_8px_22px_oklch(0.2_0.02_160/0.24)] [&_svg]:size-6"
                            aria-label={t(
                                step === "front"
                                    ? "capture.camera.takeFront"
                                    : "capture.camera.takeIngredients",
                            )}
                            disabled={!cameraReady}
                            onClick={onCapture}
                        >
                            <CameraIcon aria-hidden="true" weight="fill" />
                        </Button>
                        <p className="bg-background/95 rounded-lg px-3 py-1 text-center text-xs font-semibold">
                            {t(
                                cameraReady
                                    ? "capture.camera.ready"
                                    : "capture.camera.waiting",
                            )}
                        </p>
                    </div>
                ) : null}

                {cameraState === "opening" ? (
                    <p
                        className="bg-background/95 absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-center font-semibold"
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

            {photo ? (
                <Button
                    className="mt-4 w-full"
                    variant="outline"
                    type="button"
                    onClick={onRetake}
                >
                    <CameraIcon aria-hidden="true" weight="bold" />
                    {t(`capture.${step}.retake`)}
                </Button>
            ) : cameraError &&
              cameraState !== "live" &&
              cameraState !== "opening" ? (
                <Button className="mt-4 w-full" type="button" onClick={onOpen}>
                    <CameraIcon aria-hidden="true" weight="bold" />
                    {t(
                        cameraError
                            ? "capture.camera.tryAgain"
                            : "capture.camera.open",
                    )}
                </Button>
            ) : null}
        </div>
    )
}
