import {
    ArrowClockwiseIcon,
    ArrowLeftIcon,
    ClockIcon,
    FileTextIcon,
    HourglassMediumIcon,
    LockKeyIcon,
    WarningCircleIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { useMvpDemoMode } from "@/config/MvpDemoModeContext"
import { getMvpDemoScenario } from "@/config/mvpDemoMode"
import { DemoNotice } from "@/ui/DemoNotice"
import { FocusedPlaceholderPage } from "@/ui/FocusedPlaceholderPage"

type CaptureScenario =
    | "queued"
    | "processing"
    | "partial"
    | "completed"
    | "failed"
    | "timed-out"
    | "expired"

const knownScenarios = new Set<CaptureScenario>([
    "queued",
    "processing",
    "partial",
    "completed",
    "failed",
    "timed-out",
    "expired",
])

function getCaptureScenario(search: string): CaptureScenario {
    const scenario = getMvpDemoScenario(search, true)
    return scenario && knownScenarios.has(scenario as CaptureScenario)
        ? (scenario as CaptureScenario)
        : "queued"
}

export function CapturePage() {
    const demoMode = useMvpDemoMode()
    const { t } = useTranslation()

    if (!demoMode) {
        return (
            <FocusedPlaceholderPage
                title={t("placeholder.captureDetail.title")}
                body={t("placeholder.captureDetail.body")}
                actionLabel={t("capture.back")}
                actionIcon="back"
                actionTo={appRoutes.captureNew}
            />
        )
    }

    return <SimulatedCaptureResult />
}

function SimulatedCaptureResult() {
    const { t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const headingRef = useRef<HTMLHeadingElement>(null)
    const scenario = getCaptureScenario(location.search)
    const stateKey = scenario === "timed-out" ? "timedOut" : scenario
    const isProgress = scenario === "queued" || scenario === "processing"
    const isCompleted = scenario === "completed"

    useEffect(() => {
        headingRef.current?.focus()
    }, [scenario])

    const showNextState = () => {
        const next = scenario === "queued" ? "processing" : "completed"
        void navigate(`${location.pathname}?scenario=${next}`)
    }

    return (
        <>
            <DemoNotice active />
            <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-5 pb-[calc(2rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
                <div className="flex items-center justify-between gap-3">
                    <Button
                        variant="ghost"
                        className="px-2 sm:-ml-3 sm:px-3"
                        type="button"
                        onClick={() => void navigate(appRoutes.captureNew)}
                    >
                        <ArrowLeftIcon aria-hidden="true" weight="bold" />
                        {t("capture.back")}
                    </Button>
                    <Button
                        variant="ghost"
                        className="px-2 sm:-mr-3 sm:px-3"
                        type="button"
                        onClick={() => void navigate(appRoutes.home)}
                    >
                        <XIcon aria-hidden="true" weight="bold" />
                        {t("capture.result.exit")}
                    </Button>
                </div>

                <section className="pt-[clamp(2.5rem,10vh,6rem)]">
                    <ResultIcon scenario={scenario} />
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="mt-6 max-w-[18ch] text-[clamp(2rem,7vw,3.2rem)] leading-[1.55] font-bold tracking-[-0.025em] text-balance"
                    >
                        {t(`capture.result.${stateKey}.title`)}
                    </h1>
                    <p className="text-muted-foreground mt-3 max-w-[65ch] text-[1.05rem] leading-relaxed">
                        {t(`capture.result.${stateKey}.body`)}
                    </p>
                </section>

                {isProgress ? (
                    <div className="mt-8">
                        <ol className="border-border grid grid-cols-3 border-y py-4 text-center text-sm">
                            <li className="font-bold">
                                1. {t("capture.reviewAction")}
                            </li>
                            <li
                                className={
                                    scenario === "processing"
                                        ? "font-bold"
                                        : "text-muted-foreground"
                                }
                            >
                                2. {t("capture.result.processing.title")}
                            </li>
                            <li className="text-muted-foreground">
                                3. {t("capture.result.completed.title")}
                            </li>
                        </ol>
                        <Button
                            className="mt-6 w-full"
                            type="button"
                            onClick={showNextState}
                        >
                            {scenario === "queued" ? (
                                <ArrowClockwiseIcon
                                    aria-hidden="true"
                                    weight="bold"
                                />
                            ) : (
                                <FileTextIcon
                                    aria-hidden="true"
                                    weight="bold"
                                />
                            )}
                            {t(`capture.result.${stateKey}.action`)}
                        </Button>
                    </div>
                ) : (
                    <div className="border-border bg-muted mt-8 rounded-xl border p-4">
                        <div className="flex items-start gap-3">
                            <WarningCircleIcon
                                className="text-coconut-brown mt-0.5 shrink-0"
                                aria-hidden="true"
                                size={23}
                                weight="bold"
                            />
                            <div>
                                <h2 className="font-bold">
                                    {t("capture.result.uncertaintyLabel")}
                                </h2>
                                <p className="mt-1 text-sm leading-relaxed">
                                    {isCompleted
                                        ? t(
                                              "capture.result.completed.uncertainty",
                                          )
                                        : t("capture.result.uncertaintyBody")}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!isProgress ? (
                    <Button
                        className="mt-6 w-full"
                        type="button"
                        onClick={() => void navigate(appRoutes.captureNew)}
                    >
                        <ArrowClockwiseIcon aria-hidden="true" weight="bold" />
                        {t("capture.result.newCapture")}
                    </Button>
                ) : null}

                <div className="border-border mt-8 flex items-start gap-3 border-t pt-5 text-sm leading-relaxed">
                    <LockKeyIcon
                        className="text-primary mt-0.5 shrink-0"
                        aria-hidden="true"
                        size={21}
                        weight="bold"
                    />
                    <p>{t("capture.review.future")}</p>
                </div>
            </main>
        </>
    )
}

function ResultIcon({ scenario }: { scenario: CaptureScenario }) {
    const Icon =
        scenario === "queued"
            ? ClockIcon
            : scenario === "processing"
              ? HourglassMediumIcon
              : scenario === "completed"
                ? FileTextIcon
                : WarningCircleIcon
    const isUncertain =
        scenario === "partial" ||
        scenario === "failed" ||
        scenario === "timed-out" ||
        scenario === "expired"

    return (
        <span
            className={
                isUncertain
                    ? "bg-coconut-brown-soft text-coconut-brown grid size-16 place-items-center rounded-full"
                    : "bg-brand-soft text-primary grid size-16 place-items-center rounded-full"
            }
            aria-hidden="true"
        >
            <Icon size={31} weight="bold" />
        </span>
    )
}
