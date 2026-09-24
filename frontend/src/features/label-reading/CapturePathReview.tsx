import {
    Camera,
    Check,
    ImageSquare,
    MagnifyingGlassPlus,
    Plus,
    Trash,
    WarningCircle,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
    CAPTURE_STEPS,
    QUALITY_KEYS,
    nextRequiredStep,
    type CaptureStep,
    type CaptureStepId,
    type StepPhoto,
    type StepPhotos,
} from "./captureSteps"
import { useLabelReadingTranslation } from "./translations"

export interface CapturePathReviewProps {
    photos: StepPhotos
    disabled: boolean
    onOpenCamera: (step: CaptureStepId) => void
    onChooseFromLibrary: (step: CaptureStepId) => void
    onRemove: (step: CaptureStepId) => void
    onInspect: (step: CaptureStepId) => void
    onPreviewError: (step: CaptureStepId) => void
}

/**
 * The capture path after the camera closes: each step as a row on one line,
 * with its photo and hints, and the next required step marked as up next.
 */
export function CapturePathReview({
    photos,
    disabled,
    onOpenCamera,
    onChooseFromLibrary,
    onRemove,
    onInspect,
    onPreviewError,
}: CapturePathReviewProps) {
    const { t } = useLabelReadingTranslation()
    const taken = new Set(
        CAPTURE_STEPS.filter((step) => photos[step.id]).map((step) => step.id),
    )
    const upNext = nextRequiredStep(taken)

    return (
        <section aria-labelledby="capture-review-title" className="mt-6">
            <h2
                id="capture-review-title"
                className="text-xl font-extrabold tracking-[-0.02em] text-neutral-950"
            >
                {t("reviewTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                {t("reviewBody")}
            </p>

            <ol aria-label={t("captureStepsLabel")} className="mt-5">
                {CAPTURE_STEPS.map((step, index) => (
                    <PathRow
                        key={step.id}
                        step={step}
                        index={index}
                        photo={photos[step.id]}
                        isUpNext={step.id === upNext}
                        isLast={index === CAPTURE_STEPS.length - 1}
                        disabled={disabled}
                        onOpenCamera={() => onOpenCamera(step.id)}
                        onChooseFromLibrary={() => onChooseFromLibrary(step.id)}
                        onRemove={() => onRemove(step.id)}
                        onInspect={() => onInspect(step.id)}
                        onPreviewError={() => onPreviewError(step.id)}
                    />
                ))}
            </ol>
        </section>
    )
}

interface PathRowProps {
    step: CaptureStep
    index: number
    photo: StepPhoto | undefined
    isUpNext: boolean
    isLast: boolean
    disabled: boolean
    onOpenCamera: () => void
    onChooseFromLibrary: () => void
    onRemove: () => void
    onInspect: () => void
    onPreviewError: () => void
}

function PathRow({
    step,
    index,
    photo,
    isUpNext,
    isLast,
    disabled,
    onOpenCamera,
    onChooseFromLibrary,
    onRemove,
    onInspect,
    onPreviewError,
}: PathRowProps) {
    const { t } = useLabelReadingTranslation()
    const title = t(step.titleKey)
    const titleId = `capture-step-${step.id}-title`
    const canPreview = photo && !photo.previewError && !photo.previewUnsupported

    return (
        <li
            aria-labelledby={titleId}
            data-testid={`capture-step-${step.id}`}
            className="flex gap-3.5"
        >
            <div className="flex flex-col items-center">
                <span
                    className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold",
                        photo?.previewError
                            ? "bg-error-50 text-error-700 ring-error-300 ring-1"
                            : photo
                              ? "bg-primary-600 text-white"
                              : isUpNext
                                ? "ring-primary-500 text-primary-800 bg-white ring-2"
                                : step.optional
                                  ? "border-primary-300 text-primary-800 border border-dashed bg-white"
                                  : "bg-neutral-100 text-neutral-600",
                    )}
                >
                    {photo && !photo.previewError ? (
                        <Check size={15} weight="bold" aria-hidden="true" />
                    ) : (
                        index + 1
                    )}
                </span>
                {isLast ? null : (
                    <span
                        aria-hidden="true"
                        className={cn(
                            "my-1 w-0.5 flex-1 rounded-full",
                            photo ? "bg-primary-300" : "bg-neutral-200",
                        )}
                    />
                )}
            </div>

            <div className={cn("min-w-0 flex-1", isLast ? "pb-1" : "pb-6")}>
                <div className="flex flex-wrap items-baseline gap-x-2 pt-1">
                    <h3
                        id={titleId}
                        className="text-sm font-extrabold text-neutral-950"
                    >
                        {title}
                    </h3>
                    {step.optional ? (
                        <span className="text-xs font-semibold text-neutral-500">
                            {t("stepOptional")}
                        </span>
                    ) : null}
                    {isUpNext && !photo ? (
                        <span className="text-primary-800 text-xs font-bold">
                            {t("upNext")}
                        </span>
                    ) : null}
                </div>

                {photo ? (
                    <div className="mt-2.5 flex gap-3">
                        <div className="grid size-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
                            {canPreview ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onInspect}
                                    className="relative size-full rounded-none p-0"
                                    aria-label={t("stepPhotoAlt", {
                                        step: title,
                                    })}
                                >
                                    <img
                                        src={photo.url}
                                        alt=""
                                        onError={onPreviewError}
                                        className="size-full object-cover"
                                    />
                                    <MagnifyingGlassPlus
                                        size={16}
                                        weight="bold"
                                        aria-hidden="true"
                                        className="absolute right-1 bottom-1 text-white drop-shadow"
                                    />
                                </Button>
                            ) : (
                                <span className="px-1.5 text-center text-xs leading-tight text-neutral-600">
                                    {photo.previewError
                                        ? title
                                        : t("stepPhotoUnsupportedPreview")}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            {photo.qualityIssues.length ? (
                                <ul className="mb-2 space-y-1">
                                    {photo.qualityIssues.map((issue) => (
                                        <li
                                            key={issue}
                                            className="text-warning-900 flex items-start gap-1.5 text-xs leading-relaxed"
                                        >
                                            <WarningCircle
                                                size={14}
                                                weight="bold"
                                                aria-hidden="true"
                                                className="text-warning-700 mt-0.5 shrink-0"
                                            />
                                            <span>
                                                {t(QUALITY_KEYS[issue])}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            <div className="flex flex-wrap gap-1.5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={onOpenCamera}
                                    className="h-10 gap-1.5 rounded-xl px-3 text-xs font-bold"
                                >
                                    <Camera
                                        size={15}
                                        weight="bold"
                                        aria-hidden="true"
                                    />
                                    <span>{t("retakeStepPhoto")}</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={disabled}
                                    onClick={onRemove}
                                    aria-label={t("removeStepPhoto", {
                                        step: title,
                                    })}
                                    className="size-10 rounded-xl text-neutral-500 hover:text-neutral-900"
                                >
                                    <Trash size={15} aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : step.optional && !isUpNext ? (
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={disabled}
                        onClick={onOpenCamera}
                        className="text-primary-800 hover:bg-primary-50 hover:text-primary-900 mt-1.5 -ml-2 h-10 gap-1.5 rounded-xl px-2 text-xs font-bold"
                    >
                        <Plus size={14} weight="bold" aria-hidden="true" />
                        <span>{t("addSidePanel")}</span>
                    </Button>
                ) : (
                    <>
                        <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                            {t(step.tipKey)}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <Button
                                type="button"
                                variant={isUpNext ? "default" : "outline"}
                                disabled={disabled}
                                onClick={onOpenCamera}
                                className={cn(
                                    "h-10 gap-1.5 rounded-xl px-3 text-xs font-bold",
                                    isUpNext &&
                                        "bg-primary-600 hover:bg-primary-700 shadow-action-lift text-white",
                                )}
                            >
                                <Camera
                                    size={15}
                                    weight="bold"
                                    aria-hidden="true"
                                />
                                <span>
                                    {isUpNext
                                        ? t("continuePath")
                                        : t("takeStepPhoto")}
                                </span>
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={disabled}
                                onClick={onChooseFromLibrary}
                                className="h-10 gap-1.5 rounded-xl px-3 text-xs font-bold text-neutral-700"
                            >
                                <ImageSquare size={15} aria-hidden="true" />
                                <span>{t("chooseStepPhoto")}</span>
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </li>
    )
}
