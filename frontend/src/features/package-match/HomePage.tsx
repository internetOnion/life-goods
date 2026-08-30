import {
    ArrowClockwiseIcon,
    BarcodeIcon,
    CameraRotateIcon,
    InfoIcon,
    MagnifyingGlassIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import {
    type FormEvent,
    type KeyboardEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { barcodeScanner, type BarcodeScannerSession } from "./barcodeScanner"
import { validateIdentifier, type IdentifierValidation } from "./identifier"

type HomePageProps = {
    focusIdentifier?: boolean
    initialIdentifier: string
    isModalBackground?: boolean
    onIdentifierChange: (identifier: string) => void
}

type HomeLocationState = {
    invalidIdentifier?: string
}

type CameraState = "idle" | "starting" | "scanning" | "error"

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
    focusIdentifier = false,
    initialIdentifier,
    isModalBackground = false,
    onIdentifierChange,
}: HomePageProps) {
    const { i18n, t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "km"
    const targetLanguage = currentLanguage === "km" ? "en" : "km"
    const locationState = location.state as HomeLocationState | null
    const seededIdentifier =
        locationState?.invalidIdentifier ?? initialIdentifier
    const seededValidation = locationState?.invalidIdentifier
        ? validateIdentifier(locationState.invalidIdentifier)
        : undefined
    const [enteredIdentifier, setEnteredIdentifier] = useState(seededIdentifier)
    const [validationReason, setValidationReason] = useState<
        Extract<IdentifierValidation, { valid: false }>["reason"] | null
    >(
        seededValidation && !seededValidation.valid
            ? seededValidation.reason
            : null,
    )
    const [showIdentifierHint, setShowIdentifierHint] = useState(false)
    const [cameraState, setCameraState] = useState<CameraState>("starting")
    const [cameraMessage, setCameraMessage] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const cameraSessionRef = useRef<BarcodeScannerSession | null>(null)
    const cameraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scanHandledRef = useRef(false)
    const cameraRunRef = useRef(0)

    useEffect(() => {
        if (!enteredIdentifier && initialIdentifier) {
            setEnteredIdentifier(initialIdentifier)
        }
    }, [enteredIdentifier, initialIdentifier])

    const stopCamera = useCallback(() => {
        cameraRunRef.current += 1
        if (cameraTimerRef.current) {
            clearTimeout(cameraTimerRef.current)
            cameraTimerRef.current = null
        }
        cameraSessionRef.current?.stop()
        cameraSessionRef.current = null
        stopCameraStream(videoRef.current?.srcObject ?? null)
        if (videoRef.current) videoRef.current.srcObject = null
        setCameraState("idle")
    }, [])

    useEffect(() => {
        return () => stopCamera()
    }, [stopCamera])

    const canUseCamera = () =>
        typeof navigator !== "undefined" &&
        (typeof window === "undefined" || window.isSecureContext !== false) &&
        !!navigator.mediaDevices?.getUserMedia &&
        !!videoRef.current

    const handleCameraResult = useCallback(
        (rawValue: string) => {
            if (scanHandledRef.current) return
            const validation = validateIdentifier(rawValue)
            if (!validation.valid) {
                setCameraMessage(t("cameraInvalid"))
                return
            }

            scanHandledRef.current = true
            stopCamera()
            setEnteredIdentifier(validation.value)
            onIdentifierChange(validation.value)
            void navigate(`/results/${validation.value}`, {
                state: { fromBarcode: true },
            })
        },
        [navigate, onIdentifierChange, stopCamera, t],
    )

    const startCamera = useCallback(async () => {
        if (typeof window !== "undefined" && window.isSecureContext === false) {
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
        // A retry must never inherit a stream or decoder from a previous run.
        stopCamera()
        const cameraRun = ++cameraRunRef.current
        setCameraMessage(null)
        setCameraState("starting")

        try {
            const session = await barcodeScanner.start(
                videoRef.current!,
                handleCameraResult,
                (error) => {
                    stopCamera()
                    setCameraState("error")
                    setCameraMessage(t(cameraErrorKey(error)))
                },
            )
            if (cameraRun !== cameraRunRef.current || scanHandledRef.current) {
                session.stop()
                return
            }
            cameraSessionRef.current = session
            setCameraState("scanning")
            cameraTimerRef.current = setTimeout(() => {
                setCameraMessage(t("cameraDelayed"))
            }, 5000)
        } catch (error) {
            if (cameraRun !== cameraRunRef.current) return
            setCameraState("error")
            setCameraMessage(t(cameraErrorKey(error)))
            cameraSessionRef.current = null
        }
    }, [handleCameraResult, stopCamera, t])

    useEffect(() => {
        if (!isModalBackground) {
            void startCamera()
        } else {
            stopCamera()
        }
    }, [isModalBackground, startCamera, stopCamera])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden" || isModalBackground) {
                stopCamera()
            } else if (
                document.visibilityState === "visible" &&
                !isModalBackground
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
    }, [isModalBackground, startCamera, stopCamera])

    useEffect(() => {
        if (focusIdentifier) {
            inputRef.current?.focus()
        }
    }, [focusIdentifier])

    const submitIdentifier = (value: string) => {
        stopCamera()
        const validation = validateIdentifier(value)
        if (!validation.valid) {
            setValidationReason(validation.reason)
            inputRef.current?.focus()
            return
        }

        setValidationReason(null)
        setEnteredIdentifier(validation.value)
        onIdentifierChange(validation.value)
        void navigate(`/results/${validation.value}`, {
            state: { fromBarcode: true },
        })
    }

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        submitIdentifier(enteredIdentifier)
    }

    const validationMessage = validationReason
        ? t(`error.${validationReason}`)
        : undefined
    const describedBy = [
        showIdentifierHint ? "identifier-hint" : null,
        validationMessage ? "identifier-error" : null,
    ]
        .filter(Boolean)
        .join(" ")

    const toggleIdentifierHint = () => {
        setShowIdentifierHint((isVisible) => !isVisible)
    }

    return (
        <main className="mx-auto w-full space-y-3 pt-0 pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <section
                className={cn(
                    "border-border relative aspect-square w-full overflow-hidden rounded-none border-x-0 border-y max-[23.5rem]:aspect-auto max-[23.5rem]:h-[16.875rem] sm:aspect-auto sm:h-[clamp(18rem,48svh,30rem)] sm:rounded-3xl sm:border",
                    cameraState === "starting"
                        ? "bg-background"
                        : "bg-muted/60",
                )}
                aria-label={t("cameraTitle")}
            >
                <video
                    ref={videoRef}
                    className={cn(
                        "absolute inset-0 block h-full min-h-full w-full max-w-none min-w-full object-cover object-center",
                        cameraState === "scanning"
                            ? "opacity-100"
                            : "pointer-events-none opacity-0",
                    )}
                    aria-hidden="true"
                    autoPlay
                    muted
                    playsInline
                />
                <span className="border-primary/90 absolute top-4 left-4 h-8 w-8 rounded-tl-lg border-t border-l" />
                <span className="border-primary/90 absolute top-4 right-4 h-8 w-8 rounded-tr-lg border-t border-r" />
                <span className="border-primary/90 absolute bottom-4 left-4 h-8 w-8 rounded-bl-lg border-b border-l" />
                <span className="border-primary/90 absolute right-4 bottom-4 h-8 w-8 rounded-br-lg border-r border-b" />
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    {cameraState === "scanning" ? (
                        <div className="relative z-10 grid w-full max-w-md justify-items-center px-8 py-8 text-center max-[23.5rem]:-translate-y-5">
                            <div
                                className="border-background/90 h-24 w-[min(18rem,80vw)] rounded-xl border-2 shadow-[0_0_0_999px_oklch(0.12_0.02_160_/_0.18)]"
                                aria-hidden="true"
                            />
                        </div>
                    ) : cameraState === "error" ? (
                        <div className="relative z-10 grid max-w-md justify-items-center gap-3 px-8 py-8 text-center">
                            <span
                                className="border-primary/15 bg-background text-primary grid size-[4.6rem] place-items-center rounded-[44%_56%_50%_50%/52%_45%_55%_48%] border"
                                aria-hidden="true"
                            >
                                <WarningCircleIcon size={48} weight="light" />
                            </span>
                            <div>
                                <h1 className="text-xl leading-[1.7] font-bold tracking-tight text-balance">
                                    {t("cameraUnavailable")}
                                </h1>
                                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                                    {cameraMessage}
                                </p>
                            </div>
                            <Button
                                className="pointer-events-auto"
                                type="button"
                                onClick={() => void startCamera()}
                                disabled={!canUseCamera()}
                            >
                                <ArrowClockwiseIcon
                                    aria-hidden="true"
                                    size={21}
                                />
                                {t("cameraTryAgain")}
                            </Button>
                        </div>
                    ) : null}
                </div>
                <div
                    className="sr-only"
                    role={cameraState === "error" ? "alert" : "status"}
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {cameraState === "scanning"
                        ? t("cameraScanning")
                        : cameraState === "starting"
                          ? t("cameraStarting")
                          : cameraMessage}
                </div>
                {cameraState === "starting" || cameraState === "scanning" ? (
                    <Button
                        aria-label={t("switchToCamera")}
                        aria-disabled="true"
                        className="border-background/70 bg-background/95 text-primary hover:bg-background hover:text-primary absolute right-8 bottom-10 z-20 size-11 rounded-full p-0 shadow-sm [&_svg]:size-6"
                        tabIndex={-1}
                        type="button"
                        variant="outline"
                    >
                        <CameraRotateIcon aria-hidden="true" />
                    </Button>
                ) : null}
            </section>

            <div className="mx-4 flex min-h-14 items-center justify-center py-2 max-[23.5rem]:mx-[0.625rem] max-[23.5rem]:min-h-10 max-[23.5rem]:py-1 sm:mx-0">
                <img
                    alt="LifeGoods"
                    className="h-auto w-[10rem] max-[23.5rem]:w-36 sm:w-[11rem]"
                    height="360"
                    src="/branding/lifegoods-logo.png"
                    width="1600"
                />
            </div>

            <form
                className="border-border bg-background mx-4 grid grid-cols-[minmax(0,1fr)_3.5rem] gap-x-1 gap-y-2 rounded-2xl border p-4 max-[23.5rem]:mx-[0.625rem] sm:mx-0 sm:grid-cols-[minmax(0,1fr)_4rem] sm:gap-x-2 sm:p-5"
                noValidate
                onSubmit={onSubmit}
                onClick={() => void navigate("/search")}
            >
                <Button
                    className="text-primary hover:text-primary col-start-2 row-start-1 size-9 !min-h-0 justify-self-center rounded-full border-0 bg-transparent p-0 hover:bg-transparent [&_svg]:size-full"
                    variant="outline"
                    type="button"
                    aria-label={t(
                        targetLanguage === "en"
                            ? "switchToEnglish"
                            : "switchToKhmer",
                    )}
                    onClick={() => void i18n.changeLanguage(targetLanguage)}
                >
                    <span className="grid size-9 place-items-center rounded-full">
                        <LanguageFlag language={currentLanguage} />
                    </span>
                </Button>
                <div className="relative flex items-center gap-1">
                    <Label className="text-primary" htmlFor="identifier">
                        {t("fieldLabel")}
                    </Label>
                    <Button
                        aria-controls="identifier-hint"
                        aria-expanded={showIdentifierHint}
                        aria-label={t(
                            showIdentifierHint
                                ? "fieldHintHide"
                                : "fieldHintShow",
                        )}
                        className="text-primary size-5 !min-h-0 p-0 hover:bg-transparent"
                        onClick={toggleIdentifierHint}
                        size="icon"
                        type="button"
                        variant="ghost"
                    >
                        <InfoIcon aria-hidden="true" size={19} />
                    </Button>
                    {showIdentifierHint ? (
                        <div
                            className="border-border bg-background text-foreground absolute top-[calc(100%+0.5rem)] right-0 z-20 w-[min(18rem,calc(100vw-2rem))] rounded-xl border p-3 text-left text-sm leading-relaxed shadow-lg sm:top-1/2 sm:right-auto sm:left-full sm:ml-2 sm:-translate-y-1/2"
                            id="identifier-hint"
                            role="note"
                        >
                            {t("fieldHint")}
                        </div>
                    ) : null}
                </div>
                <div
                    className={cn(
                        "border-input bg-background focus-within:border-ring focus-within:ring-ring/40 col-span-2 row-start-2 flex min-h-14 overflow-hidden rounded-xl border transition-colors focus-within:ring-2",
                        validationMessage &&
                            "border-destructive focus-within:border-destructive focus-within:ring-destructive/30",
                    )}
                >
                    <span
                        className="text-muted-foreground grid shrink-0 place-items-center pl-3"
                        aria-hidden="true"
                    >
                        <BarcodeIcon size={25} />
                    </span>
                    <Input
                        ref={inputRef}
                        className="h-auto min-w-0 flex-1 rounded-none border-0 px-3 py-3 text-base shadow-none focus-visible:ring-0"
                        id="identifier"
                        name="identifier"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={enteredIdentifier}
                        placeholder={t("fieldPlaceholder")}
                        aria-describedby={describedBy || undefined}
                        aria-errormessage={
                            validationMessage ? "identifier-error" : undefined
                        }
                        aria-invalid={validationMessage ? true : undefined}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                            if (
                                event.key === "Enter" &&
                                !enteredIdentifier.trim()
                            ) {
                                event.preventDefault()
                                submitIdentifier(enteredIdentifier)
                            }
                        }}
                        onChange={(event) => {
                            setEnteredIdentifier(event.target.value)
                            onIdentifierChange(event.target.value)
                            setValidationReason(null)
                        }}
                    />
                    <Button
                        aria-label={t("submit")}
                        className="h-auto min-h-14 shrink-0 rounded-none px-4 sm:px-5"
                        type="submit"
                        disabled={!enteredIdentifier.trim()}
                    >
                        <MagnifyingGlassIcon aria-hidden="true" size={24} />
                    </Button>
                </div>
                {validationMessage ? (
                    <p
                        className="text-destructive col-span-2 row-start-3 mt-0 text-sm leading-relaxed font-semibold"
                        id="identifier-error"
                        role="alert"
                    >
                        {validationMessage}
                    </p>
                ) : null}
            </form>
        </main>
    )
}

function LanguageFlag({ language }: { language: "en" | "km" }) {
    if (language === "km") {
        return (
            <img
                alt=""
                aria-hidden="true"
                className="size-full rounded-full object-cover"
                data-language-flag="km"
                height="640"
                src="/flags/cambodia.svg"
                width="1000"
            />
        )
    }

    return (
        <svg
            aria-hidden="true"
            className="size-full overflow-hidden rounded-full object-cover"
            data-language-flag="en"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 30 20"
        >
            <rect width="30" height="20" fill="#012169" />
            <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="5" />
            <path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" strokeWidth="2.2" />
            <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
            <path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3.4" />
        </svg>
    )
}
