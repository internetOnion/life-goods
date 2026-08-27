import type {
    BrowserMultiFormatOneDReader,
    IScannerControls,
} from "@zxing/browser"

type DecodeCallback = Parameters<
    BrowserMultiFormatOneDReader["decodeFromConstraints"]
>[2]

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

const ignoredDecodeErrors = new Set([
    "ChecksumException",
    "FormatException",
    "NotFoundException",
])

function isIgnoredDecodeError(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        typeof error.name === "string" &&
        ignoredDecodeErrors.has(error.name)
    )
}

const preferredCameraConstraints: MediaStreamConstraints = {
    video: { facingMode: { ideal: "environment" } },
}
const previewReadyTimeoutMs = 5000
const previewReadyEvents = ["loadeddata", "canplay", "playing", "resize"]

class CameraPreviewError extends Error {
    override name = "CameraPreviewError"
}

function errorName(error: unknown) {
    return typeof error === "object" && error !== null && "name" in error
        ? error.name
        : undefined
}

function isUnsupportedCameraConstraint(error: unknown) {
    const name = errorName(error)
    return (
        name === "OverconstrainedError" ||
        name === "ConstraintNotSatisfiedError"
    )
}

async function getCameraStream() {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.getUserMedia) {
        throw new DOMException("Camera API is unavailable", "NotSupportedError")
    }

    try {
        return await mediaDevices.getUserMedia(preferredCameraConstraints)
    } catch (error) {
        if (!isUnsupportedCameraConstraint(error)) throw error
        return mediaDevices.getUserMedia({ video: true })
    }
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
        let playbackStarted = false
        let settled = false
        const cleanup = () => {
            clearTimeout(timeout)
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
        const checkReady = () => {
            if (playbackStarted && hasDrawableFrame(video)) finish()
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

        try {
            void video.play().then(() => {
                playbackStarted = true
                checkReady()
            }, failPlayback)
        } catch (error) {
            failPlayback(error)
        }
    })
}

function stopStream(stream: MediaStream) {
    stream.getTracks().forEach((track) => track.stop())
}

function detachStream(video: HTMLVideoElement, stream: MediaStream) {
    stopStream(stream)
    if (video.srcObject === stream) video.srcObject = null
}

export const barcodeScanner: BarcodeScanner = {
    async start(video, onResult, onError) {
        const stream = await getCameraStream()

        video.muted = true
        video.playsInline = true
        video.autoplay = true
        video.srcObject = stream

        let controls: IScannerControls
        let stopped = false

        const callback: DecodeCallback = (result, error) => {
            if (stopped) return
            if (result) {
                onResult(result.getText())
                return
            }
            if (error && !isIgnoredDecodeError(error)) onError(error)
        }

        try {
            await startVideoPreview(video)
            const { BrowserMultiFormatOneDReader } =
                await import("@zxing/browser")
            const reader = new BrowserMultiFormatOneDReader()
            controls = reader.scan(video, callback)
        } catch (error) {
            detachStream(video, stream)
            throw error
        }

        return {
            stop: () => {
                if (stopped) return
                stopped = true
                try {
                    controls.stop()
                } finally {
                    detachStream(video, stream)
                }
            },
        }
    },
}
