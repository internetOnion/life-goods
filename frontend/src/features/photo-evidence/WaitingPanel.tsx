import { Check, ImageSquare, X } from "@phosphor-icons/react"
import { useEffect, useState, type ReactNode, type Ref } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useCompareTranslation } from "./translations"

export type WaitState = "pending" | "active" | "done"

export interface WaitingPhoto {
    key: string
    /** Omitted when the browser cannot preview the photo (HEIC outside Safari). */
    url?: string
    /** Short caption under the photo, e.g. its capture step. */
    caption?: string
}

export interface WaitingGroup {
    key: string
    /** Mark shown before the group, e.g. the A/B letter. */
    mark?: ReactNode
    label?: string
    photos: WaitingPhoto[]
    state: WaitState
}

export interface WaitingStage {
    key: string
    label: string
    state: WaitState
}

export interface WaitingPanelProps {
    title: string
    /** One line on what is happening now; defaults to the active stage. */
    status?: string
    groups: WaitingGroup[]
    /** Shown only when there is more than one real stage. */
    stages?: WaitingStage[]
    onCancel: () => void
    cancelLabel: string
    footnote?: ReactNode
    ref?: Ref<HTMLElement>
}

/** After this long, say plainly that it is slower than usual but still going. */
const SLOW_AFTER_SECONDS = 45

function formatElapsed(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`
}

/**
 * The wait while the AI provider reads label photos (Read This Label and Compare
 * Nutrition). It shows the Shopper's own photos with the ones being read marked,
 * only the stages that really happen, honest time copy, and a way out. Nothing
 * here pretends to measure progress the app cannot see.
 */
export function WaitingPanel({
    title,
    status,
    groups,
    stages,
    onCancel,
    cancelLabel,
    footnote,
    ref,
}: WaitingPanelProps) {
    const { t } = useCompareTranslation()
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const started = Date.now()
        const timer = window.setInterval(
            () => setElapsed(Math.floor((Date.now() - started) / 1000)),
            1000,
        )
        return () => window.clearInterval(timer)
    }, [])

    const slow = elapsed >= SLOW_AFTER_SECONDS
    const activeStage = stages?.find((stage) => stage.state === "active")
    const showStages = (stages?.length ?? 0) > 1

    return (
        <section
            ref={ref}
            tabIndex={-1}
            aria-labelledby="waiting-panel-title"
            aria-busy="true"
            data-testid="waiting-panel"
            className="source-sheet motion-safe:animate-step-enter mt-6 px-5 pt-5 pb-4 focus:outline-none sm:px-6"
        >
            <div className="flex items-start justify-between gap-4">
                <div aria-live="polite" aria-atomic="true" className="min-w-0">
                    <h2
                        id="waiting-panel-title"
                        className="type-section-title text-neutral-950"
                    >
                        {title}
                    </h2>
                    {status || (showStages && activeStage) ? (
                        <p className="mt-0.5 text-sm font-semibold text-neutral-700">
                            {status ?? activeStage?.label}
                        </p>
                    ) : null}
                </div>
                <span
                    aria-hidden="true"
                    className="mt-1 shrink-0 font-mono text-sm font-bold text-neutral-500 tabular-nums"
                >
                    {formatElapsed(elapsed)}
                </span>
            </div>
            <p
                className={cn(
                    "mt-1 text-sm leading-relaxed",
                    slow ? "text-warning-900" : "text-neutral-600",
                )}
                role={slow ? "status" : undefined}
            >
                {slow ? t("waitSlow") : t("waitUsual")}
            </p>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-4">
                {groups.map((group) => (
                    <div key={group.key} className="min-w-0">
                        {group.mark || group.label ? (
                            <div className="mb-2 flex items-center gap-2">
                                {group.mark}
                                {group.label ? (
                                    <span className="text-sm font-bold wrap-anywhere text-neutral-800">
                                        {group.label}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                        <ul className="flex gap-2">
                            {group.photos.map((photo) => (
                                <li key={photo.key} className="w-16">
                                    <div
                                        className={cn(
                                            "relative size-16 overflow-hidden rounded-xl bg-neutral-100 ring-1 transition-[opacity,box-shadow] duration-300",
                                            group.state === "active"
                                                ? "ring-primary-500 ring-2"
                                                : "ring-neutral-200",
                                            group.state === "pending" &&
                                                "opacity-55",
                                        )}
                                    >
                                        {photo.url ? (
                                            <img
                                                src={photo.url}
                                                alt=""
                                                className="size-full object-cover"
                                            />
                                        ) : (
                                            <span className="grid size-full place-items-center text-neutral-400">
                                                <ImageSquare
                                                    size={22}
                                                    aria-hidden="true"
                                                />
                                            </span>
                                        )}
                                        {group.state === "active" ? (
                                            <span
                                                aria-hidden="true"
                                                className="bg-primary-300 motion-safe:animate-scan-laser absolute right-0 left-0 h-0.5 shadow-[0_0_10px_2px_rgba(225,148,71,0.65)] motion-reduce:top-1/2"
                                            />
                                        ) : null}
                                        {group.state === "done" ? (
                                            <span className="absolute inset-0 grid place-items-center bg-neutral-950/35">
                                                <span className="grid size-7 place-items-center rounded-full bg-white text-neutral-950">
                                                    <Check
                                                        size={15}
                                                        weight="bold"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                            </span>
                                        ) : null}
                                    </div>
                                    {photo.caption ? (
                                        <p className="mt-1 truncate text-center text-xs font-semibold text-neutral-600">
                                            {photo.caption}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {showStages ? (
                <ol
                    aria-label={t("comparisonProgress")}
                    className="mt-5 divide-y divide-neutral-100 border-y border-neutral-100"
                >
                    {stages!.map((stage, index) => (
                        <li
                            key={stage.key}
                            aria-current={
                                stage.state === "active" ? "step" : undefined
                            }
                            className="flex min-h-12 items-center gap-3 py-2"
                        >
                            <span
                                className={cn(
                                    "grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-bold",
                                    stage.state === "done" &&
                                        "bg-neutral-900 text-white",
                                    stage.state === "active" &&
                                        "bg-primary-600 text-white",
                                    stage.state === "pending" &&
                                        "bg-neutral-100 text-neutral-500",
                                )}
                            >
                                {stage.state === "done" ? (
                                    <Check
                                        size={14}
                                        weight="bold"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            <span
                                className={cn(
                                    "text-sm wrap-anywhere",
                                    stage.state === "active"
                                        ? "font-extrabold text-neutral-950"
                                        : stage.state === "done"
                                          ? "font-semibold text-neutral-700"
                                          : "font-semibold text-neutral-500",
                                )}
                            >
                                {stage.label}
                            </span>
                            <span className="sr-only">
                                {stage.state === "done"
                                    ? t("complete")
                                    : stage.state === "active"
                                      ? t("inProgress")
                                      : t("waiting")}
                            </span>
                        </li>
                    ))}
                </ol>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <p className="min-w-0 flex-1 basis-56 text-xs leading-relaxed text-neutral-600">
                    {footnote ?? t("keepOpen")}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="h-11 gap-2 rounded-full px-4 font-bold text-neutral-800"
                >
                    <X size={16} weight="bold" aria-hidden="true" />
                    <span>{cancelLabel}</span>
                </Button>
            </div>
        </section>
    )
}
