import type { BrowserMultiFormatOneDReader } from "@zxing/browser"

export type BarcodeScannerError = unknown

export type BarcodeScannerSession = {
    stop: () => void
}

export type BarcodeScanner = {
    start: (
        video: HTMLVideoElement,
        onResult: (value: string) => void,
        onError: (error: BarcodeScannerError) => void,
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

const constraintStages: MediaStreamConstraints[] = [
    {
        audio: false,
        video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
        },
    },
    {
        audio: false,
        video: {
            facingMode: { ideal: "environment" },
        },
    },
    {
        audio: false,
        video: {
            facingMode: "environment",
        },
    },
    {
        audio: false,
        video: true,
    },
]

async function acquireMediaStream(): Promise<MediaStream> {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.getUserMedia) {
        throw new DOMException("Camera API is unavailable", "NotSupportedError")
    }

    let lastError: unknown = null
    for (const constraints of constraintStages) {
        try {
            return await mediaDevices.getUserMedia(constraints)
        } catch (error) {
            lastError = error
            const name =
                typeof error === "object" && error !== null && "name" in error
                    ? error.name
                    : undefined
            if (
                name === "NotAllowedError" ||
                name === "SecurityError" ||
                name === "PermissionDeniedError"
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

function hasDrawableFrame(video: HTMLVideoElement) {
    return (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
    )
}

function startVideoPreview(video: HTMLVideoElement) {
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
        }

        const finish = (error?: CameraPreviewError) => {
            if (settled) return
            settled = true
            cleanup()
            if (error) reject(error)
            else resolve()
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

        if (
            "requestVideoFrameCallback" in video &&
            typeof video.requestVideoFrameCallback === "function"
        ) {
            frameCallbackId = video.requestVideoFrameCallback(() => {
                checkReady()
            })
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
        } else if (typeof setInterval === "function") {
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

function stopStream(stream: MediaStream) {
    getStreamTracks(stream).forEach((track) => track.stop())
}

function detachStream(video: HTMLVideoElement, stream: MediaStream) {
    stopStream(stream)
    if (video.srcObject === stream) video.srcObject = null
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
        const formats = await (
            window as unknown as {
                BarcodeDetector: {
                    getSupportedFormats: () => Promise<string[]>
                }
            }
        ).BarcodeDetector.getSupportedFormats()
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
    async start(video, onResult, onError) {
        const stream = await acquireMediaStream()

        video.muted = true
        video.playsInline = true
        video.setAttribute("playsinline", "true")
        video.setAttribute("webkit-playsinline", "true")
        video.autoplay = true
        video.srcObject = stream

        let nativeDetector: NativeDetector | null = null
        let zxingReader: BrowserMultiFormatOneDReader | null = null

        try {
            await startVideoPreview(video)
            nativeDetector = await getNativeDetector()
            if (!nativeDetector) {
                const { BrowserMultiFormatOneDReader } =
                    await import("@zxing/browser")
                zxingReader = new BrowserMultiFormatOneDReader()
            }
        } catch (error) {
            detachStream(video, stream)
            throw error
        }

        let stopped = false
        let animationFrameId: number | null = null
        let pollTimeoutId: ReturnType<typeof setTimeout> | null = null
        let lastScanTimestamp = 0
        const scanIntervalMs = 50

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
                            const barcodes = await nativeDetector.detect(video)
                            if (
                                barcodes &&
                                barcodes.length > 0 &&
                                barcodes[0]?.rawValue
                            ) {
                                onResult(barcodes[0].rawValue)
                                return
                            }
                        }

                        if (zxingReader) {
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
        }
    },
}
