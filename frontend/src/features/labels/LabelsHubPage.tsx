import { ArrowRight, Receipt, Scales } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { Link } from "react-router"

import { appRoutes } from "@/app/routes"
import { ProviderDisclosure } from "@/features/photo-evidence/ProviderDisclosure"
import {
    type CompareTranslationKey,
    useCompareTranslation,
} from "@/features/photo-evidence/translations"
import { usePageMetadata } from "@/lib/metadata"

const modes: ReadonlyArray<{
    to: string
    icon: Icon
    titleKey: CompareTranslationKey
    descriptionKey: CompareTranslationKey
}> = [
    {
        to: appRoutes.labelsRead,
        icon: Receipt,
        titleKey: "readModeTitle",
        descriptionKey: "readModeDescription",
    },
    {
        to: appRoutes.labelsCompare,
        icon: Scales,
        titleKey: "compareModeTitle",
        descriptionKey: "compareModeDescription",
    },
]

/** Nutrition Labels: the section hub for Read This Label and Compare Nutrition. */
export function LabelsHubPage() {
    const { locale, t } = useCompareTranslation()

    usePageMetadata({
        title: t("labelsPageTitle"),
        description: t("labelsPageDescription"),
    })

    return (
        <main
            className="page-rail pb-32 sm:px-6 sm:py-12"
            lang={locale === "km" ? "km" : "en"}
        >
            <h1 className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-neutral-950">
                {t("labelsPageTitle")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                {t("labelsIntro")}
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {modes.map(
                    ({ to, icon: ModeIcon, titleKey, descriptionKey }) => (
                        <li key={to}>
                            <Link
                                to={to}
                                className="group hover:border-primary-300 focus-visible:ring-primary-500 flex h-full items-start gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                <span className="bg-primary-100 text-primary-800 flex size-11 shrink-0 items-center justify-center rounded-xl">
                                    <ModeIcon
                                        size={24}
                                        weight="bold"
                                        aria-hidden="true"
                                    />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-base font-extrabold text-neutral-950">
                                        {t(titleKey)}
                                    </span>
                                    <span className="mt-1 block text-sm leading-relaxed text-neutral-600">
                                        {t(descriptionKey)}
                                    </span>
                                </span>
                                <ArrowRight
                                    size={18}
                                    weight="bold"
                                    aria-hidden="true"
                                    className="group-hover:text-primary-700 mt-1 shrink-0 text-neutral-400"
                                />
                            </Link>
                        </li>
                    ),
                )}
            </ul>

            <ProviderDisclosure className="mt-5" />
        </main>
    )
}
