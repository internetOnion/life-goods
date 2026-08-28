import { CameraIcon, CheckIcon, LockKeyIcon } from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

import { CameraStage } from "./CameraStage"
import { CaptureProgress } from "./CaptureProgress"
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
    const title = t("capture.review.title")

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[env(safe-area-inset-top)] pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            {isReview ? (
                <>
                    <section className="pt-4 text-start sm:pt-5">
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-[clamp(1.5rem,6vw,2.25rem)] leading-[1.55] font-bold tracking-[-0.02em] text-balance !outline-none"
                        >
                            {title}
                        </h1>
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
                    {!isCloseUp ? (
                        <CaptureProgress
                            step={step}
                            hasFrontPhoto={photos.front !== null}
                            hasBackPhoto={photos.back !== null}
                            ingredientDecision={ingredientDecision}
                        />
                    ) : null}
                    {showReloadRecovery && step === "front" ? (
                        <p
                            className="border-border bg-brand-soft mt-5 rounded-xl border px-4 py-3 text-sm leading-relaxed"
                            role="status"
                        >
                            {t("capture.reloadRecovery")}
                        </p>
                    ) : null}
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
                        <div className="border-border bg-background sticky bottom-[env(safe-area-inset-bottom)] z-10 mt-5 flex flex-wrap gap-3 border-t py-3">
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
