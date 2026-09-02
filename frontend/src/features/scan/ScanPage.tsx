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
import { Link, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { usePageMetadata } from "@/lib/metadata"
import { cn } from "@/lib/utils"
import { BrandLockup } from "@/ui/OpenLabelMark"

import { barcodeScanner, type BarcodeScannerSession } from "./barcodeScanner"
import { validateIdentifier } from "./identifier"
import { scanTranslations } from "./translations"

type ScanPageProps = {
    onBarcodeChange?: (barcode: string) => void
}

type CameraState = "consent" | "starting" | "scanning" | "paused" | "error"
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

export function ScanPage({ onBarcodeChange }: ScanPageProps) {
    const navigate = useNavigate()
    usePageMetadata()
    const [cameraState, setCameraState] = useState<CameraState>("consent")
    const [cameraMessage, setCameraMessage] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const cameraSessionRef = useRef<BarcodeScannerSession | null>(null)
    const scanHandledRef = useRef(false)
    const cameraRunRef = useRef(0)
    const facingModeRef = useRef<CameraFacingMode>("environment")
    const pausedByShopperRef = useRef(false)

    const releaseCamera = useCallback(() => {
        cameraRunRef.current += 1
        cameraSessionRef.current?.stop()
        cameraSessionRef.current = null
        stopCameraStream(videoRef.current?.srcObject ?? null)
        if (videoRef.current) videoRef.current.srcObject = null
    }, [])

    const handleCameraResult = useCallback(
        (rawValue: string) => {
            if (scanHandledRef.current) return
            const validation = validateIdentifier(rawValue)
            scanHandledRef.current = true
            releaseCamera()

            if (!validation.valid) {
                const value = rawValue.trim()
                onBarcodeChange?.(value)
                void navigate(`/search?q=${encodeURIComponent(value)}`, {
                    state: { invalidBarcode: value },
                })
                return
            }

            onBarcodeChange?.(validation.value)
            void navigate(`/products/${validation.value}`, {
                state: { fromScan: true },
            })
        },
        [navigate, onBarcodeChange, releaseCamera],
    )

    const startCamera = useCallback(
        async (facingMode: CameraFacingMode = facingModeRef.current) => {
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
                cameraSessionRef.current = session
                setCameraState("scanning")
            } catch (error) {
                if (cameraRun !== cameraRunRef.current) return
                setCameraState("error")
                setCameraMessage(text[cameraErrorKey(error)])
                cameraSessionRef.current = null
            }
        },
        [handleCameraResult, releaseCamera],
    )

    useEffect(() => {
        if (hasStartedCameraThisSession()) void startCamera()
        return releaseCamera
    }, [releaseCamera, startCamera])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                releaseCamera()
                if (hasStartedCameraThisSession()) setCameraState("paused")
                return
            }

            if (
                document.visibilityState === "visible" &&
                hasStartedCameraThisSession() &&
                !pausedByShopperRef.current
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
        cameraState === "scanning"
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
                    <div className="relative z-20 grid min-h-[24rem] place-items-center px-6 py-10 text-center sm:min-h-[27rem] sm:px-10">
                        <div className="max-w-sm">
                            <div
                                className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#303843] text-[#E7B583] ring-1 ring-white/10"
                                aria-hidden="true"
                            >
                                <LockKeyIcon size={30} weight="bold" />
                            </div>
                            <h2 className="mt-5 text-2xl leading-tight font-extrabold tracking-[-0.02em] text-white">
                                {text.privacyTitle}
                            </h2>
                            <p className="mt-3 text-sm leading-relaxed text-[#C6CFDD] sm:text-base">
                                {text.privacyBody}
                            </p>
                            <div className="mt-4 flex items-start justify-center gap-2 text-left text-xs leading-relaxed text-[#9FB1CB]">
                                <ShieldCheckIcon
                                    className="mt-0.5 shrink-0 text-[#E7B583]"
                                    size={17}
                                    weight="bold"
                                    aria-hidden="true"
                                />
                                <span>{text.privacySession}</span>
                            </div>
                            <Button
                                className="mt-7 min-h-12 rounded-xl bg-[#B86A1A] px-6 text-base font-extrabold text-white hover:bg-[#995613] active:bg-[#7B440D]"
                                type="button"
                                onClick={beginFirstCameraSession}
                            >
                                <CameraIcon
                                    aria-hidden="true"
                                    size={21}
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
                            <h2 className="mt-5 text-xl font-extrabold text-white">
                                {text.paused}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#9FB1CB]">
                                {text.pausedBody}
                            </p>
                            <Button
                                className="mt-6 min-h-12 rounded-xl bg-[#B86A1A] px-6 font-extrabold text-white hover:bg-[#995613] active:bg-[#7B440D]"
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
                            <h2 className="mt-5 text-xl font-extrabold text-white">
                                {text.unavailable}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#C6CFDD]">
                                {cameraMessage}
                            </p>
                            <Button
                                className="mt-6 min-h-12 rounded-xl bg-[#303843] px-6 font-bold text-white ring-1 ring-[#526073] hover:bg-[#404C5B]"
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
                        </div>
                    </div>
                ) : null}

                {cameraState === "scanning" ? (
                    <>
                        <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
                            <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3.5 py-1.5 text-white ring-1 ring-white/20">
                                <span
                                    className="size-2 rounded-full bg-[#82B96E] motion-safe:animate-pulse"
                                    aria-hidden="true"
                                />
                                <span className="text-xs font-bold">
                                    {text.ready}
                                </span>
                            </div>
                        </div>

                        <div
                            className="pointer-events-none absolute inset-0 z-20 grid place-items-center p-6"
                            aria-hidden="true"
                        >
                            <div className="relative aspect-[3/2] w-full max-w-[19rem] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.48)] ring-1 ring-white/30">
                                <ScanCorner className="top-0 left-0" />
                                <ScanCorner className="top-0 right-0 rotate-90" />
                                <ScanCorner className="right-0 bottom-0 rotate-180" />
                                <ScanCorner className="bottom-0 left-0 -rotate-90" />
                                <div className="motion-safe:animate-scan-laser absolute inset-x-3 top-[10%] h-0.5 rounded-full bg-[#E19447] shadow-[0_0_10px_rgba(225,148,71,0.9)]" />
                                <span className="absolute inset-x-4 bottom-3 text-center text-xs font-semibold text-white drop-shadow-sm">
                                    {text.scanning}
                                </span>
                            </div>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-end gap-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-16">
                            <Button
                                className="size-11 rounded-full border border-white/30 bg-black/55 p-0 text-white hover:bg-black/80 hover:text-white focus-visible:ring-white focus-visible:ring-offset-[#131519]"
                                variant="outline"
                                type="button"
                                aria-label={text.pause}
                                onClick={pauseCamera}
                            >
                                <PauseIcon
                                    aria-hidden="true"
                                    size={20}
                                    weight="fill"
                                />
                            </Button>
                            <Button
                                className="size-11 rounded-full border border-white/30 bg-black/55 p-0 text-white hover:bg-black/80 hover:text-white focus-visible:ring-white focus-visible:ring-offset-[#131519]"
                                variant="outline"
                                type="button"
                                aria-label={text.switch}
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
                    aria-live={cameraState === "error" ? "assertive" : "polite"}
                    aria-atomic="true"
                >
                    {statusMessage}
                </div>
            </section>

            <div className="mt-5 mb-3.5 flex items-center justify-center">
                <BrandLockup />
            </div>

            <div className="w-full">
                <Link
                    to="/search"
                    onClick={releaseCamera}
                    aria-label={text.searchLabel}
                    className={cn(
                        "group flex h-13 w-full items-center gap-3 rounded-2xl border border-neutral-200/90 bg-white px-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-all duration-150 select-none",
                        "focus-visible:ring-primary-500 hover:border-neutral-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99]",
                    )}
                >
                    <span className="group-hover:bg-primary-50 group-hover:text-primary-700 grid size-8 place-items-center rounded-xl bg-neutral-100 text-neutral-500 transition-colors">
                        <MagnifyingGlassIcon
                            size={18}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-neutral-500 transition-colors group-hover:text-neutral-800">
                        {text.searchPlaceholder}
                    </span>
                </Link>
            </div>
        </main>
    )
}

function ScanCorner({ className }: { className: string }) {
    return (
        <svg
            className={cn("absolute size-8 text-[#E7B583]", className)}
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
