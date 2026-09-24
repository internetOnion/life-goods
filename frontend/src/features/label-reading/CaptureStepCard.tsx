import {
    Camera,
    ImageSquare,
    MagnifyingGlassPlus,
    Trash,
    WarningCircle,
} from "@phosphor-icons/react"

import { GlassButton as Button } from "@/components/ui/button"
import type { PhotoQualityIssue } from "@/features/photo-evidence/imageQuality"
import type { ProductPhoto } from "@/features/photo-evidence/types"
import { cn } from "@/lib/utils"

import type { CaptureStep } from "./captureSteps"
import {
    useLabelReadingTranslation,
    type LabelReadingTranslationKey,
} from "./translations"

export interface StepPhoto extends ProductPhoto {
    qualityIssues: PhotoQualityIssue[]
}

const QUALITY_KEYS: Record<PhotoQualityIssue, LabelReadingTranslationKey> = {
    dark: "qualityDark",
    blurry: "qualityBlurry",
    glare: "qualityGlare",
}

export interface CaptureStepCardProps {
    step: CaptureStep
    index: number
    photo: StepPhoto | undefined
    disabled: boolean
    onTakePhoto: () => void
    onChooseFromLibrary: () => void
    onRemove: () => void
    onInspect: () => void
    onPreviewError: () => void
}

export function CaptureStepCard({
    step,
    index,
    photo,
    disabled,
    onTakePhoto,
    onChooseFromLibrary,
    onRemove,
    onInspect,
    onPreviewError,
}: CaptureStepCardProps) {
    const { t } = useLabelReadingTranslation()
    const title = t(step.titleKey)
    const titleId = `capture-step-${step.id}`

    return (
        <li
            aria-labelledby={titleId}
            data-testid={`capture-step-${step.id}`}
            className={cn(
                "rounded-2xl border bg-white p-3 sm:p-4",
                photo?.previewError
                    ? "border-error-300"
                    : photo
                      ? "border-neutral-200"
                      : "border-dashed border-neutral-300",
            )}
        >
            <div className="flex gap-3">
                <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100 text-neutral-400 sm:size-24">
                    {photo &&
                    !photo.previewError &&
                    !photo.previewUnsupported ? (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onInspect}
                            className="group size-full rounded-none p-0"
                            aria-label={t("stepPhotoAlt", { step: title })}
                        >
                            <img
                                src={photo.url}
                                alt=""
                                onError={onPreviewError}
                                className="size-full object-cover"
                            />
                            <MagnifyingGlassPlus
                                size={18}
                                weight="bold"
                                aria-hidden="true"
                                className="absolute right-1.5 bottom-1.5 text-white opacity-80 drop-shadow"
                            />
                        </Button>
                    ) : photo ? (
                        <span className="px-2 text-center text-[0.7rem] leading-tight text-neutral-600">
                            {photo.previewError
                                ? title
                                : t("stepPhotoUnsupportedPreview")}
                        </span>
                    ) : (
                        <span className="font-mono text-lg font-bold">
                            {index + 1}
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
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
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                        {photo ? null : `${t("stepNotTaken")} · `}
                        {t(step.tipKey)}
                    </p>

                    {photo?.qualityIssues.length ? (
                        <ul className="mt-2 space-y-1">
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
                                    <span>{t(QUALITY_KEYS[issue])}</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <Button
                            type="button"
                            variant={photo ? "outline" : "default"}
                            disabled={disabled}
                            onClick={onTakePhoto}
                            className={cn(
                                "h-10 gap-1.5 rounded-xl px-3 text-xs font-bold",
                                !photo &&
                                    "bg-primary-600 hover:bg-primary-700 text-white",
                            )}
                        >
                            <Camera
                                size={15}
                                weight="bold"
                                aria-hidden="true"
                            />
                            <span>
                                {photo
                                    ? t("retakeStepPhoto")
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
                        {photo ? (
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
                        ) : null}
                    </div>
                </div>
            </div>
        </li>
    )
}
