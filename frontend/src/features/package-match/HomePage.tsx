import {
    ArrowClockwiseIcon,
    CameraIcon,
    CameraRotateIcon,
    LockKeyIcon,
    MagnifyingGlassIcon,
    PauseIcon,
    PlayIcon,
    ShieldCheckIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BrandLockup } from "@/ui/OpenLabelMark"

import { barcodeScanner, type BarcodeScannerSession } from "./barcodeScanner"
import { validateIdentifier } from "./identifier"

type HomePageProps = {
    focusIdentifier?: boolean
    initialIdentifier: string
    isModalBackground?: boolean
    onIdentifierChange: (identifier: string) => void
}

type CameraState = "consent" | "starting" | "scanning" | "paused" | "error"
type CameraFacingMode = "environment" | "user"

const cameraStartedSessionKey = "lifegoods.camera-started.v1"

function hasStartedCameraThisSession() {
    try {
        return sessionStorage.getItem(cameraStartedSessionKey) === "true"
    } catch {
        return false
    }
}

function rememberCameraStarted() {
    try {
        sessionStorage.setItem(cameraStartedSessionKey, "true")
    } catch {
        // Camera use still works if session storage is unavailable.
    }
}

function cameraErrorKey(error: unknown) {
    const name =
        typeof error === "object" && error !== null && "name" in error
            ? error.name
            : undefined

    if (typeof window !== "undefined" && window.isSecureContext === false)
        return "cameraErrorInsecure"
    if (name === "NotAllowedError" || name === "SecurityError")
        return "cameraErrorPermission"
    if (name === "NotFoundError" || name === "DevicesNotFoundError")
        return "cameraErrorNoDevice"
    if (name === "NotReadableError" || name === "TrackStartError")
        return "cameraErrorBusy"
    if (name === "CameraPreviewError") return "cameraErrorPreview"
    if (
        name === "OverconstrainedError" ||
        name === "ConstraintNotSatisfiedError"
    )
        return "cameraErrorUnsupported"
    if (name === "AbortError" || name === "InvalidStateError")
        return "cameraErrorInterrupted"
    if (name === "TypeError" || name === "NotSupportedError")
        return "cameraErrorUnsupported"
    return "cameraErrorGeneric"
}

function stopCameraStream(stream: MediaProvider | null) {
    if (
        stream &&
        typeof stream === "object" &&
        "getTracks" in stream &&
        typeof stream.getTracks === "function"
    ) {
        stream.getTracks().forEach((track) => track.stop())
    }
}

export function HomePage({
    isModalBackground = false,
    onIdentifierChange,
}: HomePageProps) {
    const { i18n, t } = useTranslation()
    const navigate = useNavigate()
    const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "km"
    const targetLanguage = currentLanguage === "km" ? "en" : "km"
    const [cameraState, setCameraState] = useState<CameraState>("consent")
    const [cameraMessage, setCameraMessage] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const cameraSessionRef = useRef<BarcodeScannerSession | null>(null)
    const scanHandledRef = useRef(false)
    const cameraRunRef = useRef(0)
    const facingModeRef = useRef<CameraFacingMode>("environment")

    const releaseCamera = useCallback(() => {
        cameraRunRef.current += 1
        cameraSessionRef.current?.stop()
        cameraSessionRef.current = null
        stopCameraStream(videoRef.current?.srcObject ?? null)
        if (videoRef.current) videoRef.current.srcObject = null
    }, [])

    const canUseCamera = () =>
        typeof navigator !== "undefined" &&
        (typeof window === "undefined" || window.isSecureContext !== false) &&
        !!navigator.mediaDevices?.getUserMedia &&
        !!videoRef.current

    const handleCameraResult = useCallback(
        (rawValue: string) => {
            if (scanHandledRef.current) return
            const validation = validateIdentifier(rawValue)
            scanHandledRef.current = true
            releaseCamera()

            if (!validation.valid) {
                const value = rawValue.trim()
                onIdentifierChange(value)
                void navigate(
                    `${appRoutes.search}?q=${encodeURIComponent(value)}`,
                    { state: { invalidIdentifier: value } },
                )
                return
            }

            onIdentifierChange(validation.value)
            void navigate(`/results/${validation.value}`, {
                state: { fromBarcode: true },
            })
        },
        [navigate, onIdentifierChange, releaseCamera],
    )

    const startCamera = useCallback(
        async (facingMode: CameraFacingMode = facingModeRef.current) => {
            if (
                typeof window !== "undefined" &&
                window.isSecureContext === false
            ) {
                setCameraState("error")
                setCameraMessage(t("cameraErrorInsecure"))
                return
            }

            if (!canUseCamera()) {
                setCameraState("error")
                setCameraMessage(t("cameraErrorUnsupported"))
                return
            }

            scanHandledRef.current = false
            releaseCamera()
            const cameraRun = ++cameraRunRef.current
            facingModeRef.current = facingMode
            setCameraMessage(null)
            setCameraState("starting")

            try {
                const session = await barcodeScanner.start(
                    videoRef.current!,
                    handleCameraResult,
                    (error) => {
                        releaseCamera()
                        setCameraState("error")
                        setCameraMessage(t(cameraErrorKey(error)))
                    },
                    { facingMode },
                )
                if (
                    cameraRun !== cameraRunRef.current ||
                    scanHandledRef.current
                ) {
                    session.stop()
                    return
                }
                cameraSessionRef.current = session
                setCameraState("scanning")
            } catch (error) {
                if (cameraRun !== cameraRunRef.current) return
                setCameraState("error")
                setCameraMessage(t(cameraErrorKey(error)))
                cameraSessionRef.current = null
            }
        },
        [handleCameraResult, releaseCamera, t],
    )

    useEffect(() => {
        if (isModalBackground) {
            releaseCamera()
            return
        }
        if (hasStartedCameraThisSession()) void startCamera()
        return releaseCamera
    }, [isModalBackground, releaseCamera, startCamera])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden" || isModalBackground) {
                releaseCamera()
                if (hasStartedCameraThisSession()) setCameraState("paused")
            } else if (
                document.visibilityState === "visible" &&
                hasStartedCameraThisSession()
            ) {
                void startCamera()
            }
        }
        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () =>
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            )
    }, [isModalBackground, releaseCamera, startCamera])

    const beginFirstCameraSession = () => {
        rememberCameraStarted()
        void startCamera()
    }

    const pauseCamera = () => {
        releaseCamera()
        setCameraMessage(null)
        setCameraState("paused")
    }

    const switchCamera = () => {
        const nextMode =
            facingModeRef.current === "environment" ? "user" : "environment"
        void startCamera(nextMode)
    }

    const statusMessage =
        cameraState === "scanning"
            ? (cameraMessage ?? t("cameraScanning"))
            : cameraState === "starting"
              ? t("cameraStarting")
              : cameraState === "paused"
                ? t("cameraPaused")
                : cameraMessage

    return (
        <main className="mx-auto w-full max-w-6xl">
            <header className="mb-4 flex items-center justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
                <BrandLockup />
                <Button
                    className="border-border bg-background hover:bg-muted size-11 min-h-11 min-w-11 rounded-full p-0 transition-colors"
                    variant="outline"
                    type="button"
                    aria-label={t(
                        targetLanguage === "en"
                            ? "switchToEnglish"
                            : "switchToKhmer",
                    )}
                    onClick={() => void i18n.changeLanguage(targetLanguage)}
                >
                    <LanguageFlag language={currentLanguage} />
                </Button>
            </header>

            <div className="px-4 sm:px-6 lg:px-10">
                <section
                    className={cn(
                        "border-border bg-muted relative isolate min-h-[24rem] w-full overflow-hidden rounded-3xl border transition-colors sm:min-h-[30rem] lg:min-h-[34rem]",
                        cameraState === "scanning" &&
                            "border-black/50 bg-black",
                    )}
                    aria-label={t("cameraTitle")}
                >
                    <video
                        ref={videoRef}
                        className={cn(
                            "absolute inset-0 block h-full w-full object-cover transition-opacity duration-300",
                            cameraState === "scanning"
                                ? "opacity-100"
                                : "opacity-0",
                        )}
                        aria-hidden="true"
                        autoPlay
                        muted
                        playsInline
                    />

                    {cameraState === "consent" ? (
                        <div className="relative z-20 grid min-h-[24rem] place-items-center px-4 py-10 text-center sm:min-h-[30rem] sm:px-6 lg:min-h-[34rem]">
                            <div className="max-w-md">
                                <div
                                    className="bg-mango-soft border-mango/25 mx-auto grid size-20 place-items-center rounded-3xl border"
                                    aria-hidden="true"
                                >
                                    <LockKeyIcon
                                        className="text-primary"
                                        size={36}
                                        weight="bold"
                                    />
                                </div>
                                <h2 className="text-foreground mt-6 text-2xl leading-[1.7] font-black tracking-tight sm:text-3xl">
                                    {t("cameraPrivacyTitle")}
                                </h2>
                                <p className="text-muted-foreground mt-3 leading-[1.65]">
                                    {t("cameraPrivacyBody")}
                                </p>
                                <div className="border-border bg-background/90 text-muted-foreground mt-4 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold">
                                    <ShieldCheckIcon
                                        className="text-primary shrink-0"
                                        size={15}
                                        weight="bold"
                                        aria-hidden="true"
                                    />
                                    <span>{t("cameraPrivacySession")}</span>
                                </div>
                                <div className="mt-7">
                                    <Button
                                        className="bg-primary text-primary-foreground hover:bg-brand-hover min-h-12 rounded-xl px-7 text-base font-black shadow-none transition-all active:scale-[0.98]"
                                        type="button"
                                        onClick={beginFirstCameraSession}
                                    >
                                        <CameraIcon
                                            aria-hidden="true"
                                            size={22}
                                            weight="bold"
                                        />
                                        <span>{t("cameraStart")}</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {cameraState === "starting" ? (
                        <div className="relative z-20 grid min-h-[24rem] place-items-center px-6 text-center sm:min-h-[30rem] lg:min-h-[34rem]">
                            <div className="flex flex-col items-center">
                                <div
                                    className="bg-brand-soft border-brand/20 text-primary grid size-20 place-items-center rounded-3xl border motion-safe:animate-pulse"
                                    aria-hidden="true"
                                >
                                    <CameraIcon size={36} weight="bold" />
                                </div>
                                <p className="text-foreground mt-5 text-lg font-black">
                                    {t("cameraStarting")}
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {cameraState === "paused" ? (
                        <div className="relative z-20 grid min-h-[24rem] place-items-center px-6 text-center sm:min-h-[30rem] lg:min-h-[34rem]">
                            <div className="flex flex-col items-center">
                                <div
                                    className="bg-muted text-muted-foreground grid size-20 place-items-center rounded-3xl"
                                    aria-hidden="true"
                                >
                                    <PauseIcon size={36} weight="bold" />
                                </div>
                                <p className="text-foreground mt-4 text-xl font-bold">
                                    {t("cameraPaused")}
                                </p>
                                <Button
                                    className="mt-6 min-h-12 rounded-xl px-6 font-bold"
                                    type="button"
                                    onClick={() => void startCamera()}
                                >
                                    <PlayIcon
                                        aria-hidden="true"
                                        size={20}
                                        weight="fill"
                                    />
                                    <span>{t("cameraResume")}</span>
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {cameraState === "error" ? (
                        <div className="relative z-20 grid min-h-[24rem] place-items-center px-6 py-10 text-center sm:min-h-[30rem] lg:min-h-[34rem]">
                            <div className="max-w-md">
                                <div
                                    className="bg-destructive/10 text-destructive mx-auto grid size-20 place-items-center rounded-3xl"
                                    aria-hidden="true"
                                >
                                    <WarningCircleIcon
                                        size={40}
                                        weight="bold"
                                    />
                                </div>
                                <h2 className="text-foreground mt-5 text-2xl leading-[1.7] font-black tracking-tight">
                                    {t("cameraUnavailable")}
                                </h2>
                                <p className="text-muted-foreground mt-2 leading-[1.65]">
                                    {cameraMessage}
                                </p>
                                <Button
                                    className="mt-6 min-h-12 rounded-xl px-6 font-bold"
                                    type="button"
                                    onClick={() => void startCamera()}
                                    disabled={!canUseCamera()}
                                >
                                    <ArrowClockwiseIcon
                                        aria-hidden="true"
                                        size={20}
                                        weight="bold"
                                    />
                                    <span>{t("cameraTryAgain")}</span>
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {cameraState === "scanning" ? (
                        <>
                            {/* Scanning Status Badge */}
                            <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-4 py-1.5 text-white shadow-sm backdrop-blur-md">
                                    <span
                                        className="bg-mango size-2 rounded-full motion-safe:animate-pulse"
                                        aria-hidden="true"
                                    />
                                    <span className="text-xs font-bold tracking-wide sm:text-sm">
                                        {t("cameraScanning")}
                                    </span>
                                </div>
                            </div>

                            {/* Center Viewfinder Reticle with Scrim */}
                            <div
                                className="pointer-events-none absolute inset-0 z-20 grid place-items-center p-6"
                                aria-hidden="true"
                            >
                                <div className="relative aspect-[4/3] w-full max-w-[18rem] rounded-2xl sm:max-w-[22rem]">
                                    {/* Focus Scrim Mask */}
                                    <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-1 ring-white/20" />

                                    {/* 4 Corner Brackets */}
                                    <svg
                                        className="text-mango pointer-events-none absolute top-0 left-0 size-7"
                                        viewBox="0 0 28 28"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M2 20V8a6 6 0 0 1 6-6h12"
                                            stroke="currentColor"
                                            strokeWidth="3.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    <svg
                                        className="text-mango pointer-events-none absolute top-0 right-0 size-7"
                                        viewBox="0 0 28 28"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M26 20V8a6 6 0 0 0-6-6H8"
                                            stroke="currentColor"
                                            strokeWidth="3.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    <svg
                                        className="text-mango pointer-events-none absolute bottom-0 left-0 size-7"
                                        viewBox="0 0 28 28"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M2 8v12a6 6 0 0 0 6 6h12"
                                            stroke="currentColor"
                                            strokeWidth="3.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    <svg
                                        className="text-mango pointer-events-none absolute right-0 bottom-0 size-7"
                                        viewBox="0 0 28 28"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M26 8v12a6 6 0 0 1-6 6H8"
                                            stroke="currentColor"
                                            strokeWidth="3.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>

                                    {/* Subtle Laser Beam */}
                                    <div className="animate-scan-laser via-mango absolute inset-x-3 h-0.5 rounded-full bg-gradient-to-r from-transparent to-transparent shadow-[0_0_8px_var(--mango)]" />
                                </div>
                            </div>

                            {/* Viewfinder Controls */}
                            <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-end gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16 sm:p-5">
                                <Button
                                    className="focus-visible:ring-offset-background size-11 rounded-full border border-white/30 bg-black/50 p-0 text-white shadow-sm backdrop-blur-md hover:bg-black/75 hover:text-white focus-visible:ring-2 focus-visible:ring-white active:scale-95"
                                    variant="outline"
                                    type="button"
                                    aria-label={t("cameraPause")}
                                    onClick={pauseCamera}
                                >
                                    <PauseIcon
                                        aria-hidden="true"
                                        size={20}
                                        weight="fill"
                                    />
                                </Button>
                                <Button
                                    className="focus-visible:ring-offset-background size-11 rounded-full border border-white/30 bg-black/50 p-0 text-white shadow-sm backdrop-blur-md hover:bg-black/75 hover:text-white focus-visible:ring-2 focus-visible:ring-white active:scale-95"
                                    variant="outline"
                                    type="button"
                                    aria-label={t("cameraSwitch")}
                                    onClick={switchCamera}
                                >
                                    <CameraRotateIcon
                                        aria-hidden="true"
                                        size={20}
                                        weight="bold"
                                    />
                                </Button>
                            </div>
                        </>
                    ) : null}

                    <div
                        className="sr-only"
                        role={cameraState === "error" ? "alert" : "status"}
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {statusMessage}
                    </div>
                </section>
            </div>

            <div className="px-4 pt-4 pb-6 sm:px-6 lg:px-10">
                <Link
                    className="group border-input bg-background hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/25 relative flex min-h-14 w-full items-center rounded-2xl border no-underline transition-all duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.99]"
                    to={appRoutes.search}
                    aria-label={t("openProductSearch")}
                    onClick={releaseCamera}
                >
                    <div className="ml-3.5 flex size-6 shrink-0 items-center justify-center">
                        <MagnifyingGlassIcon
                            aria-hidden="true"
                            className="text-muted-foreground group-hover:text-primary transition-colors"
                            size={22}
                        />
                    </div>
                    <span className="text-muted-foreground/70 group-hover:text-muted-foreground flex h-14 min-w-0 flex-1 items-center truncate px-3 text-base font-normal select-none">
                        {t("search.inputPlaceholder")}
                    </span>
                </Link>
            </div>
        </main>
    )
}

function LanguageFlag({ language }: { language: "en" | "km" }) {
    if (language === "km") {
        return (
            <img
                src="/flags/cambodia.svg"
                alt=""
                aria-hidden="true"
                data-language-flag="km"
                className="size-7 rounded-full object-cover shadow-xs"
            />
        )
    }

    return (
        <img
            src="/flags/united-kingdom.svg"
            alt=""
            aria-hidden="true"
            data-language-flag="en"
            className="size-7 rounded-full object-cover shadow-xs"
        />
    )
}
