import {
    ArrowLeftIcon,
    CameraIcon,
    CheckIcon,
    LockKeyIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { LanguageSwitchButton } from "@/ui/LanguageSwitchButton"

import { CameraStage } from "./CameraStage"
import { captureStepNumbers } from "./captureRoute"
import { ReviewStep } from "./ReviewStep"
import { usePackageCaptureJourney } from "./usePackageCaptureJourney"

export function CaptureJourney() {
    const { t } = useTranslation()
    const {
        step,
        photos,
        ingredientDecision,
        camera,
        headingRef,
        showReloadRecovery,
        actions,
    } = usePackageCaptureJourney()
    const isReview = step === "review"
    const isCloseUp = step === "close-up"
    const title = isReview
        ? t("capture.review.title")
        : t(`capture.${step}.title`)

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[calc(1rem_+_env(safe-area-inset-top))] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <div className="flex items-start justify-between gap-2">
                <Button
                    variant="ghost"
                    className="h-auto min-w-0 justify-self-start px-2 leading-relaxed whitespace-normal sm:-ml-3 sm:px-3"
                    type="button"
                    onClick={actions.exitCapture}
                >
                    <XIcon aria-hidden="true" weight="bold" />
                    {t("capture.exit")}
                </Button>
                <div className="flex items-start gap-2">
                    {step === "front" ? null : (
                        <Button
                            variant="ghost"
                            className="h-auto min-w-0 justify-self-end px-2 text-end leading-relaxed whitespace-normal sm:-mr-3 sm:px-3"
                            type="button"
                            onClick={actions.goBack}
                        >
                            <ArrowLeftIcon aria-hidden="true" weight="bold" />
                            {t("capture.backAction")}
                        </Button>
                    )}
                    <LanguageSwitchButton shape="rectangle" />
                </div>
            </div>

            {isReview ? (
                <>
                    <section className="pt-4 text-center sm:pt-5">
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-[clamp(1.5rem,6vw,2.25rem)] leading-[1.55] font-bold tracking-[-0.02em] text-balance !outline-none"
                        >
                            {title}
                        </h1>
                        <p className="text-muted-foreground mx-auto mt-2 max-w-[52ch] leading-relaxed">
                            {t("capture.review.body")}
                        </p>
                    </section>
                    <ReviewStep
                        frontPhoto={photos.front}
                        backPhoto={photos.back}
                        ingredientPhoto={photos.ingredients}
                        ingredientDecision={ingredientDecision}
                        onEdit={actions.editStep}
                        onStart={actions.startDemo}
                    />
                </>
            ) : (
                <>
                    <CameraStage
                        step={step}
                        headingRef={headingRef}
                        title={title}
                        stepLabel={
                            isCloseUp
                                ? t("capture.followUpStep")
                                : t("capture.step", {
                                      current: captureStepNumbers[step],
                                  })
                        }
                        photo={photos.current}
                        cameraState={camera.state}
                        cameraReady={camera.ready}
                        cameraError={camera.error}
                        videoRef={camera.videoRef}
                        onCameraReady={actions.markCameraReady}
                        onCameraInterrupted={actions.handleCameraInterruption}
                        onOpen={() => void actions.openCamera()}
                        onCapture={() => void actions.takePhoto()}
                    />
                    {showReloadRecovery && step === "front" ? (
                        <p
                            className="border-border bg-brand-soft mt-5 rounded-xl border px-4 py-3 text-sm leading-relaxed"
                            role="status"
                        >
                            {t("capture.reloadRecovery")}
                        </p>
                    ) : null}
                    <div className="border-border bg-muted mt-4 grid grid-cols-2 gap-1 rounded-xl border p-1">
                        <Button
                            variant="ghost"
                            className="h-auto min-h-11 min-w-0 justify-center gap-2 rounded-lg px-2 leading-snug whitespace-normal"
                            type="button"
                            disabled
                        >
                            <span>{t("capture.method.barcode")}</span>
                            <span className="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 text-xs font-semibold">
                                {t("capture.method.soon")}
                            </span>
                        </Button>
                        <div className="bg-background text-foreground flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-sm font-bold">
                            <CameraIcon
                                aria-hidden="true"
                                size={19}
                                weight="bold"
                            />
                            <span>{t("capture.method.capture")}</span>
                        </div>
                    </div>
                    {isCloseUp ? (
                        <div className="border-border bg-brand-soft mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed">
                            <LockKeyIcon
                                className="text-primary mt-0.5 shrink-0"
                                aria-hidden="true"
                                size={21}
                                weight="bold"
                            />
                            <p>{t("capture.close-up.privacy")}</p>
                        </div>
                    ) : null}
                    {step === "ingredients" ? (
                        <p className="border-border mt-5 border-t pt-4 text-sm leading-relaxed">
                            {t("capture.ingredients.extra")}
                        </p>
                    ) : null}
                    {photos.current || step === "ingredients" ? (
                        <div className="border-border bg-background sticky bottom-[calc(5rem_+_env(safe-area-inset-bottom))] z-10 mt-5 flex flex-wrap gap-3 border-t py-3">
                            {step === "ingredients" && !photos.current ? (
                                <Button
                                    className="min-w-0 flex-1"
                                    variant="outline"
                                    type="button"
                                    onClick={actions.skipIngredients}
                                >
                                    {t("capture.ingredients.skip")}
                                </Button>
                            ) : null}
                            {photos.current ? (
                                <Button
                                    className="min-w-0 flex-1"
                                    variant="outline"
                                    type="button"
                                    onClick={actions.retake}
                                >
                                    <CameraIcon
                                        aria-hidden="true"
                                        weight="bold"
                                    />
                                    {t(`capture.${step}.retake`)}
                                </Button>
                            ) : null}
                            {photos.current ? (
                                <Button
                                    className="min-w-0 flex-1"
                                    type="button"
                                    onClick={actions.continueJourney}
                                >
                                    <CheckIcon
                                        aria-hidden="true"
                                        weight="bold"
                                    />
                                    {step === "close-up"
                                        ? t("capture.close-up.continue")
                                        : step === "ingredients"
                                          ? t("capture.reviewAction")
                                          : t("capture.continue")}
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </>
            )}
        </main>
    )
}
