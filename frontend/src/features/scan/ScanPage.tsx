import {
    ArrowClockwiseIcon,
    CameraIcon,
    CameraRotateIcon,
    FlashlightIcon,
    MagnifyingGlassIcon,
    PauseIcon,
    PlayIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Link, useNavigate } from "react-router"

import { CameraAperture } from "@/components/camera/CameraAperture"
import { Button } from "@/components/ui/button"
import { PrivacyScannerIllustration } from "@/components/illustrations"
import { BrandLockup, BrandMark } from "@/components/brand/BrandMark"
import { LanguageSelector } from "@/components/layout/LanguageSelector"
import { useLocale } from "@/i18n/locale"
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
    | "errorTimeout"

const ACQUISITION_LATCH_MS = 180
const CAMERA_RESTART_TIMEOUT_MS = 5000
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
    if (name === "CameraStartTimeoutError") return "errorTimeout"
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

export function ScanPage({ onBarcodeChange }: ScanPageProps) {
    const navigate = useNavigate()
    const { locale } = useLocale()
    usePageMetadata()
    const [cameraState, setCameraState] = useState<CameraState>("consent")
    const [cameraMessage, setCameraMessage] = useState<string | null>(null)
    const [torchAvailable, setTorchAvailable] = useState(false)
    const [torchEnabled, setTorchEnabled] = useState(false)
    const [torchPending, setTorchPending] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const cameraSessionRef = useRef<BarcodeScannerSession | null>(null)
    const scanHandledRef = useRef(false)
    const cameraRunRef = useRef(0)
    const cameraStartPendingRef = useRef(false)
    const cameraStartAbortRef = useRef<AbortController | null>(null)
    const facingModeRef = useRef<CameraFacingMode>("environment")
    const pausedByShopperRef = useRef(false)
    const acquisitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    )
    const text = scanTranslations[locale].scan
    const textRef = useRef(text)
    textRef.current = text

    const clearAcquisitionTimer = useCallback(() => {
        if (acquisitionTimerRef.current !== null) {
            clearTimeout(acquisitionTimerRef.current)
            acquisitionTimerRef.current = null
        }
    }, [])

    const releaseCamera = useCallback(() => {
        clearAcquisitionTimer()
        cameraRunRef.current += 1
        cameraStartAbortRef.current?.abort()
        cameraStartAbortRef.current = null
        cameraSessionRef.current?.stop()
        cameraSessionRef.current = null
        stopCameraStream(videoRef.current?.srcObject ?? null)
        if (videoRef.current) videoRef.current.srcObject = null
    }, [clearAcquisitionTimer])

    const navigateToSearch = useCallback(() => {
        releaseCamera()
        flushSync(() => {
            void navigate("/search", { state: { autoFocus: true } })
        })
        const searchInput = document.getElementById(
            "search",
        ) as HTMLInputElement | null
        searchInput?.focus({ preventScroll: true })
    }, [navigate, releaseCamera])

    const handleSearchPointerDown = useCallback(
        (e: React.PointerEvent<HTMLAnchorElement>) => {
            if (e.pointerType === "mouse") return
            e.preventDefault()
            navigateToSearch()
        },
        [navigateToSearch],
    )

    const handleSearchNavigation = useCallback(
        (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault()
            navigateToSearch()
        },
        [navigateToSearch],
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
        async (
            facingMode: CameraFacingMode = facingModeRef.current,
            useAcquisitionDeadline = true,
        ) => {
            if (cameraStartPendingRef.current) return

            if (
                typeof window !== "undefined" &&
                window.isSecureContext === false
            ) {
                setCameraState("error")
                setCameraMessage(textRef.current.errorInsecure)
                return
            }

            if (!canUseCamera(videoRef.current)) {
                setCameraState("error")
                setCameraMessage(textRef.current.errorUnsupported)
                return
            }

            pausedByShopperRef.current = false
            scanHandledRef.current = false
            releaseCamera()
            setTorchAvailable(false)
            setTorchEnabled(false)
            const cameraRun = ++cameraRunRef.current
            facingModeRef.current = facingMode
            setCameraMessage(null)
            setCameraState("starting")
            cameraStartPendingRef.current = true
            const abortController = new AbortController()
            cameraStartAbortRef.current = abortController

            try {
                const session = await barcodeScanner.start(
                    videoRef.current!,
                    handleCameraResult,
                    (error) => {
                        if (cameraRun !== cameraRunRef.current) return
                        releaseCamera()
                        setCameraState("error")
                        setCameraMessage(textRef.current[cameraErrorKey(error)])
                    },
                    {
                        ...(useAcquisitionDeadline
                            ? {
                                  acquisitionTimeoutMs:
                                      CAMERA_RESTART_TIMEOUT_MS,
                              }
                            : {}),
                        facingMode,
                        signal: abortController.signal,
                    },
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
                setTorchAvailable(session.torchAvailable)
                setCameraState("scanning")
            } catch (error) {
                if (cameraRun !== cameraRunRef.current) return
                setCameraState("error")
                setCameraMessage(textRef.current[cameraErrorKey(error)])
                cameraSessionRef.current = null
            } finally {
                if (cameraStartAbortRef.current === abortController) {
                    cameraStartAbortRef.current = null
                }
                cameraStartPendingRef.current = false
            }
        },
        [handleCameraResult, releaseCamera],
    )

    useEffect(() => {
        let autoStartTimer: ReturnType<typeof setTimeout> | null = null
        if (hasStartedCameraThisSession()) {
            autoStartTimer = setTimeout(() => {
                autoStartTimer = null
                void startCamera()
            }, 0)
        }
        return () => {
            if (autoStartTimer !== null) clearTimeout(autoStartTimer)
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
        void startCamera(facingModeRef.current, false)
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

    const toggleTorch = async () => {
        const session = cameraSessionRef.current
        if (!session?.torchAvailable || torchPending) return

        const nextTorchState = !torchEnabled
        setTorchPending(true)
        try {
            await session.setTorch(nextTorchState)
            if (cameraSessionRef.current !== session) return
            setTorchEnabled(nextTorchState)
            setCameraMessage(null)
        } catch {
            setCameraMessage(text.flashError)
        } finally {
            setTorchPending(false)
        }
    }

    const statusMessage =
        cameraState === "acquired"
            ? text.detected
            : cameraState === "scanning"
              ? (cameraMessage ?? text.ready)
              : cameraState === "starting"
                ? text.starting
                : cameraState === "paused"
                  ? text.paused
                  : cameraMessage

    return (
        <main className="page-rail page-rail-tight sm:px-6 sm:pt-6">
            <div className="mb-4 flex min-h-11 items-center justify-between">
                <BrandLockup compact />
                <LanguageSelector appearance="glass" />
            </div>
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
                        <div className="max-w-[20rem]">
                            <PrivacyScannerIllustration className="mx-auto drop-shadow-md" />
                            <h2 className="mt-6 text-xl font-bold tracking-tight text-white">
                                {text.privacyTitle}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#9FB1CB]">
                                {text.privacyBody}
                            </p>
                            <Button
                                appearance="glass"
                                glassTone="primary"
                                className="mt-6 min-h-11 rounded-full px-6 text-sm font-bold"
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
                        <div className="flex max-w-[20rem] flex-col items-center">
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
                        <div className="flex max-w-[20rem] flex-col items-center">
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
                                appearance="glass"
                                glassTone="primary"
                                className="mt-6 min-h-11 rounded-full px-6 text-sm font-bold"
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
                        <div
                            data-glass-surface="camera"
                            className="max-w-sm rounded-2xl p-5 sm:p-6"
                        >
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
                                    appearance="glass"
                                    glassTone="neutral"
                                    variant="ghost"
                                    className="min-h-12 rounded-full px-6 font-bold"
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
                                <Button
                                    asChild
                                    appearance="glass"
                                    glassTone="selected"
                                    variant="ghost"
                                    className="min-h-12 rounded-full px-5 text-sm font-bold"
                                >
                                    <Link
                                        to="/search"
                                        onPointerDown={handleSearchPointerDown}
                                        onClick={handleSearchNavigation}
                                    >
                                        <span>{text.enterBarcode}</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}

                {cameraState === "scanning" || cameraState === "acquired" ? (
                    <>
                        <CameraAperture
                            status={
                                cameraState === "acquired"
                                    ? text.detected
                                    : text.ready
                            }
                            frameLabel={
                                cameraState === "acquired"
                                    ? text.detected
                                    : text.scanning
                            }
                            isAcquired={cameraState === "acquired"}
                        />

                        {cameraState === "scanning" ? (
                            <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-end gap-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-16">
                                <Button
                                    appearance="glass"
                                    glassTone={
                                        torchEnabled ? "selected" : "neutral"
                                    }
                                    className="size-12 rounded-full p-0 focus-visible:ring-white focus-visible:ring-offset-[#131519] active:scale-95"
                                    variant="ghost"
                                    type="button"
                                    aria-label={
                                        !torchAvailable
                                            ? text.flashUnavailable
                                            : torchEnabled
                                              ? text.flashOff
                                              : text.flashOn
                                    }
                                    aria-pressed={torchEnabled}
                                    title={
                                        torchAvailable
                                            ? undefined
                                            : text.flashUnavailable
                                    }
                                    onClick={() => void toggleTorch()}
                                    disabled={!torchAvailable || torchPending}
                                >
                                    <FlashlightIcon
                                        aria-hidden="true"
                                        size={22}
                                        weight={torchEnabled ? "fill" : "bold"}
                                    />
                                </Button>
                                <Button
                                    appearance="glass"
                                    glassTone="neutral"
                                    className="ml-auto size-12 rounded-full p-0 focus-visible:ring-white focus-visible:ring-offset-[#131519] active:scale-95"
                                    variant="ghost"
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
                                    appearance="glass"
                                    glassTone="neutral"
                                    className="size-12 rounded-full p-0 focus-visible:ring-white focus-visible:ring-offset-[#131519] active:scale-95"
                                    variant="ghost"
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

            <div className="mx-auto mt-4 w-full max-w-lg">
                <Button
                    asChild
                    appearance="glass"
                    glassTone="neutral"
                    variant="ghost"
                    className={cn(
                        "group relative flex h-[60px] w-full items-center rounded-full pr-20 pl-[3.25rem] text-base font-normal text-neutral-600 select-none [view-transition-name:search-bar]",
                        "focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    )}
                >
                    <Link
                        to="/search"
                        onPointerDown={handleSearchPointerDown}
                        onClick={handleSearchNavigation}
                        aria-label={text.searchLabel}
                    >
                        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                            <BrandMark size={22} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                            {text.searchPlaceholder}
                        </span>
                        <span className="pointer-events-none absolute top-1/2 right-0 grid size-[60px] -translate-y-1/2 place-items-center rounded-full bg-neutral-800 text-white shadow-[0_6px_14px_-10px_rgba(19,21,25,0.75)]">
                            <MagnifyingGlassIcon
                                size={22}
                                weight="bold"
                                aria-hidden="true"
                            />
                        </span>
                    </Link>
                </Button>
            </div>
        </main>
    )
}
