import {
    CaretLeftIcon,
    CaretRightIcon,
    CheckIcon,
    LockKeyIcon,
    PencilSimpleIcon,
    SelectionIcon,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
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
    const viewerRef = useRef<HTMLDivElement | null>(null)
    const selectedPhoto =
        photos.find(({ step }) => step === selectedStep) ?? photos[0]!
    const selectedIndex = photos.findIndex(({ step }) => step === selectedStep)

    function selectPhoto(step: (typeof photos)[number]["step"], index: number) {
        setSelectedStep(step)
        const viewer = viewerRef.current
        if (viewer && typeof viewer.scrollTo === "function") {
            viewer.scrollTo({
                left: index * viewer.clientWidth,
                behavior: "smooth",
            })
        }
    }

    function handleViewerScroll() {
        const viewer = viewerRef.current
        if (!viewer || viewer.clientWidth === 0) return

        const index = Math.min(
            photos.length - 1,
            Math.max(0, Math.round(viewer.scrollLeft / viewer.clientWidth)),
        )
        const nextStep = photos[index]?.step
        if (nextStep && nextStep !== selectedStep) {
            setSelectedStep(nextStep)
        }
    }

    function movePhoto(direction: -1 | 1) {
        const nextIndex = selectedIndex + direction
        const nextPhoto = photos[nextIndex]
        if (nextPhoto) {
            selectPhoto(nextPhoto.step, nextIndex)
        }
    }

    return (
        <div className="mt-6 space-y-4 sm:mt-7">
            <section className="border-border bg-background relative overflow-hidden rounded-2xl border">
                <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3 sm:inset-x-5 sm:top-5">
                    <span className="bg-primary text-primary-foreground max-w-[70%] min-w-0 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm">
                        {selectedPhoto.label}
                    </span>
                    <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums shadow-sm">
                        {selectedIndex + 1} / {photos.length}
                    </span>
                </div>

                <div className="relative">
                    <div
                        ref={viewerRef}
                        className="bg-background relative flex h-[clamp(20rem,58svh,38rem)] snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth sm:h-[clamp(24rem,62svh,42rem)]"
                        onScroll={handleViewerScroll}
                        role="region"
                        aria-label={t("capture.review.title")}
                    >
                        {photos.map(({ step, photo, label, alt, status }) => (
                            <div
                                key={step}
                                id={`capture-review-slide-${step}`}
                                className="relative min-w-full snap-center p-4 sm:p-6"
                                role="group"
                                aria-label={label}
                                aria-hidden={step !== selectedStep}
                            >
                                {photo ? (
                                    <ReviewImage
                                        className="h-full w-full rounded-xl object-contain"
                                        src={photo.previewUrl}
                                        alt={step === selectedStep ? alt : ""}
                                        fallbackLabel={t(
                                            "capture.review.imageUnavailable",
                                        )}
                                    />
                                ) : (
                                    <div className="border-border bg-muted text-muted-foreground grid h-full place-items-center rounded-xl border border-dashed px-8 text-center text-sm leading-relaxed">
                                        <div>
                                            <SelectionIcon
                                                className="text-primary mx-auto mb-3"
                                                aria-hidden="true"
                                                size={30}
                                                weight="light"
                                            />
                                            <p className="font-semibold">
                                                {status}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <Button
                        className="text-muted-foreground hover:text-muted-foreground focus-visible:ring-ring absolute top-1/2 left-3 z-10 -translate-y-1/2 bg-transparent hover:bg-transparent sm:left-4"
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label={t("capture.review.previousPhoto")}
                        disabled={selectedIndex <= 0}
                        onClick={() => movePhoto(-1)}
                    >
                        <CaretLeftIcon aria-hidden="true" weight="bold" />
                    </Button>
                    <Button
                        className="text-muted-foreground hover:text-muted-foreground focus-visible:ring-ring absolute top-1/2 right-3 z-10 -translate-y-1/2 bg-transparent hover:bg-transparent sm:right-4"
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label={t("capture.review.nextPhoto")}
                        disabled={selectedIndex >= photos.length - 1}
                        onClick={() => movePhoto(1)}
                    >
                        <CaretRightIcon aria-hidden="true" weight="bold" />
                    </Button>
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
                <div
                    className="border-border flex gap-1.5 overflow-x-auto border-t px-4 py-2 sm:px-5"
                    role="tablist"
                    aria-label={t("capture.review.title")}
                >
                    {photos.map(({ step, label }, index) => {
                        const isSelected = step === selectedStep
                        return (
                            <Button
                                key={step}
                                className={
                                    "focus-visible:ring-ring min-h-11 shrink-0 rounded-lg px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none " +
                                    (isSelected
                                        ? "bg-brand-soft"
                                        : "hover:bg-muted")
                                }
                                variant="ghost"
                                type="button"
                                role="tab"
                                aria-selected={isSelected}
                                aria-controls={`capture-review-slide-${step}`}
                                onClick={() => selectPhoto(step, index)}
                            >
                                {label}
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
