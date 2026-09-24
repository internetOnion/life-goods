import { Camera, WarningCircle } from "@phosphor-icons/react"
import type { Ref } from "react"
import { Link } from "react-router"

import { appRoutes } from "@/app/routes"
import {
    EvidencePointers,
    NutritionColumnCard,
} from "@/features/photo-evidence/EvidenceViews"
import { displayValue } from "@/features/photo-evidence/helpers"
import type { Extraction } from "@/features/photo-evidence/types"
import { useCompareTranslation } from "@/features/photo-evidence/translations"

interface LabelReadingViewProps {
    extraction: Extraction
    onFocusEvidence: (imageId: string) => void
    ref?: Ref<HTMLElement>
}

/**
 * A Label Reading: Photo Evidence for one Product. It deliberately carries no
 * Source Attribution, Source Assessment, score, or verdict, and never says
 * Source Data Unavailable, which describes Source Records only (SPEC §29).
 */
export function LabelReadingView({
    extraction,
    onFocusEvidence,
    ref,
}: LabelReadingViewProps) {
    const { locale, t } = useCompareTranslation()
    const identity = extraction.identity
    const packageQuantity = extraction.package_quantity
    const columns = extraction.nutrition_columns ?? []
    const retakeReasons = extraction.retake_reasons ?? []

    return (
        <section
            ref={ref}
            tabIndex={-1}
            aria-labelledby="label-reading-heading"
            className="mt-6 focus:outline-none"
        >
            <div className="flex flex-wrap items-center gap-2">
                <h2
                    id="label-reading-heading"
                    className="text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl"
                >
                    {t("labelReadingTitle")}
                </h2>
                <span className="border-warning-200 bg-warning-50 text-warning-900 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold">
                    <Camera size={13} weight="bold" aria-hidden="true" />
                    {t("photoEvidenceBadge")}
                </span>
            </div>
            <p className="border-warning-200 bg-warning-50/70 text-warning-950 mt-3 rounded-xl border p-3 text-sm leading-relaxed">
                {t("photoEvidenceNotice")}
            </p>

            {identity?.brand?.value_text || identity?.name?.value_text ? (
                <p className="mt-4 text-base leading-tight font-extrabold wrap-anywhere text-neutral-950">
                    {identity.brand?.value_text ? (
                        <span lang={identity.brand.language || "und"}>
                            {identity.brand.value_text}
                        </span>
                    ) : null}
                    {identity.brand?.value_text && identity.name?.value_text
                        ? " "
                        : null}
                    {identity.name?.value_text ? (
                        <span lang={identity.name.language || "und"}>
                            {identity.name.value_text}
                        </span>
                    ) : null}
                </p>
            ) : null}

            <dl className="mt-3 text-sm">
                <dt className="text-caption font-bold tracking-wider text-neutral-600 uppercase">
                    {t("packageWeight")}
                </dt>
                <dd className="mt-1 font-semibold text-neutral-900">
                    {packageQuantity?.state === "readable" ? (
                        <>
                            {displayValue(
                                packageQuantity.value_text,
                                packageQuantity.unit_text || "",
                            )}
                            {packageQuantity.evidence?.length ? (
                                <EvidencePointers
                                    evidence={packageQuantity.evidence}
                                    images={extraction.images}
                                    onFocus={onFocusEvidence}
                                />
                            ) : null}
                        </>
                    ) : (
                        <span className="font-medium text-neutral-600 italic">
                            {t("notPrintedOnPhoto")}
                        </span>
                    )}
                </dd>
            </dl>

            <h3 className="mt-5 text-sm font-extrabold text-neutral-900">
                {t("printedColumnsHeading")}
            </h3>
            {columns.length > 0 ? (
                <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                    {columns.map((column) => (
                        <li key={column.column_id}>
                            <NutritionColumnCard
                                column={column}
                                images={extraction.images}
                                onFocusEvidence={onFocusEvidence}
                                describeFieldStates
                                expanded
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 text-sm text-neutral-600 italic">
                    {t("noColumnsRead")}
                </p>
            )}

            {retakeReasons.length > 0 ? (
                <div className="border-warning-200 bg-warning-50 text-warning-900 mt-4 rounded-xl border p-3 text-xs">
                    <div className="text-warning-950 flex items-center gap-2 font-bold">
                        <WarningCircle
                            size={16}
                            weight="bold"
                            aria-hidden="true"
                        />
                        <span>{t("retakeSuggestions")}</span>
                    </div>
                    <ul className="text-warning-800 mt-2 list-disc space-y-1 pl-4">
                        {locale === "km" ? (
                            <li>{t("providerNote")}</li>
                        ) : (
                            retakeReasons.map((reason, index) => (
                                <li key={index}>{reason}</li>
                            ))
                        )}
                    </ul>
                </div>
            ) : null}

            <p className="mt-6 text-sm text-neutral-600">
                {t("compareInsteadPrompt")}{" "}
                <Link
                    to={appRoutes.labelsCompare}
                    className="text-primary-700 font-bold underline-offset-4 hover:underline"
                >
                    {t("compareInsteadLink")}
                </Link>
            </p>
        </section>
    )
}
