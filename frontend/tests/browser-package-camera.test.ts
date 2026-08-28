import { afterEach, describe, expect, test, vi } from "vitest"

import { createBrowserPackageCamera } from "../src/features/package-capture/browserPackageCamera"

describe("browser Package Capture camera", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    test("opens the environment camera and stops every track", async () => {
        const track = new EventTarget() as MediaStreamTrack
        const stop = vi.fn()
        track.stop = stop
        const stream = {
            getTracks: () => [track],
        } as unknown as MediaStream
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia },
        })
        const video = document.createElement("video")
        const camera = createBrowserPackageCamera()

        await camera.open(video)

        expect(getUserMedia).toHaveBeenCalledWith({
            audio: false,
            video: { facingMode: { ideal: "environment" } },
        })
        expect(video.srcObject).toBe(stream)

        camera.stop()
        expect(stop).toHaveBeenCalledOnce()
        expect(video.srcObject).toBeNull()
    })

    test("starts video playback after attaching the stream", async () => {
        const stream = {
            getTracks: () => [],
        } as unknown as MediaStream
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia },
        })
        const video = document.createElement("video")
        const play = vi.fn().mockResolvedValue(undefined)
        video.play = play
        const camera = createBrowserPackageCamera()

        await camera.open(video)

        expect(play).toHaveBeenCalledOnce()
    })

    test("reports a stream that ends unexpectedly", async () => {
        const track = new EventTarget() as MediaStreamTrack
        track.stop = vi.fn()
        const stream = {
            getTracks: () => [track],
        } as unknown as MediaStream
        vi.stubGlobal("navigator", {
            mediaDevices: {
                getUserMedia: vi.fn().mockResolvedValue(stream),
            },
        })
        const onInterrupted = vi.fn()
        const camera = createBrowserPackageCamera()

        await camera.open(document.createElement("video"), onInterrupted)
        track.dispatchEvent(new Event("ended"))

        expect(onInterrupted).toHaveBeenCalledOnce()
    })

    test("stops a camera stream that resolves after disposal", async () => {
        const track = new EventTarget() as MediaStreamTrack
        const stop = vi.fn()
        track.stop = stop
        const stream = {
            getTracks: () => [track],
        } as unknown as MediaStream
        let resolveStream: ((stream: MediaStream) => void) | undefined
        const getUserMedia = vi.fn(
            () =>
                new Promise<MediaStream>((resolve) => {
                    resolveStream = resolve
                }),
        )
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
        const camera = createBrowserPackageCamera()

        const opening = camera.open(document.createElement("video"))
        camera.dispose()
        resolveStream?.(stream)

        await expect(opening).rejects.toMatchObject({ name: "AbortError" })
        expect(stop).toHaveBeenCalledOnce()
    })

    test("captures a JPEG preview and revokes it on discard", async () => {
        const drawImage = vi.fn()
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            drawImage,
        } as unknown as CanvasRenderingContext2D)
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
            (callback) => callback(new Blob(["photo"], { type: "image/jpeg" })),
        )
        const createObjectURL = vi.fn().mockReturnValue("blob:front-photo")
        const revokeObjectURL = vi.fn()
        vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })
        const video = document.createElement("video")
        Object.defineProperties(video, {
            videoWidth: { value: 1280 },
            videoHeight: { value: 720 },
        })
        const camera = createBrowserPackageCamera()

        const photo = await camera.capture(video)

        expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720)
        expect(photo.previewUrl).toBe("blob:front-photo")
        expect(createObjectURL).toHaveBeenCalledWith(
            expect.objectContaining({ type: "image/jpeg" }),
        )

        camera.discard(photo)
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:front-photo")
    })
})
