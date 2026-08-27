import { CheckIcon, LockKeyIcon, PencilSimpleIcon } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

import type { CapturedPackagePhoto } from "./browserPackageCamera"

type ReviewStepProps = {
    frontPhoto: CapturedPackagePhoto | null
    backPhoto: CapturedPackagePhoto | null
    ingredientPhoto: CapturedPackagePhoto | null
    ingredientDecision: "pending" | "captured" | "skipped"
    onEdit: (step: "front" | "back" | "ingredients") => void
    onStart: () => void
}

export function ReviewStep({
    frontPhoto,
    backPhoto,
    ingredientPhoto,
    ingredientDecision,
    onEdit,
    onStart,
}: ReviewStepProps) {
    const { t } = useTranslation()
    const requiredPhotos = [
        {
            step: "front" as const,
            photo: frontPhoto,
            label: t("capture.review.frontLabel"),
            alt: t("capture.front.previewAlt"),
        },
        {
            step: "back" as const,
            photo: backPhoto,
            label: t("capture.review.backLabel"),
            alt: t("capture.back.previewAlt"),
        },
    ]

    return (
        <div className="mt-6">
            <div className="grid grid-cols-2 gap-3">
                {requiredPhotos.map(({ step, photo, label, alt }) => (
                    <ReviewPhoto
                        key={step}
                        photo={photo}
                        label={label}
                        alt={alt}
                        onEdit={() => onEdit(step)}
                    />
                ))}
            </div>

            <div className="border-border bg-muted mt-3 flex items-center gap-3 rounded-xl border p-3">
                {ingredientPhoto ? (
                    <ReviewImage
                        className="border-border size-20 rounded-lg border object-cover"
                        src={ingredientPhoto.previewUrl}
                        alt={t("capture.ingredients.previewAlt")}
                        fallbackLabel={t("capture.review.imageUnavailable")}
                    />
                ) : (
                    <span className="bg-brand-soft text-primary grid size-20 shrink-0 place-items-center rounded-lg">
                        <PencilSimpleIcon aria-hidden="true" size={25} />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <p className="font-bold">
                        {t("capture.review.ingredientsLabel")}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {ingredientDecision === "skipped"
                            ? t("capture.review.notProvided")
                            : t("capture.review.ingredientsReady")}
                    </p>
                </div>
                <Button
                    className="min-h-11 shrink-0 px-3"
                    variant="outline"
                    type="button"
                    onClick={() => onEdit("ingredients")}
                >
                    {ingredientPhoto
                        ? t("capture.review.edit")
                        : t("capture.review.add")}
                </Button>
            </div>

            <div className="border-border bg-brand-soft mt-6 rounded-xl border p-4">
                <div className="flex items-start gap-3">
                    <LockKeyIcon
                        className="text-primary mt-0.5 shrink-0"
                        aria-hidden="true"
                        size={22}
                        weight="bold"
                    />
                    <div className="space-y-2 text-sm leading-relaxed">
                        <p className="font-bold">
                            {t("capture.review.privacy")}
                        </p>
                        <p>{t("capture.review.future")}</p>
                    </div>
                </div>
            </div>

            <Button className="mt-6 w-full" type="button" onClick={onStart}>
                <CheckIcon aria-hidden="true" weight="bold" />
                {t("capture.review.start")}
            </Button>
        </div>
    )
}

function ReviewPhoto({
    photo,
    label,
    alt,
    onEdit,
}: {
    photo: CapturedPackagePhoto | null
    label: string
    alt: string
    onEdit: () => void
}) {
    const { t } = useTranslation()

    return (
        <figure className="min-w-0">
            {photo ? (
                <ReviewImage
                    className="border-border aspect-[4/5] w-full rounded-xl border object-cover"
                    src={photo.previewUrl}
                    alt={alt}
                    fallbackLabel={t("capture.review.imageUnavailable")}
                />
            ) : (
                <div className="border-border bg-muted text-muted-foreground grid aspect-[4/5] place-items-center rounded-xl border p-3 text-center text-sm">
                    —
                </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
                <figcaption className="min-w-0 text-sm font-bold wrap-anywhere">
                    {label}
                </figcaption>
                <Button
                    className="size-11 shrink-0 p-0"
                    variant="ghost"
                    type="button"
                    onClick={onEdit}
                >
                    <PencilSimpleIcon aria-hidden="true" />
                    <span className="sr-only">
                        {t("capture.review.editLabel", { label })}
                    </span>
                </Button>
            </div>
        </figure>
    )
}

function ReviewImage({
    src,
    alt,
    fallbackLabel,
    className,
}: {
    src: string
    alt: string
    fallbackLabel: string
    className: string
}) {
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        setFailed(false)
    }, [src])

    if (failed) {
        return (
            <div
                className={`border-border bg-muted text-muted-foreground grid place-items-center rounded-lg border p-3 text-center text-sm leading-snug ${className}`}
                role="img"
                aria-label={fallbackLabel}
            >
                {fallbackLabel}
            </div>
        )
    }

    return (
        <img
            className={className}
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
        />
    )
}
