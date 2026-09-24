import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

export type CameraStreamStatus = "starting" | "ready" | "unavailable"
export type CameraStreamProblem = "unavailable" | "did_not_start" | "denied"

export interface CameraResolution {
    width: number
    height: number
}

export const DEFAULT_CAMERA_RESOLUTION: CameraResolution = {
    width: 1920,
    height: 1080,
}

const CAMERA_START_TIMEOUT_MS = 5000

function stopStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((track) => track.stop())
}

function releaseStream(
    video: HTMLVideoElement | null,
    stream: MediaStream | null,
) {
    stopStream(stream)
    if (!video) return
    if (stream && video.srcObject !== stream) return
    if (video.readyState > 0) {
        try {
            video.pause()
        } catch {
            // The video may already be detached during unmount.
        }
    }
    video.srcObject = null
}

export function hasVideoDimensions(video: HTMLVideoElement) {
    return video.videoWidth > 0 && video.videoHeight > 0
}

function waitForVideoReady(
    video: HTMLVideoElement,
    isCancelled: () => boolean,
): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false

        const cleanup = () => {
            video.removeEventListener("loadedmetadata", check)
            video.removeEventListener("canplay", check)
            video.removeEventListener("playing", check)
        }

        const finish = (ready: boolean) => {
            if (settled) return
            settled = true
            cleanup()
            resolve(ready)
        }

        const check = () => {
            if (isCancelled()) {
                finish(false)
            } else if (hasVideoDimensions(video)) {
                finish(true)
            }
        }

        check()
        if (settled) return

        video.addEventListener("loadedmetadata", check)
        video.addEventListener("canplay", check)
        video.addEventListener("playing", check)
    })
}

/** Draw the current video frame to a JPEG. Resolves null when the browser cannot encode it. */
export function captureVideoFrame(
    video: HTMLVideoElement,
    quality = 0.92,
): Promise<Blob | null> {
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) return Promise.resolve(null)
    return new Promise((resolve, reject) => {
        try {
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            canvas.toBlob(resolve, "image/jpeg", quality)
        } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)))
        }
    })
}

export interface CameraStream {
    status: CameraStreamStatus
    problem: CameraStreamProblem | null
    isVideoReady: boolean
    /** Stop the current stream (if any) and request a fresh one. */
    restart: () => void
    /** Stop the current stream and ignore any stream still starting. */
    release: () => void
}

/**
 * Own one rear-camera stream for a video element while `active` is true.
 *
 * The stream is released when `active` turns false, on unmount, on `release`, and
 * before every `restart`. A late getUserMedia response for a superseded run is
 * stopped instead of attached.
 */
export function useCameraStream(
    videoRef: RefObject<HTMLVideoElement | null>,
    {
        active,
        resolution = DEFAULT_CAMERA_RESOLUTION,
    }: { active: boolean; resolution?: CameraResolution },
): CameraStream {
    const streamRef = useRef<MediaStream | null>(null)
    const runRef = useRef(0)
    const [attempt, setAttempt] = useState(0)
    const [status, setStatus] = useState<CameraStreamStatus>("starting")
    const [problem, setProblem] = useState<CameraStreamProblem | null>(null)
    const [isVideoReady, setIsVideoReady] = useState(false)
    const { width, height } = resolution

    useEffect(() => {
        const video = videoRef.current

        if (!active) {
            releaseStream(video, streamRef.current)
            streamRef.current = null
            setIsVideoReady(false)
            setStatus("starting")
            setProblem(null)
            return
        }

        let cancelled = false
        const run = ++runRef.current
        setStatus("starting")
        setProblem(null)
        setIsVideoReady(false)

        const isSecure =
            typeof window.isSecureContext !== "boolean" ||
            window.isSecureContext
        const mediaDevices = navigator.mediaDevices

        if (!isSecure || !mediaDevices?.getUserMedia || !video) {
            setStatus("unavailable")
            setProblem("unavailable")
            return () => {
                cancelled = true
                releaseStream(video, streamRef.current)
                streamRef.current = null
            }
        }

        const fallbackTimer = window.setTimeout(() => {
            if (cancelled) return
            cancelled = true
            releaseStream(video, streamRef.current)
            streamRef.current = null
            setIsVideoReady(false)
            setStatus("unavailable")
            setProblem("did_not_start")
        }, CAMERA_START_TIMEOUT_MS)

        void mediaDevices
            .getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: width },
                    height: { ideal: height },
                },
            })
            .then(async (stream) => {
                if (cancelled || run !== runRef.current) {
                    stopStream(stream)
                    return
                }

                streamRef.current = stream
                video.srcObject = stream
                try {
                    void video.play().catch(() => undefined)
                } catch {
                    // Browsers may reject or synchronously throw when autoplay is unavailable.
                }

                const ready = await waitForVideoReady(
                    video,
                    () => cancelled || run !== runRef.current,
                )
                if (cancelled || run !== runRef.current) {
                    releaseStream(video, stream)
                    if (streamRef.current === stream) streamRef.current = null
                    return
                }

                window.clearTimeout(fallbackTimer)
                if (!ready) {
                    releaseStream(video, stream)
                    streamRef.current = null
                    setStatus("unavailable")
                    setProblem("did_not_start")
                    return
                }

                setIsVideoReady(true)
                setStatus("ready")
            })
            .catch(() => {
                window.clearTimeout(fallbackTimer)
                if (cancelled || run !== runRef.current) return
                setStatus("unavailable")
                setProblem("denied")
            })

        return () => {
            cancelled = true
            window.clearTimeout(fallbackTimer)
            releaseStream(video, streamRef.current)
            streamRef.current = null
        }
    }, [active, attempt, height, videoRef, width])

    const release = useCallback(() => {
        runRef.current += 1
        releaseStream(videoRef.current, streamRef.current)
        streamRef.current = null
    }, [videoRef])

    const restart = useCallback(() => {
        release()
        setIsVideoReady(false)
        setStatus("starting")
        setProblem(null)
        setAttempt((current) => current + 1)
    }, [release])

    return { status, problem, isVideoReady, restart, release }
}
