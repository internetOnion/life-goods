import { beforeEach, describe, expect, test, vi } from "vitest"

const { controlsMock, getUserMediaMock, scanMock } = vi.hoisted(() => ({
    controlsMock: { stop: vi.fn() },
    getUserMediaMock: vi.fn(),
    scanMock: vi.fn(),
}))

vi.mock("@zxing/browser", () => ({
    BrowserMultiFormatOneDReader: vi.fn(() => ({
        scan: scanMock,
    })),
}))

import { barcodeScanner } from "../src/features/package-match/barcodeScanner"

type ScanCallback = (
    result: { getText: () => string } | undefined,
    error?: unknown,
) => void

function getScanCallback(): ScanCallback {
    const call = scanMock.mock.calls[0] as unknown[] | undefined
    const callback = call?.[1]
    if (typeof callback !== "function") {
        throw new Error("ZXing scan callback was not registered")
    }
    return callback as ScanCallback
}

function createVideoFrame(drawable = true) {
    const state = {
        height: drawable ? 720 : 0,
        readyState: drawable
            ? HTMLMediaElement.HAVE_CURRENT_DATA
            : HTMLMediaElement.HAVE_NOTHING,
        width: drawable ? 1280 : 0,
    }
    const play = vi.fn().mockResolvedValue(undefined)
    const video = document.createElement("video")
    Object.defineProperties(video, {
        play: { configurable: true, value: play },
        readyState: { configurable: true, get: () => state.readyState },
        srcObject: { configurable: true, value: null, writable: true },
        videoHeight: { configurable: true, get: () => state.height },
        videoWidth: { configurable: true, get: () => state.width },
    })
    return { play, state, video }
}

function createStream() {
    const track = { stop: vi.fn() }
    return { getTracks: () => [track], track }
}

describe("barcode scanner adapter", () => {
    beforeEach(() => {
        getUserMediaMock.mockReset().mockResolvedValue(createStream())
        scanMock.mockReset().mockReturnValue(controlsMock)
        controlsMock.stop.mockReset()
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia: getUserMediaMock },
        })
    })

    test("starts playback but waits for a drawable frame before decoding", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const { play, state, video } = createVideoFrame(false)

        const startPromise = barcodeScanner.start(video, vi.fn(), vi.fn())

        await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        expect(scanMock).not.toHaveBeenCalled()

        state.readyState = HTMLMediaElement.HAVE_CURRENT_DATA
        state.width = 1280
        state.height = 720
        video.dispatchEvent(new Event("loadeddata"))
        await startPromise

        expect(scanMock).toHaveBeenCalledWith(video, expect.any(Function))
    })

    test("requests the environment-facing camera and configures inline playback", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const { video } = createVideoFrame()

        await barcodeScanner.start(video, vi.fn(), vi.fn())

        expect(getUserMediaMock).toHaveBeenCalledWith({
            video: { facingMode: { ideal: "environment" } },
        })
        expect(video.muted).toBe(true)
        expect(video.playsInline).toBe(true)
        expect(video.autoplay).toBe(true)
        expect(video.srcObject).toBe(stream)
        expect(scanMock).toHaveBeenCalledWith(video, expect.any(Function))
    })

    test("falls back to a generic camera when facing mode is unsupported", async () => {
        const stream = createStream()
        getUserMediaMock
            .mockRejectedValueOnce(
                new DOMException("unsupported", "OverconstrainedError"),
            )
            .mockResolvedValueOnce(stream)
        const { video } = createVideoFrame()

        await barcodeScanner.start(video, vi.fn(), vi.fn())

        expect(getUserMediaMock).toHaveBeenNthCalledWith(2, { video: true })
        expect(video.srcObject).toBe(stream)
    })

    test("stops the scanner and stream exactly once", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const { video } = createVideoFrame()
        const session = await barcodeScanner.start(video, vi.fn(), vi.fn())

        session.stop()
        session.stop()

        expect(controlsMock.stop).toHaveBeenCalledTimes(1)
        expect(stream.track.stop).toHaveBeenCalledTimes(1)
        expect(video.srcObject).toBeNull()
    })

    test("forwards a decoded barcode result", async () => {
        const onResult = vi.fn()
        const { video } = createVideoFrame()
        await barcodeScanner.start(video, onResult, vi.fn())

        getScanCallback()({ getText: () => "4006381333931" })

        expect(onResult).toHaveBeenCalledWith("4006381333931")
    })

    test("forwards unexpected decoder errors while ignoring normal decode misses", async () => {
        const onError = vi.fn()
        const { video } = createVideoFrame()
        await barcodeScanner.start(video, vi.fn(), onError)
        const callback = getScanCallback()

        callback(undefined, { name: "NotFoundException" })
        callback(undefined, { name: "ChecksumException" })
        expect(onError).not.toHaveBeenCalled()

        const decoderError = { name: "ReaderException" }
        callback(undefined, decoderError)
        expect(onError).toHaveBeenCalledWith(decoderError)
    })

    test("cleans up when the preview never produces a drawable frame", async () => {
        vi.useFakeTimers()
        try {
            const stream = createStream()
            getUserMediaMock.mockResolvedValue(stream)
            const { play, video } = createVideoFrame(false)

            const startPromise = barcodeScanner.start(video, vi.fn(), vi.fn())
            const rejection = expect(startPromise).rejects.toMatchObject({
                name: "CameraPreviewError",
            })
            await vi.advanceTimersByTimeAsync(0)
            expect(play).toHaveBeenCalledTimes(1)

            await vi.advanceTimersByTimeAsync(5000)
            await rejection
            expect(scanMock).not.toHaveBeenCalled()
            expect(stream.track.stop).toHaveBeenCalledTimes(1)
            expect(video.srcObject).toBeNull()
        } finally {
            vi.useRealTimers()
        }
    })

    test("cleans up when video playback is rejected", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const { play, video } = createVideoFrame()
        play.mockRejectedValue(
            new DOMException("playback failed", "NotAllowedError"),
        )

        await expect(
            barcodeScanner.start(video, vi.fn(), vi.fn()),
        ).rejects.toMatchObject({ name: "CameraPreviewError" })

        expect(scanMock).not.toHaveBeenCalled()
        expect(stream.track.stop).toHaveBeenCalledTimes(1)
        expect(video.srcObject).toBeNull()
    })
})
