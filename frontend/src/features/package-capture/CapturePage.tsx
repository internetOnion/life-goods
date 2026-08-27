import {
    ArrowClockwiseIcon,
    CameraIcon,
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
import { LanguageSwitchButton } from "@/ui/LanguageSwitchButton"

import {
    buildCaptureResultUrl,
    buildCaptureUrl,
    type CaptureScenario,
} from "./captureRoute"
import { DemoResultStructure } from "./DemoResultStructure"

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
                actionLabel={t("capture.result.exit")}
                actionIcon="exit"
                actionTo={appRoutes.home}
                languageSwitchShape="rectangle"
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

    useEffect(() => {
        const normalizedUrl = buildCaptureResultUrl(
            location.pathname,
            scenario,
            location.search,
        )
        if (`${location.pathname}${location.search}` !== normalizedUrl) {
            void navigate(normalizedUrl, { replace: true })
        }
    }, [location.pathname, location.search, navigate, scenario])

    const showNextState = () => {
        const next = scenario === "queued" ? "processing" : "completed"
        void navigate(
            buildCaptureResultUrl(location.pathname, next, location.search),
        )
    }

    return (
        <>
            <DemoNotice active />
            <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
                <div className="grid grid-cols-[1fr_auto] items-start gap-2 pt-[calc(1rem_+_env(safe-area-inset-top))]">
                    <Button
                        className="bg-background text-foreground hover:bg-muted hover:text-foreground min-w-0 justify-self-start rounded-full px-4"
                        type="button"
                        onClick={() => void navigate(appRoutes.home)}
                    >
                        <XIcon aria-hidden="true" weight="bold" />
                        {t("capture.result.exit")}
                    </Button>
                    <LanguageSwitchButton shape="rectangle" />
                </div>

                <section className="mx-auto flex max-w-[36rem] flex-col items-center pt-[clamp(3rem,12vh,7rem)] text-center">
                    <ResultIcon scenario={scenario} />
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="mt-6 max-w-[20ch] text-[clamp(1.75rem,6vw,2.6rem)] leading-[1.6] font-bold tracking-[-0.025em] text-balance"
                    >
                        {t(`capture.result.${stateKey}.title`)}
                    </h1>
                    <p className="text-muted-foreground mt-3 max-w-[46ch] text-[0.95rem] leading-relaxed">
                        {t(`capture.result.${stateKey}.body`)}
                    </p>
                </section>

                {isProgress ? (
                    <div className="mx-auto mt-10 max-w-[40rem]">
                        <ol
                            className="border-border grid grid-cols-1 border-y py-2 text-start text-sm sm:grid-cols-3 sm:text-center"
                            aria-label={t("capture.progress.label")}
                        >
                            <li className="font-bold">
                                <span className="inline-block py-2">
                                    1. {t("capture.reviewAction")}
                                </span>
                            </li>
                            <li
                                className={
                                    scenario === "processing"
                                        ? "font-bold"
                                        : "text-muted-foreground"
                                }
                            >
                                <span className="inline-block py-2">
                                    2. {t("capture.result.processing.title")}
                                </span>
                            </li>
                            <li className="text-muted-foreground">
                                <span className="inline-block py-2">
                                    3. {t("capture.result.completed.title")}
                                </span>
                            </li>
                        </ol>
                        <div className="mt-7 flex justify-center">
                            <Button
                                className="rounded-full px-7"
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
                    </div>
                ) : isCompleted ? (
                    <DemoResultStructure />
                ) : (
                    <div className="border-border bg-muted mx-auto mt-10 max-w-[40rem] rounded-xl border p-4 text-start">
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
                                    {t("capture.result.uncertaintyBody")}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!isProgress ? (
                    <div className="mt-7 flex justify-center">
                        <Button
                            className="rounded-full px-7"
                            type="button"
                            onClick={() =>
                                void navigate(
                                    buildCaptureUrl(
                                        scenario === "partial"
                                            ? "close-up"
                                            : "front",
                                        scenario === "completed"
                                            ? ""
                                            : location.search,
                                    ),
                                )
                            }
                        >
                            {scenario === "partial" ? (
                                <CameraIcon aria-hidden="true" weight="bold" />
                            ) : (
                                <ArrowClockwiseIcon
                                    aria-hidden="true"
                                    weight="bold"
                                />
                            )}
                            {t(
                                scenario === "partial"
                                    ? "capture.result.partial.action"
                                    : scenario === "completed"
                                      ? "capture.result.newCapture"
                                      : "capture.result.retryCapture",
                            )}
                        </Button>
                    </div>
                ) : null}

                <div className="border-border mx-auto mt-10 flex max-w-[40rem] items-start gap-3 border-t pt-5 text-start text-sm leading-relaxed">
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
                    ? "bg-coconut-brown-soft text-coconut-brown grid size-20 place-items-center rounded-[1.5rem]"
                    : "bg-brand-soft text-primary grid size-20 place-items-center rounded-[1.5rem]"
            }
            aria-hidden="true"
        >
            <Icon size={42} weight="bold" />
        </span>
    )
}
