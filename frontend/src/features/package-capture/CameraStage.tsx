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
    title: string
    instruction: string
    stepLabel: string
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
    title,
    instruction,
    stepLabel,
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

    return (
        <div className="mt-5 sm:mt-6">
            <div className="border-border bg-muted relative h-[clamp(22rem,68svh,42rem)] overflow-hidden rounded-[1.75rem] border">
                <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
                    <div className="bg-background/90 text-foreground max-w-[75%] rounded-2xl px-3 py-2 backdrop-blur-sm">
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-sm leading-snug font-bold text-balance !outline-none"
                        >
                            {title}
                        </h1>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                            {instruction}
                        </p>
                    </div>
                    <span className="bg-background/90 text-muted-foreground shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                        {stepLabel}
                    </span>
                </div>

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

                <div
                    className="border-foreground/35 pointer-events-none absolute inset-[13%_10%] z-[1] rounded-[1.5rem] border border-dashed"
                    aria-hidden="true"
                />

                {cameraState === "live" ? (
                    <div className="bg-background/95 absolute top-24 left-3 flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-sm font-bold sm:top-28 sm:left-4">
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

            {!photo &&
            cameraError &&
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
