import {
    ArrowLeftIcon,
    CameraIcon,
    CheckIcon,
    LockKeyIcon,
    TreePalmIcon,
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
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[calc(1rem_+_env(safe-area-inset-top))] pb-[calc(1rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                {step === "front" ? (
                    <span />
                ) : (
                    <Button
                        variant="ghost"
                        className="h-auto min-w-0 justify-self-start px-2 leading-relaxed whitespace-normal sm:-ml-3 sm:px-3"
                        type="button"
                        onClick={actions.goBack}
                    >
                        <ArrowLeftIcon aria-hidden="true" weight="bold" />
                        {t("capture.backAction")}
                    </Button>
                )}
                <LanguageSwitchButton />
                <Button
                    variant="ghost"
                    className="h-auto min-w-0 justify-self-end px-2 text-end leading-relaxed whitespace-normal sm:-mr-3 sm:px-3"
                    type="button"
                    onClick={actions.exitCapture}
                >
                    <XIcon aria-hidden="true" weight="bold" />
                    {t("capture.exit")}
                </Button>
            </div>

            {isReview ? (
                <>
                    <section className="relative pt-6 sm:pt-7">
                        <TreePalmIcon
                            className="text-primary/15 pointer-events-none absolute top-5 right-0 size-16 -rotate-12 sm:size-20"
                            aria-hidden="true"
                            weight="thin"
                        />
                        <div className="relative z-10">
                            <h1
                                ref={headingRef}
                                tabIndex={-1}
                                className="max-w-[18ch] text-[clamp(1.75rem,7vw,2.75rem)] leading-[1.7] font-bold tracking-[-0.025em] text-balance"
                            >
                                {title}
                            </h1>
                            <p className="text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
                                {t("capture.review.body")}
                            </p>
                        </div>
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
                        instruction={t(`capture.${step}.body`)}
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
                    <div
                        className="border-border bg-muted mt-4 grid grid-cols-2 gap-1 rounded-xl border p-1"
                        aria-label={t("capture.method.label")}
                    >
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
                        <div className="border-border bg-background sticky bottom-0 z-10 mt-5 flex flex-wrap gap-3 border-t py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
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
