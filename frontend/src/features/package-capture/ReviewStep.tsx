import {
    CheckIcon,
    LockKeyIcon,
    PencilSimpleIcon,
    SelectionIcon,
} from "@phosphor-icons/react"
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
    const photos = [
        {
            step: "front" as const,
            photo: frontPhoto,
            label: t("capture.review.frontLabel"),
            alt: t("capture.front.previewAlt"),
            status: t("capture.review.ingredientsReady"),
        },
        {
            step: "back" as const,
            photo: backPhoto,
            label: t("capture.review.backLabel"),
            alt: t("capture.back.previewAlt"),
            status: t("capture.review.ingredientsReady"),
        },
        {
            step: "ingredients" as const,
            photo: ingredientPhoto,
            label: t("capture.review.ingredientsLabel"),
            alt: t("capture.ingredients.previewAlt"),
            status:
                ingredientDecision === "skipped"
                    ? t("capture.review.notProvided")
                    : t("capture.review.ingredientsReady"),
        },
    ]
    const [selectedStep, setSelectedStep] = useState<
        "front" | "back" | "ingredients"
    >("front")
    const [mainImageFailed, setMainImageFailed] = useState(false)
    const selectedPhoto =
        photos.find(({ step }) => step === selectedStep) ?? photos[0]!

    useEffect(() => {
        setMainImageFailed(false)
    }, [selectedPhoto.photo?.previewUrl])

    return (
        <div className="mt-6 space-y-4 sm:mt-7">
            <section className="border-border bg-coconut-brown-soft relative overflow-hidden rounded-2xl border">
                <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3 sm:inset-x-5 sm:top-5">
                    <span className="bg-background/90 text-foreground max-w-[70%] rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
                        {selectedPhoto.label}
                    </span>
                    <span className="bg-background/90 text-muted-foreground rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums backdrop-blur-sm">
                        {photos.findIndex(({ step }) => step === selectedStep) +
                            1}{" "}
                        / {photos.length}
                    </span>
                </div>

                <div className="relative h-[clamp(20rem,58svh,38rem)] p-4 sm:h-[clamp(24rem,62svh,42rem)] sm:p-6">
                    {selectedPhoto.photo && !mainImageFailed ? (
                        <img
                            className="h-full w-full rounded-xl object-contain"
                            src={selectedPhoto.photo.previewUrl}
                            alt=""
                            aria-hidden="true"
                            onError={() => setMainImageFailed(true)}
                        />
                    ) : (
                        <div className="border-border bg-background/70 text-muted-foreground grid h-full place-items-center rounded-xl border border-dashed px-8 text-center text-sm leading-relaxed">
                            <div>
                                <SelectionIcon
                                    className="text-primary mx-auto mb-3"
                                    aria-hidden="true"
                                    size={30}
                                    weight="light"
                                />
                                <p className="font-semibold">
                                    {selectedPhoto.photo
                                        ? t("capture.review.imageUnavailable")
                                        : selectedPhoto.status}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-background/95 flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                        <p className="text-sm font-bold wrap-anywhere">
                            {selectedPhoto.label}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                            {selectedPhoto.photo
                                ? t("capture.review.ingredientsReady")
                                : selectedPhoto.status}
                        </p>
                    </div>
                    <Button
                        className="shrink-0 px-3"
                        variant="outline"
                        type="button"
                        onClick={() => onEdit(selectedPhoto.step)}
                    >
                        <PencilSimpleIcon aria-hidden="true" />
                        {selectedPhoto.photo
                            ? t("capture.review.edit")
                            : t("capture.review.add")}
                    </Button>
                </div>
            </section>

            <section className="border-border bg-background relative z-10 -mt-7 mx-3 rounded-xl border p-3 sm:p-4">
                <div className="mb-3 px-1">
                    <p className="text-sm font-bold">
                        {t("capture.review.title")}
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {photos.map(({ step, photo, label, alt, status }) => {
                        const isSelected = step === selectedStep
                        return (
                            <Button
                                key={step}
                                className={
                                    "h-auto min-w-0 flex-col rounded-xl p-1 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
                                    (isSelected
                                        ? "bg-brand-soft"
                                        : "hover:bg-muted")
                                }
                                variant="ghost"
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => setSelectedStep(step)}
                            >
                                {photo ? (
                                    <ReviewImage
                                        className={
                                            "border-border aspect-[4/5] w-full rounded-lg border object-cover " +
                                            (isSelected
                                                ? "ring-primary ring-2 ring-offset-2"
                                                : "")
                                        }
                                        src={photo.previewUrl}
                                        alt={alt}
                                        fallbackLabel={t(
                                            "capture.review.imageUnavailable",
                                        )}
                                    />
                                ) : (
                                    <span className="border-border bg-muted text-muted-foreground grid aspect-[4/5] place-items-center rounded-lg border border-dashed p-2 text-center text-xs leading-snug">
                                        {status}
                                    </span>
                                )}
                                <span className="mt-2 block px-1 text-center text-xs font-bold wrap-anywhere sm:text-sm">
                                    {label}
                                </span>
                            </Button>
                        )
                    })}
                </div>
                <p className="sr-only" aria-live="polite">
                    {selectedPhoto.label}
                </p>
            </section>

            <div className="border-border bg-brand-soft rounded-xl border p-4">
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
