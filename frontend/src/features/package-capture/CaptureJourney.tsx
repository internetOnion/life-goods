import {
    ArrowLeftIcon,
    CameraIcon,
    CheckIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

import { CameraStage } from "./CameraStage"
import { captureStepNumbers } from "./captureRoute"
import { ReviewStep } from "./ReviewStep"
import { usePackageCaptureJourney } from "./usePackageCaptureJourney"

export function CaptureJourney() {
    const { t } = useTranslation()
    const { step, photos, camera, headingRef, showReloadRecovery, actions } =
        usePackageCaptureJourney()
    const isReview = step === "review"
    const title = isReview
        ? t("capture.review.title")
        : t(`capture.${step}.title`)

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[calc(1rem_+_env(safe-area-inset-top))] pb-[calc(2rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <div className="flex items-center justify-between gap-3">
                {step === "front" ? (
                    <span />
                ) : (
                    <Button
                        variant="ghost"
                        className="px-2 sm:-ml-3 sm:px-3"
                        type="button"
                        onClick={actions.goBack}
                    >
                        <ArrowLeftIcon aria-hidden="true" weight="bold" />
                        {t("capture.back")}
                    </Button>
                )}
                <Button
                    variant="ghost"
                    className="px-2 sm:-mr-3 sm:px-3"
                    type="button"
                    onClick={actions.exitCapture}
                >
                    <XIcon aria-hidden="true" weight="bold" />
                    {t("capture.exit")}
                </Button>
            </div>

            <div
                className="border-border bg-muted mt-5 grid grid-cols-2 gap-1 rounded-xl border p-1"
                aria-label={t("capture.method.label")}
            >
                <div className="bg-background text-foreground flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-sm font-bold">
                    <CameraIcon aria-hidden="true" size={19} weight="bold" />
                    <span>{t("capture.method.capture")}</span>
                </div>
                <Button
                    variant="ghost"
                    className="h-auto min-h-11 rounded-lg px-2 leading-snug whitespace-normal"
                    type="button"
                    disabled
                >
                    {t("capture.method.barcode")}
                </Button>
            </div>

            <section className="pt-6 sm:pt-7">
                <p className="text-muted-foreground text-sm font-semibold">
                    {t("capture.step", {
                        current: captureStepNumbers[step],
                    })}
                </p>
                <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-2 text-[clamp(1.75rem,7vw,2.75rem)] leading-[1.55] font-bold tracking-[-0.025em] text-balance"
                >
                    {title}
                </h1>
                <p className="text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
                    {isReview
                        ? t("capture.review.body")
                        : t(`capture.${step}.body`)}
                </p>
            </section>

            {showReloadRecovery && step === "front" ? (
                <p
                    className="border-border bg-brand-soft mt-5 rounded-xl border px-4 py-3 text-sm leading-relaxed"
                    role="status"
                >
                    {t("capture.reloadRecovery")}
                </p>
            ) : null}

            {isReview && photos.front && photos.ingredients ? (
                <ReviewStep
                    frontPhoto={photos.front}
                    ingredientPhoto={photos.ingredients}
                    onStart={actions.startDemo}
                />
            ) : !isReview ? (
                <>
                    <CameraStage
                        step={step}
                        photo={photos.current}
                        cameraState={camera.state}
                        cameraReady={camera.ready}
                        cameraError={camera.error}
                        videoRef={camera.videoRef}
                        onCameraReady={actions.markCameraReady}
                        onCameraInterrupted={actions.handleCameraInterruption}
                        onOpen={() => void actions.openCamera()}
                        onCapture={() => void actions.takePhoto()}
                        onRetake={actions.retake}
                    />
                    {step === "ingredients" ? (
                        <p className="border-border mt-5 border-t pt-4 text-sm leading-relaxed">
                            {t("capture.ingredients.extra")}
                        </p>
                    ) : null}
                    {photos.current ? (
                        <Button
                            className="mt-6 w-full"
                            type="button"
                            onClick={actions.continueJourney}
                        >
                            <CheckIcon aria-hidden="true" weight="bold" />
                            {step === "front"
                                ? t("capture.continue")
                                : t("capture.reviewAction")}
                        </Button>
                    ) : null}
                </>
            ) : null}
        </main>
    )
}
