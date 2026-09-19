import type { BrowserMultiFormatOneDReader } from "@zxing/browser"

export type BarcodeScannerError = unknown

export type BarcodeScannerSession = {
    stop: () => void
    torchAvailable: boolean
    setTorch: (enabled: boolean) => Promise<void>
}

export type BarcodeScannerOptions = {
    acquisitionTimeoutMs?: number
    facingMode?: "environment" | "user"
    signal?: AbortSignal
}

export type BarcodeScanner = {
    start: (
        video: HTMLVideoElement,
        onResult: (value: string) => void,
        onError: (error: BarcodeScannerError) => void,
        options?: BarcodeScannerOptions,
    ) => Promise<BarcodeScannerSession>
}

const previewReadyTimeoutMs = 5000
const previewReadyEvents = [
    "loadedmetadata",
    "loadeddata",
    "canplay",
    "canplaythrough",
    "playing",
    "timeupdate",
    "resize",
]

class CameraPreviewError extends Error {
    override name = "CameraPreviewError"
}

class CameraStartTimeoutError extends Error {
    override name = "CameraStartTimeoutError"
}

function constraintStages(
    facingMode: "environment" | "user",
): MediaStreamConstraints[] {
    return [
        {
            audio: false,
            video: {
                facingMode: { ideal: facingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
        },
        { audio: false, video: { facingMode: { ideal: facingMode } } },
        { audio: false, video: { facingMode } },
        { audio: false, video: true },
    ]
}

async function acquireMediaStream(
    facingMode: "environment" | "user",
    options?: Pick<BarcodeScannerOptions, "acquisitionTimeoutMs" | "signal">,
): Promise<MediaStream> {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.getUserMedia) {
        throw new DOMException("Camera API is unavailable", "NotSupportedError")
    }

    const deadline =
        options?.acquisitionTimeoutMs === undefined
            ? null
            : Date.now() + options.acquisitionTimeoutMs
    let lastError: unknown = null
    for (const constraints of constraintStages(facingMode)) {
        try {
            const remainingMs =
                deadline === null
                    ? undefined
                    : Math.max(0, deadline - Date.now())
            return await acquireMediaStreamAttempt(
                mediaDevices,
                constraints,
                remainingMs,
                options?.signal,
            )
        } catch (error) {
            lastError = error
            const name =
                typeof error === "object" && error !== null && "name" in error
                    ? error.name
                    : undefined
            if (
                name === "NotAllowedError" ||
                name === "SecurityError" ||
                name === "PermissionDeniedError" ||
                name === "AbortError" ||
                name === "CameraStartTimeoutError"
            ) {
                throw error
            }
        }
    }

    if (lastError instanceof Error) {
        throw lastError
    }

    throw new DOMException("Unable to acquire camera stream", "NotFoundError")
}

function acquireMediaStreamAttempt(
    mediaDevices: MediaDevices,
    constraints: MediaStreamConstraints,
    timeoutMs: number | undefined,
    signal: AbortSignal | undefined,
): Promise<MediaStream> {
    const request = mediaDevices.getUserMedia(constraints)

    return new Promise((resolve, reject) => {
        let settled = false
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const cleanup = () => {
            if (timeoutId !== null) clearTimeout(timeoutId)
            signal?.removeEventListener("abort", handleAbort)
        }

        const rejectOnce = (error: unknown) => {
            if (settled) return
            settled = true
            cleanup()
            reject(error instanceof Error ? error : new Error(String(error)))
        }

        const handleAbort = () => {
            rejectOnce(new DOMException("Camera start cancelled", "AbortError"))
        }

        signal?.addEventListener("abort", handleAbort, { once: true })
        if (signal?.aborted) {
            handleAbort()
        } else if (timeoutMs !== undefined) {
            timeoutId = setTimeout(() => {
                rejectOnce(
                    new CameraStartTimeoutError(
                        "The camera did not start before its deadline",
                    ),
                )
            }, timeoutMs)
        }

        request.then(
            (stream) => {
                if (settled) {
                    stopStream(stream)
                    return
                }
                settled = true
                cleanup()
                resolve(stream)
            },
            (error: unknown) => rejectOnce(error),
        )
    })
}

function hasDrawableFrame(video: HTMLVideoElement) {
    return (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
    )
}

function startVideoPreview(video: HTMLVideoElement, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        let playbackInitiated = false
        let frameCallbackId: number | null = null
        let animationFrameId: number | null = null
        let pollIntervalId: ReturnType<typeof setInterval> | null = null
        let settled = false

        const cleanup = () => {
            clearTimeout(timeout)
            if (pollIntervalId !== null) clearInterval(pollIntervalId)
            if (
                animationFrameId !== null &&
                typeof cancelAnimationFrame === "function"
            ) {
                cancelAnimationFrame(animationFrameId)
            }
            if (
                frameCallbackId !== null &&
                "cancelVideoFrameCallback" in video &&
                typeof video.cancelVideoFrameCallback === "function"
            ) {
                video.cancelVideoFrameCallback(frameCallbackId)
            }
            previewReadyEvents.forEach((eventName) =>
                video.removeEventListener(eventName, checkReady),
            )
            signal?.removeEventListener("abort", handleAbort)
        }

        const finish = (error?: Error) => {
            if (settled) return
            settled = true
            cleanup()
            if (error) reject(error)
            else resolve()
        }

        function handleAbort() {
            finish(new DOMException("Camera start cancelled", "AbortError"))
        }

        const isPlaybackActive = () =>
            playbackInitiated || !video.paused || video.currentTime > 0

        const checkReady = () => {
            if (isPlaybackActive() && hasDrawableFrame(video)) {
                finish()
            }
        }

        const failPlayback = (cause: unknown) => {
            finish(
                new CameraPreviewError(
                    "The camera preview could not start playback",
                    { cause },
                ),
            )
        }

        const timeout = setTimeout(() => {
            finish(
                new CameraPreviewError(
                    "The camera preview did not produce a drawable frame",
                ),
            )
        }, previewReadyTimeoutMs)

        previewReadyEvents.forEach((eventName) =>
            video.addEventListener(eventName, checkReady),
        )
        signal?.addEventListener("abort", handleAbort, { once: true })
        if (signal?.aborted) {
            handleAbort()
            return
        }

        const onVideoFrame = () => {
            checkReady()
            if (
                !settled &&
                "requestVideoFrameCallback" in video &&
                typeof video.requestVideoFrameCallback === "function"
            ) {
                frameCallbackId = video.requestVideoFrameCallback(onVideoFrame)
            }
        }

        if (
            "requestVideoFrameCallback" in video &&
            typeof video.requestVideoFrameCallback === "function"
        ) {
            frameCallbackId = video.requestVideoFrameCallback(onVideoFrame)
        }

        const scheduleFrameCheck = () => {
            if (settled) return
            checkReady()
            if (!settled) {
                if (typeof requestAnimationFrame === "function") {
                    animationFrameId = requestAnimationFrame(scheduleFrameCheck)
                }
            }
        }

        if (typeof requestAnimationFrame === "function") {
            animationFrameId = requestAnimationFrame(scheduleFrameCheck)
        }
        if (typeof setInterval === "function") {
            pollIntervalId = setInterval(checkReady, 50)
        }

        checkReady()

        try {
            void video.play().then(() => {
                playbackInitiated = true
                checkReady()
            }, failPlayback)
        } catch (error) {
            failPlayback(error)
        }
    })
}

function getStreamTracks(stream: MediaStream): MediaStreamTrack[] {
    if (typeof stream.getVideoTracks === "function") {
        return stream.getVideoTracks()
    }
    if (typeof stream.getTracks === "function") {
        return stream.getTracks()
    }
    return []
}

type TorchCapability = boolean | boolean[]

function canEnableTorch(capability: TorchCapability | undefined) {
    return (
        capability === true ||
        (Array.isArray(capability) && capability.includes(true))
    )
}

function getTorchTrack(stream: MediaStream): MediaStreamTrack | null {
    for (const track of getStreamTracks(stream)) {
        if (
            track.kind !== "video" ||
            typeof track.applyConstraints !== "function" ||
            typeof track.getCapabilities !== "function"
        ) {
            continue
        }

        try {
            const capabilities =
                track.getCapabilities() as MediaTrackCapabilities & {
                    torch?: TorchCapability
                }
            if (canEnableTorch(capabilities.torch)) return track
        } catch {
            // Some browsers expose the camera track but not its capabilities.
        }
    }

    return null
}

function stopStream(stream: MediaStream) {
    getStreamTracks(stream).forEach((track) => track.stop())
}

function detachStream(video: HTMLVideoElement, stream: MediaStream) {
    stopStream(stream)
    if (video.srcObject === stream) video.srcObject = null
}

const nativeDetectorTimeoutMs = 600
const nativeDetectFrameTimeoutMs = 250

function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false
        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            reject(new Error(errorMessage))
        }, timeoutMs)

        promise.then(
            (val) => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                resolve(val)
            },
            (err: unknown) => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                reject(err instanceof Error ? err : new Error(String(err)))
            },
        )
    })
}

type NativeDetector = {
    detect: (
        source: ImageBitmapSource | HTMLVideoElement | HTMLCanvasElement,
    ) => Promise<Array<{ rawValue: string }>>
}

async function getNativeDetector(): Promise<NativeDetector | null> {
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
        return null
    }
    try {
        const formatsPromise = (
            window as unknown as {
                BarcodeDetector: {
                    getSupportedFormats: () => Promise<string[]>
                }
            }
        ).BarcodeDetector.getSupportedFormats()

        const formats = await withTimeout(
            formatsPromise,
            nativeDetectorTimeoutMs,
            "BarcodeDetector format detection timed out",
        )
        if (
            Array.isArray(formats) &&
            (formats.includes("ean_13") ||
                formats.includes("ean_8") ||
                formats.includes("upc_a") ||
                formats.includes("code_128"))
        ) {
            const DetectorClass = (
                window as unknown as {
                    BarcodeDetector: new (options?: {
                        formats: string[]
                    }) => NativeDetector
                }
            ).BarcodeDetector
            return new DetectorClass({
                formats: formats.filter((f) =>
                    [
                        "ean_13",
                        "ean_8",
                        "upc_a",
                        "upc_e",
                        "code_128",
                        "code_39",
                        "itf",
                    ].includes(f),
                ),
            })
        }
    } catch {
        return null
    }
    return null
}

export const barcodeScanner: BarcodeScanner = {
    async start(video, onResult, onError, options) {
        const facingMode = options?.facingMode ?? "environment"
        const stream = await acquireMediaStream(facingMode, options)

        // Start decoder initialization while the camera negotiates and the
        // preview becomes drawable. Neither capability detection nor loading
        // the fallback decoder should keep the shopper on the startup state.
        const nativeDetectorPromise = getNativeDetector()
        const zxingReaderPromise = import("@zxing/browser").then(
            ({ BrowserMultiFormatOneDReader }) =>
                new BrowserMultiFormatOneDReader(),
        )

        video.muted = true
        video.playsInline = true
        video.setAttribute("playsinline", "true")
        video.setAttribute("webkit-playsinline", "true")
        video.autoplay = true
        video.srcObject = stream

        let nativeDetector: NativeDetector | null = null
        let zxingReader: BrowserMultiFormatOneDReader | null = null

        try {
            await startVideoPreview(video, options?.signal)
        } catch (error) {
            detachStream(video, stream)
            throw error
        }

        // Camera capabilities may not be populated until the preview is
        // actually streaming, especially in Android browsers.
        const torchTrack = getTorchTrack(stream)
        const torchAvailable = torchTrack !== null

        let stopped = false
        let decoderError: unknown = null
        let animationFrameId: number | null = null
        let pollTimeoutId: ReturnType<typeof setTimeout> | null = null
        let lastScanTimestamp = 0
        let torchEnabled = false
        const scanIntervalMs = 50

        const setTorch = async (enabled: boolean) => {
            if (!torchTrack) {
                throw new DOMException(
                    "Torch control is unavailable",
                    "NotSupportedError",
                )
            }

            const constraints = {
                advanced: [{ torch: enabled }],
            } as unknown as MediaTrackConstraints
            await torchTrack.applyConstraints(constraints)
            torchEnabled = enabled
        }

        void nativeDetectorPromise.then((detector) => {
            nativeDetector = detector
        })
        void zxingReaderPromise.then(
            (reader) => {
                zxingReader = reader
            },
            (error: unknown) => {
                decoderError = error
                // Let start() return its live preview before surfacing a
                // decoder loading failure to the page.
                setTimeout(() => {
                    if (!stopped) onError(error)
                }, 0)
            },
        )

        const handleTrackEnded = () => {
            if (!stopped) {
                onError(new DOMException("Camera stream ended", "AbortError"))
            }
        }

        getStreamTracks(stream).forEach((track) => {
            track.addEventListener("ended", handleTrackEnded)
        })

        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d", { willReadFrequently: true })

        const scanFrame = async () => {
            if (stopped) return

            if (decoderError) return

            const now = Date.now()
            if (
                video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
                video.videoWidth > 0 &&
                video.videoHeight > 0
            ) {
                if (now - lastScanTimestamp >= scanIntervalMs) {
                    lastScanTimestamp = now
                    try {
                        if (nativeDetector) {
                            let barcodes: Array<{ rawValue: string }> | null =
                                null
                            try {
                                barcodes = await withTimeout(
                                    nativeDetector.detect(video),
                                    nativeDetectFrameTimeoutMs,
                                    "Native barcode detection frame timeout",
                                )
                            } catch {
                                // Native detection timed out or failed; permanently discard it and fall back to zxing
                                nativeDetector = null
                            }

                            if (
                                barcodes &&
                                barcodes.length > 0 &&
                                barcodes[0]?.rawValue
                            ) {
                                onResult(barcodes[0].rawValue)
                                return
                            }
                        }

                        if (!nativeDetector && zxingReader) {
                            if (
                                canvas.width !== video.videoWidth ||
                                canvas.height !== video.videoHeight
                            ) {
                                canvas.width = video.videoWidth
                                canvas.height = video.videoHeight
                            }
                            if (ctx) {
                                ctx.drawImage(
                                    video,
                                    0,
                                    0,
                                    canvas.width,
                                    canvas.height,
                                )
                                const result =
                                    zxingReader.decodeFromCanvas(canvas)
                                if (result) {
                                    onResult(result.getText())
                                    return
                                }
                            }
                        }
                    } catch {
                        // Transient decode drops are ignored; scan continues
                    }
                }
            }

            if (!stopped) {
                if (typeof requestAnimationFrame === "function") {
                    animationFrameId = requestAnimationFrame(() => {
                        void scanFrame()
                    })
                } else {
                    pollTimeoutId = setTimeout(() => {
                        void scanFrame()
                    }, scanIntervalMs)
                }
            }
        }

        void scanFrame()

        return {
            stop: () => {
                if (stopped) return
                stopped = true
                if (torchTrack && torchEnabled) {
                    void setTorch(false).catch(() => undefined)
                }
                getStreamTracks(stream).forEach((track) => {
                    track.removeEventListener("ended", handleTrackEnded)
                })
                if (
                    animationFrameId !== null &&
                    typeof cancelAnimationFrame === "function"
                ) {
                    cancelAnimationFrame(animationFrameId)
                    animationFrameId = null
                }
                if (pollTimeoutId !== null) {
                    clearTimeout(pollTimeoutId)
                    pollTimeoutId = null
                }
                detachStream(video, stream)
            },
            torchAvailable,
            setTorch,
        }
    },
}
