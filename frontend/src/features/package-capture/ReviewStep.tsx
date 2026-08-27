import { LockKeyIcon } from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

import type { CapturedPackagePhoto } from "./browserPackageCamera"

type ReviewStepProps = {
    frontPhoto: CapturedPackagePhoto
    ingredientPhoto: CapturedPackagePhoto
    onStart: () => void
}

export function ReviewStep({
    frontPhoto,
    ingredientPhoto,
    onStart,
}: ReviewStepProps) {
    const { t } = useTranslation()

    return (
        <div className="mt-6">
            <div className="grid grid-cols-2 gap-3">
                {[
                    {
                        photo: frontPhoto,
                        label: t("capture.review.frontLabel"),
                        alt: t("capture.front.previewAlt"),
                    },
                    {
                        photo: ingredientPhoto,
                        label: t("capture.review.ingredientsLabel"),
                        alt: t("capture.ingredients.previewAlt"),
                    },
                ].map(({ photo, label, alt }) => (
                    <figure key={label}>
                        <img
                            className="border-border aspect-[4/5] w-full rounded-xl border object-cover"
                            src={photo.previewUrl}
                            alt={alt}
                        />
                        <figcaption className="mt-2 text-sm font-bold">
                            {label}
                        </figcaption>
                    </figure>
                ))}
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
                <LockKeyIcon aria-hidden="true" weight="bold" />
                {t("capture.review.start")}
            </Button>
        </div>
    )
}
