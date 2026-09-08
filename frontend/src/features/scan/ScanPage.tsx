import {
    ArrowClockwiseIcon,
    CameraIcon,
    CameraRotateIcon,
    CheckCircleIcon,
    MagnifyingGlassIcon,
    PauseIcon,
    PlayIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Link, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { PrivacyScannerIllustration } from "@/components/illustrations"
import { BrandLockup, BrandMark } from "@/components/brand/BrandMark"
import { usePageMetadata } from "@/lib/metadata"
import { cn } from "@/lib/utils"

import { barcodeScanner, type BarcodeScannerSession } from "./barcodeScanner"
import { validateIdentifier } from "./identifier"
import { scanTranslations } from "./translations"

type ScanPageProps = {
    onBarcodeChange?: (barcode: string) => void
}

type CameraState =
    "consent" | "starting" | "scanning" | "acquired" | "paused" | "error"
type CameraFacingMode = "environment" | "user"
type CameraErrorKey =
    | "errorPermission"
    | "errorNoDevice"
    | "errorBusy"
    | "errorPreview"
    | "errorGeneric"
    | "errorInsecure"
    | "errorUnsupported"
    | "errorInterrupted"

const text = scanTranslations.en.scan
const ACQUISITION_LATCH_MS = 180
const cameraStartedSessionKey = "lifegoods.scan.camera-started.v1"

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

function cameraErrorKey(error: unknown): CameraErrorKey {
    const name =
        typeof error === "object" && error !== null && "name" in error
            ? error.name
            : undefined

    if (typeof window !== "undefined" && window.isSecureContext === false)
        return "errorInsecure"
    if (name === "NotAllowedError" || name === "SecurityError")
        return "errorPermission"
    if (name === "NotFoundError" || name === "DevicesNotFoundError")
        return "errorNoDevice"
    if (name === "NotReadableError" || name === "TrackStartError")
        return "errorBusy"
    if (name === "CameraPreviewError") return "errorPreview"
    if (
        name === "OverconstrainedError" ||
        name === "ConstraintNotSatisfiedError"
    )
        return "errorUnsupported"
    if (name === "AbortError" || name === "InvalidStateError")
        return "errorInterrupted"
    if (name === "TypeError" || name === "NotSupportedError")
        return "errorUnsupported"
    return "errorGeneric"
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

function canUseCamera(video: HTMLVideoElement | null) {
    return (
        typeof navigator !== "undefined" &&
        (typeof window === "undefined" || window.isSecureContext !== false) &&
        !!navigator.mediaDevices?.getUserMedia &&
        !!video
    )
}

function prepareSearchBridge() {
    if (typeof document === "undefined") return
    let bridge = document.getElementById(
        "mobile-keyboard-bridge",
    ) as HTMLInputElement | null
    if (!bridge) {
        bridge = document.createElement("input")
        bridge.id = "mobile-keyboard-bridge"
        bridge.type = "text"
        bridge.inputMode = "search"
        bridge.autocomplete = "off"
        bridge.setAttribute("aria-hidden", "true")
        bridge.tabIndex = -1
        bridge.className =
            "fixed -top-96 left-0 opacity-0 pointer-events-none text-base"
        document.body.appendChild(bridge)
    }
    try {
        bridge.focus()
    } catch {
        // ignore
    }
}

type SearchViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void | Promise<void>) => unknown
}

export function ScanPage({ onBarcodeChange }: ScanPageProps) {
    const navigate = useNavigate()
    usePageMetadata()
    const [cameraState, setCameraState] = useState<CameraState>("consent")
    const [cameraMessage, setCameraMessage] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const cameraSessionRef = useRef<BarcodeScannerSession | null>(null)
    const scanHandledRef = useRef(false)
    const cameraRunRef = useRef(0)
    const cameraStartPendingRef = useRef(false)
    const facingModeRef = useRef<CameraFacingMode>("environment")
    const pausedByShopperRef = useRef(false)
    const acquisitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    )

    const clearAcquisitionTimer = useCallback(() => {
        if (acquisitionTimerRef.current !== null) {
            clearTimeout(acquisitionTimerRef.current)
            acquisitionTimerRef.current = null
        }
    }, [])

    const releaseCamera = useCallback(() => {
        clearAcquisitionTimer()
        cameraRunRef.current += 1
        cameraSessionRef.current?.stop()
        cameraSessionRef.current = null
        stopCameraStream(videoRef.current?.srcObject ?? null)
        if (videoRef.current) videoRef.current.srcObject = null
    }, [clearAcquisitionTimer])

    const handleSearchNavigation = useCallback(
        (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault()
            releaseCamera()
            prepareSearchBridge()

            const updateSearchRoute = () => {
                flushSync(() => {
                    void navigate("/search", { state: { autoFocus: true } })
                })
            }
            const transitionDocument = document as SearchViewTransitionDocument

            if (transitionDocument.startViewTransition) {
                try {
                    transitionDocument.startViewTransition(updateSearchRoute)
                } catch {
                    // A second click can arrive while a view transition is active.
                    // Keep navigation reliable even when the browser rejects it.
                    updateSearchRoute()
                }
            } else {
                updateSearchRoute()
            }

            const searchInput = document.getElementById(
                "search",
            ) as HTMLInputElement | null
            if (searchInput) {
                searchInput.focus()
                const bridge = document.getElementById("mobile-keyboard-bridge")
                bridge?.remove()
            } else {
                setTimeout(() => {
                    if (typeof document === "undefined") return
                    const target = document.getElementById(
                        "search",
                    ) as HTMLInputElement | null
                    target?.focus()
                    const bridge = document.getElementById(
                        "mobile-keyboard-bridge",
                    )
                    bridge?.remove()
                }, 50)
            }
        },
        [navigate, releaseCamera],
    )

    const handleCameraResult = useCallback(
        (rawValue: string) => {
            if (scanHandledRef.current) return
            const validation = validateIdentifier(rawValue)
            scanHandledRef.current = true

            if (!validation.valid) {
                releaseCamera()
                const value = rawValue.trim()
                onBarcodeChange?.(value)
                void navigate(`/search?q=${encodeURIComponent(value)}`, {
                    state: { invalidBarcode: value },
                })
                return
            }

            // Freeze the current preview frame so the shopper sees the captured barcode
            try {
                videoRef.current?.pause()
            } catch {
                // Ignore pause failures in non-supporting environments like JSDOM
            }

            // Trigger physical haptic pulse (tactile double-tap confirmation)
            if (
                typeof navigator !== "undefined" &&
                typeof navigator.vibrate === "function"
            ) {
                try {
                    navigator.vibrate([40, 30, 40])
                } catch {
                    // Safe fallback if vibration is disallowed by permissions policy
                }
            }

            setCameraState("acquired")
            onBarcodeChange?.(validation.value)

            clearAcquisitionTimer()
            acquisitionTimerRef.current = setTimeout(() => {
                releaseCamera()
                void navigate(`/products/${validation.value}`, {
                    state: { fromScan: true },
                })
            }, ACQUISITION_LATCH_MS)
        },
        [clearAcquisitionTimer, navigate, onBarcodeChange, releaseCamera],
    )

    const startCamera = useCallback(
        async (facingMode: CameraFacingMode = facingModeRef.current) => {
            if (cameraStartPendingRef.current) return

            if (
                typeof window !== "undefined" &&
                window.isSecureContext === false
            ) {
                setCameraState("error")
                setCameraMessage(text.errorInsecure)
                return
            }

            if (!canUseCamera(videoRef.current)) {
                setCameraState("error")
                setCameraMessage(text.errorUnsupported)
                return
            }

            pausedByShopperRef.current = false
            scanHandledRef.current = false
            releaseCamera()
            const cameraRun = ++cameraRunRef.current
            facingModeRef.current = facingMode
            setCameraMessage(null)
            setCameraState("starting")
            cameraStartPendingRef.current = true

            try {
                const session = await barcodeScanner.start(
                    videoRef.current!,
                    handleCameraResult,
                    (error) => {
                        if (cameraRun !== cameraRunRef.current) return
                        releaseCamera()
                        setCameraState("error")
                        setCameraMessage(text[cameraErrorKey(error)])
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
                if (document.visibilityState === "hidden") {
                    session.stop()
                    setCameraState("paused")
                    return
                }
                cameraSessionRef.current = session
                setCameraState("scanning")
            } catch (error) {
                if (cameraRun !== cameraRunRef.current) return
                setCameraState("error")
                setCameraMessage(text[cameraErrorKey(error)])
                cameraSessionRef.current = null
            } finally {
                cameraStartPendingRef.current = false
            }
        },
        [handleCameraResult, releaseCamera],
    )

    useEffect(() => {
        if (hasStartedCameraThisSession()) void startCamera()
        return () => {
            clearAcquisitionTimer()
            releaseCamera()
        }
    }, [clearAcquisitionTimer, releaseCamera, startCamera])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                if (cameraStartPendingRef.current) return
                releaseCamera()
                if (hasStartedCameraThisSession()) setCameraState("paused")
                return
            }

            if (
                document.visibilityState === "visible" &&
                hasStartedCameraThisSession() &&
                !cameraStartPendingRef.current &&
                !cameraSessionRef.current &&
                !pausedByShopperRef.current
            ) {
                void startCamera()
            }
        }

        const handlePageHide = () => {
            releaseCamera()
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("pagehide", handlePageHide)
        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            )
            window.removeEventListener("pagehide", handlePageHide)
        }
    }, [releaseCamera, startCamera])

    const beginFirstCameraSession = () => {
        rememberCameraStarted()
        void startCamera()
    }

    const pauseCamera = () => {
        pausedByShopperRef.current = true
        releaseCamera()
        setCameraMessage(null)
        setCameraState("paused")
    }

    const resumeCamera = () => {
        pausedByShopperRef.current = false
        void startCamera()
    }

    const switchCamera = () => {
        const nextMode =
            facingModeRef.current === "environment" ? "user" : "environment"
        void startCamera(nextMode)
    }

    const statusMessage =
        cameraState === "acquired"
            ? text.detected
            : cameraState === "scanning"
              ? text.ready
              : cameraState === "starting"
                ? text.starting
                : cameraState === "paused"
                  ? text.paused
                  : cameraMessage

    return (
        <main className="mx-auto w-full max-w-xl px-4 pt-3 pb-8 sm:px-6 sm:pt-6">
            <h1 className="sr-only">{text.title}</h1>

            <section
                className="relative isolate min-h-[24rem] overflow-hidden rounded-3xl bg-[#131519] text-white shadow-[0_16px_40px_-24px_rgba(19,21,25,0.8)] ring-1 ring-[#303843] sm:min-h-[27rem]"
                aria-label={text.cameraLabel}
            >
                <video
                    ref={videoRef}
                    className={cn(
                        "absolute inset-0 block h-full w-full object-cover transition-opacity duration-300",
                        cameraState === "scanning" || cameraState === "acquired"
                            ? "opacity-100"
                            : "opacity-0",
                    )}
                    aria-hidden="true"
                    autoPlay
                    muted
                    playsInline
                />

                {cameraState === "consent" ? (
                    <div className="relative z-20 grid min-h-[24rem] place-items-center px-6 py-10 text-center sm:min-h-[27rem] sm:px-10">
                        <div className="max-w-xs">
                            <PrivacyScannerIllustration className="mx-auto mb-2 drop-shadow-md" />
                            <h2 className="mt-5 text-xl font-bold tracking-tight text-white">
                                {text.privacyTitle}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#9FB1CB]">
                                {text.privacyBody}
                            </p>
                            <Button
                                className="mt-5 min-h-11 rounded-xl bg-[#995613] px-6 text-sm font-bold text-white transition-all hover:bg-[#7B440D] active:scale-[0.98] active:bg-[#5A320B]"
                                type="button"
                                onClick={beginFirstCameraSession}
                            >
                                <CameraIcon
                                    aria-hidden="true"
                                    size={19}
                                    weight="bold"
                                />
                                <span>{text.start}</span>
                            </Button>
                        </div>
                    </div>
                ) : null}

                {cameraState === "starting" ? (
                    <div className="relative z-20 grid min-h-[24rem] place-items-center px-6 text-center sm:min-h-[27rem]">
                        <div className="flex flex-col items-center">
                            <ArrowClockwiseIcon
                                className="text-[#E7B583] motion-safe:animate-spin"
                                size={34}
                                weight="bold"
                                aria-hidden="true"
                            />
                            <p className="mt-4 text-sm font-bold text-[#E3E7ED]">
                                {text.starting}
                            </p>
                        </div>
                    </div>
                ) : null}

                {cameraState === "paused" ? (
                    <div className="relative z-20 grid min-h-[24rem] place-items-center px-6 py-10 text-center sm:min-h-[27rem]">
                        <div className="max-w-sm">
                            <div
                                className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#303843] text-[#C6CFDD]"
                                aria-hidden="true"
                            >
                                <PauseIcon size={30} weight="fill" />
                            </div>
                            <h2 className="mt-5 text-xl font-bold text-white">
                                {text.paused}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#9FB1CB]">
                                {text.pausedBody}
                            </p>
                            <Button
                                className="mt-6 min-h-11 rounded-xl bg-[#995613] px-6 text-sm font-bold text-white transition-all hover:bg-[#7B440D] active:scale-[0.98] active:bg-[#5A320B]"
                                type="button"
                                onClick={resumeCamera}
                            >
                                <PlayIcon
                                    aria-hidden="true"
                                    size={19}
                                    weight="fill"
                                />
                                <span>{text.resume}</span>
                            </Button>
                        </div>
                    </div>
                ) : null}

                {cameraState === "error" ? (
                    <div className="relative z-20 grid min-h-[24rem] place-items-center px-6 py-10 text-center sm:min-h-[27rem]">
                        <div className="max-w-sm">
                            <div
                                className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#431515] text-[#D99191] ring-1 ring-[#681D1D]"
                                aria-hidden="true"
                            >
                                <WarningCircleIcon size={32} weight="bold" />
                            </div>
                            <h2 className="mt-5 text-xl font-bold text-white">
                                {text.unavailable}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#C6CFDD]">
                                {cameraMessage}
                            </p>
                            <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
                                <Button
                                    className="min-h-12 rounded-xl bg-[#303843] px-6 font-bold text-white ring-1 ring-[#526073] transition-all hover:bg-[#404C5B] active:scale-[0.98]"
                                    type="button"
                                    onClick={() => void startCamera()}
                                    disabled={!canUseCamera(videoRef.current)}
                                >
                                    <ArrowClockwiseIcon
                                        aria-hidden="true"
                                        size={19}
                                        weight="bold"
                                    />
                                    <span>{text.tryAgain}</span>
                                </Button>
                                <Link
                                    to="/search"
                                    state={{ autoFocus: true }}
                                    onPointerDown={prepareSearchBridge}
                                    onClick={handleSearchNavigation}
                                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#F3E8DD] px-5 text-sm font-bold text-[#5A320B] shadow-[0_8px_20px_-14px_rgba(90,50,11,0.8)] ring-1 ring-[#E8C9A4] transition-all hover:bg-[#FFF8F0] focus-visible:ring-2 focus-visible:ring-[#F3E8DD] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131519] focus-visible:outline-none active:scale-[0.98]"
                                >
                                    <span>{text.enterBarcode}</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                ) : null}

                {cameraState === "scanning" || cameraState === "acquired" ? (
                    <>
                        <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
                            <div
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-white ring-1 transition-all duration-150",
                                    cameraState === "acquired"
                                        ? "bg-emerald-950/90 text-emerald-300 shadow-[0_0_12px_rgba(130,185,110,0.4)] ring-emerald-500/60"
                                        : "bg-black/70 ring-white/20",
                                )}
                            >
                                {cameraState === "acquired" ? (
                                    <CheckCircleIcon
                                        className="size-4 text-[#82B96E]"
                                        weight="fill"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <span
                                        className="size-2 rounded-full bg-[#82B96E] motion-safe:animate-pulse"
                                        aria-hidden="true"
                                    />
                                )}
                                <span className="text-xs font-bold">
                                    {cameraState === "acquired"
                                        ? text.detected
                                        : text.ready}
                                </span>
                            </div>
                        </div>

                        <div
                            className="pointer-events-none absolute inset-0 z-20 grid place-items-center p-6"
                            aria-hidden="true"
                        >
                            <div
                                className={cn(
                                    "relative aspect-[3/2] w-full max-w-[19rem] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.48)] ring-1 transition-all duration-150",
                                    cameraState === "acquired"
                                        ? "shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-[#82B96E] motion-safe:scale-[1.02]"
                                        : "ring-white/30",
                                )}
                            >
                                <ScanCorner
                                    className="top-0 left-0"
                                    isAcquired={cameraState === "acquired"}
                                />
                                <ScanCorner
                                    className="top-0 right-0 rotate-90"
                                    isAcquired={cameraState === "acquired"}
                                />
                                <ScanCorner
                                    className="right-0 bottom-0 rotate-180"
                                    isAcquired={cameraState === "acquired"}
                                />
                                <ScanCorner
                                    className="bottom-0 left-0 -rotate-90"
                                    isAcquired={cameraState === "acquired"}
                                />
                                {cameraState === "acquired" ? (
                                    <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[#82B96E] shadow-[0_0_12px_rgba(130,185,110,0.9)] transition-all duration-150" />
                                ) : (
                                    <div className="motion-safe:animate-scan-laser absolute inset-x-3 top-[10%] h-0.5 rounded-full bg-[#E19447] shadow-[0_0_10px_rgba(225,148,71,0.9)]" />
                                )}
                                <span
                                    className={cn(
                                        "absolute inset-x-4 bottom-3 text-center text-xs font-semibold drop-shadow-sm transition-colors",
                                        cameraState === "acquired"
                                            ? "font-bold text-emerald-300"
                                            : "text-white",
                                    )}
                                >
                                    {cameraState === "acquired"
                                        ? text.detected
                                        : text.scanning}
                                </span>
                            </div>
                        </div>

                        {cameraState === "scanning" ? (
                            <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-end gap-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-16">
                                <Button
                                    className="size-12 rounded-full border border-white/30 bg-black/60 p-0 text-white backdrop-blur-sm transition-all hover:bg-black/80 hover:text-white focus-visible:ring-white focus-visible:ring-offset-[#131519] active:scale-95 active:bg-black/90"
                                    variant="outline"
                                    type="button"
                                    aria-label={text.pause}
                                    onClick={pauseCamera}
                                >
                                    <PauseIcon
                                        aria-hidden="true"
                                        size={22}
                                        weight="fill"
                                    />
                                </Button>
                                <Button
                                    className="size-12 rounded-full border border-white/30 bg-black/60 p-0 text-white backdrop-blur-sm transition-all hover:bg-black/80 hover:text-white focus-visible:ring-white focus-visible:ring-offset-[#131519] active:scale-95 active:bg-black/90"
                                    variant="outline"
                                    type="button"
                                    aria-label={text.switch}
                                    onClick={switchCamera}
                                >
                                    <CameraRotateIcon
                                        aria-hidden="true"
                                        size={22}
                                        weight="bold"
                                    />
                                </Button>
                            </div>
                        ) : null}
                    </>
                ) : null}

                <div
                    className="sr-only"
                    role={cameraState === "error" ? "alert" : "status"}
                    aria-live={
                        cameraState === "error" || cameraState === "acquired"
                            ? "assertive"
                            : "polite"
                    }
                    aria-atomic="true"
                >
                    {statusMessage}
                </div>
            </section>

            <div className="mt-5 mb-3.5 flex items-center justify-center">
                <BrandLockup />
            </div>

            <div className="mx-auto w-full max-w-lg">
                <Link
                    to="/search"
                    state={{ autoFocus: true }}
                    onPointerDown={prepareSearchBridge}
                    onClick={handleSearchNavigation}
                    aria-label={text.searchLabel}
                    className={cn(
                        "group flex h-[60px] w-full items-center gap-3 rounded-2xl border border-neutral-200/90 bg-white px-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-all duration-150 select-none [view-transition-name:search-bar]",
                        "focus-visible:ring-primary-500 hover:border-neutral-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99]",
                    )}
                >
                    <span className="group-hover:bg-primary-50 group-hover:text-primary-700 grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-500 transition-colors">
                        <MagnifyingGlassIcon
                            size={18}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-500 transition-colors group-hover:text-neutral-800">
                        {text.searchPlaceholder}
                    </span>
                    <BrandMark size={24} />
                </Link>
            </div>
        </main>
    )
}

function ScanCorner({
    className,
    isAcquired = false,
}: {
    className: string
    isAcquired?: boolean
}) {
    return (
        <svg
            className={cn(
                "absolute size-8 transition-colors duration-150",
                isAcquired ? "text-[#82B96E]" : "text-[#E7B583]",
                className,
            )}
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M3 23V10a7 7 0 0 1 7-7h13"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}
