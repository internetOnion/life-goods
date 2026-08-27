export type CapturedPackagePhoto = {
    previewUrl: string
}

export type PackageCamera = {
    open(video: HTMLVideoElement, onInterrupted?: () => void): Promise<void>
    capture(video: HTMLVideoElement): Promise<CapturedPackagePhoto>
    stop(): void
    discard(photo: CapturedPackagePhoto): void
    dispose(): void
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
    audio: false,
    video: { facingMode: { ideal: "environment" } },
}

export function createBrowserPackageCamera(): PackageCamera {
    let activeStream: MediaStream | null = null
    let activeVideo: HTMLVideoElement | null = null
    let removeInterruptionListeners: (() => void) | null = null
    let operationVersion = 0
    const previewUrls = new Set<string>()

    const stop = () => {
        operationVersion += 1
        removeInterruptionListeners?.()
        removeInterruptionListeners = null
        activeStream?.getTracks().forEach((track) => track.stop())
        activeStream = null
        if (activeVideo) activeVideo.srcObject = null
        activeVideo = null
    }

    const discard = (photo: CapturedPackagePhoto) => {
        if (!previewUrls.delete(photo.previewUrl)) return
        URL.revokeObjectURL(photo.previewUrl)
    }

    return {
        async open(video, onInterrupted) {
            stop()
            const openVersion = operationVersion
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new DOMException(
                    "Camera capture is not supported on this device.",
                    "NotSupportedError",
                )
            }

            const stream =
                await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
            if (openVersion !== operationVersion) {
                stream.getTracks().forEach((track) => track.stop())
                throw new DOMException(
                    "The camera request was cancelled.",
                    "AbortError",
                )
            }
            activeStream = stream
            activeVideo = video
            video.srcObject = stream
            if (onInterrupted) {
                const tracks = stream.getTracks()
                tracks.forEach((track) =>
                    track.addEventListener("ended", onInterrupted),
                )
                removeInterruptionListeners = () =>
                    tracks.forEach((track) =>
                        track.removeEventListener("ended", onInterrupted),
                    )
            }
        },

        async capture(video) {
            const captureVersion = operationVersion
            const width = video.videoWidth
            const height = video.videoHeight
            if (!width || !height) {
                throw new DOMException(
                    "The camera frame is not ready.",
                    "InvalidStateError",
                )
            }

            const canvas = document.createElement("canvas")
            canvas.width = width
            canvas.height = height
            const context = canvas.getContext("2d")
            if (!context) {
                throw new DOMException(
                    "This browser cannot capture a camera frame.",
                    "NotSupportedError",
                )
            }
            context.drawImage(video, 0, 0, width, height)

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (capturedBlob) => {
                        if (capturedBlob) resolve(capturedBlob)
                        else
                            reject(
                                new DOMException(
                                    "The camera frame could not be captured.",
                                    "EncodingError",
                                ),
                            )
                    },
                    "image/jpeg",
                    0.9,
                )
            })
            if (captureVersion !== operationVersion) {
                throw new DOMException(
                    "The photo capture was cancelled.",
                    "AbortError",
                )
            }
            const previewUrl = URL.createObjectURL(blob)
            previewUrls.add(previewUrl)
            return { previewUrl }
        },

        stop,
        discard,
        dispose() {
            stop()
            previewUrls.forEach((url) => URL.revokeObjectURL(url))
            previewUrls.clear()
        },
    }
}
