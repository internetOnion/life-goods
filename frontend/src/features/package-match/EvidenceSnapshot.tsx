import {
    DatabaseIcon,
    FileDashedIcon,
    ListMagnifyingGlassIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

export type EvidenceSnapshotKind =
    "declared_concerns" | "evidence_gaps" | "source_review"

export type EvidenceSnapshotItem = {
    kind: EvidenceSnapshotKind
    value: string
    detail?: string
}

const snapshotPresentation = {
    declared_concerns: {
        labelKey: "declaredConcernsSnapshot",
        icon: ListMagnifyingGlassIcon,
    },
    evidence_gaps: {
        labelKey: "evidenceGapsSnapshot",
        icon: FileDashedIcon,
    },
    source_review: {
        labelKey: "sourceReviewSnapshot",
        icon: DatabaseIcon,
    },
} as const

export function EvidenceSnapshot({ items }: { items: EvidenceSnapshotItem[] }) {
    const { t } = useTranslation()

    return (
        <section
            className="border-border border-y"
            aria-labelledby="evidence-snapshot-title"
        >
            <h2
                id="evidence-snapshot-title"
                className="py-4 text-xl leading-[1.7] font-black sm:text-2xl"
            >
                {t("evidenceSnapshotTitle")}
            </h2>
            <div className="divide-border border-border divide-y border-t">
                {items.map((item) => {
                    const presentation = snapshotPresentation[item.kind]
                    const Icon = presentation.icon
                    return (
                        <div
                            className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[3rem_12rem_minmax(0,1fr)] sm:items-start sm:gap-4"
                            key={item.kind}
                        >
                            <span
                                className="bg-brand-soft text-primary grid size-11 place-items-center rounded-xl"
                                aria-hidden="true"
                            >
                                <Icon size={23} weight="bold" />
                            </span>
                            <p className="self-center text-sm font-black sm:self-start sm:pt-2.5">
                                {t(presentation.labelKey)}
                            </p>
                            <div className="col-start-2 min-w-0 sm:col-start-3">
                                <p className="leading-[1.65] font-semibold wrap-anywhere">
                                    {item.value}
                                </p>
                                {item.detail ? (
                                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed wrap-anywhere">
                                        {item.detail}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
