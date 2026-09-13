import { beforeEach, describe, expect, test, vi } from "vitest"

const { decodeFromCanvasMock, getUserMediaMock } = vi.hoisted(() => ({
    decodeFromCanvasMock: vi.fn(),
    getUserMediaMock: vi.fn(),
}))

vi.mock("@zxing/browser", () => ({
    BrowserMultiFormatOneDReader: vi.fn(() => ({
        decodeFromCanvas: decodeFromCanvasMock,
    })),
}))

import { barcodeScanner } from "../src/features/scan/barcodeScanner"

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
    const track = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        stop: vi.fn(),
    }
    return {
        getTracks: () => [track],
        getVideoTracks: () => [track],
        track,
    }
}

describe("barcode scanner adapter", () => {
    beforeEach(() => {
        getUserMediaMock.mockReset().mockResolvedValue(createStream())
        decodeFromCanvasMock.mockReset()
        vi.stubGlobal("navigator", {
            mediaDevices: { getUserMedia: getUserMediaMock },
        })
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            drawImage: vi.fn(),
        } as unknown as RenderingContext)
    })

    test("starts playback and begins scanning when a drawable frame is ready", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const { play, state, video } = createVideoFrame(false)

        const startPromise = barcodeScanner.start(video, vi.fn(), vi.fn())

        await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        state.readyState = HTMLMediaElement.HAVE_CURRENT_DATA
        state.width = 1280
        state.height = 720
        video.dispatchEvent(new Event("loadeddata"))
        const session = await startPromise

        await vi.waitFor(() => expect(decodeFromCanvasMock).toHaveBeenCalled())
        session.stop()
    })

    test("requests the environment-facing camera and configures inline playback", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const { video } = createVideoFrame()

        const session = await barcodeScanner.start(video, vi.fn(), vi.fn())

        expect(getUserMediaMock).toHaveBeenCalledWith({
            audio: false,
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
        })
        expect(video.muted).toBe(true)
        expect(video.playsInline).toBe(true)
        expect(video.autoplay).toBe(true)
        expect(video.srcObject).toBe(stream)
        session.stop()
    })

    test("exposes torch control for cameras that support it", async () => {
        const applyConstraintsMock = vi.fn().mockResolvedValue(undefined)
        const track = {
            addEventListener: vi.fn(),
            applyConstraints: applyConstraintsMock,
            getCapabilities: () => ({ torch: true }),
            kind: "video",
            removeEventListener: vi.fn(),
            stop: vi.fn(),
        }
        const stream = {
            getTracks: () => [track],
            getVideoTracks: () => [track],
        }
        getUserMediaMock.mockResolvedValue(stream)
        const { video } = createVideoFrame()

        const session = await barcodeScanner.start(video, vi.fn(), vi.fn())

        expect(session.torchAvailable).toBe(true)
        await session.setTorch(true)
        expect(applyConstraintsMock).toHaveBeenNthCalledWith(1, {
            advanced: [{ torch: true }],
        })
        session.stop()
    })

    test("falls back progressively when high resolution or ideal facing mode is rejected", async () => {
        const stream = createStream()
        getUserMediaMock
            .mockRejectedValueOnce(
                new DOMException("overconstrained", "OverconstrainedError"),
            )
            .mockResolvedValueOnce(stream)
        const { video } = createVideoFrame()

        const session = await barcodeScanner.start(video, vi.fn(), vi.fn())

        expect(getUserMediaMock).toHaveBeenNthCalledWith(1, {
            audio: false,
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
        })
        expect(getUserMediaMock).toHaveBeenNthCalledWith(2, {
            audio: false,
            video: { facingMode: { ideal: "environment" } },
        })
        expect(video.srcObject).toBe(stream)
        session.stop()
    })

    test("stops the scanner loop and stream tracks on session stop", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const { video } = createVideoFrame()
        const session = await barcodeScanner.start(video, vi.fn(), vi.fn())

        session.stop()
        session.stop()

        expect(stream.track.stop).toHaveBeenCalledTimes(1)
        expect(video.srcObject).toBeNull()
    })

    test("reuses a briefly suspended camera stream when startup resumes", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const firstVideo = createVideoFrame().video
        const firstSession = await barcodeScanner.start(
            firstVideo,
            vi.fn(),
            vi.fn(),
        )

        firstSession.suspend?.()

        const secondVideo = createVideoFrame().video
        const secondSession = await barcodeScanner.start(
            secondVideo,
            vi.fn(),
            vi.fn(),
        )

        expect(getUserMediaMock).toHaveBeenCalledTimes(1)
        expect(secondVideo.srcObject).toBe(stream)
        expect(stream.track.stop).not.toHaveBeenCalled()

        secondSession.stop()
        expect(stream.track.stop).toHaveBeenCalledTimes(1)
    })

    test("forwards a decoded barcode result from canvas scanning", async () => {
        const onResult = vi.fn()
        decodeFromCanvasMock.mockReturnValue({ getText: () => "4006381333931" })
        const { video } = createVideoFrame()

        const session = await barcodeScanner.start(video, onResult, vi.fn())

        await vi.waitFor(() =>
            expect(onResult).toHaveBeenCalledWith("4006381333931"),
        )
        session.stop()
    })

    test("uses native BarcodeDetector when supported in browser", async () => {
        const detectMock = vi
            .fn()
            .mockResolvedValue([{ rawValue: "4006381333931" }])
        const BarcodeDetectorMock = vi.fn().mockImplementation(() => ({
            detect: detectMock,
        }))
        Object.assign(BarcodeDetectorMock, {
            getSupportedFormats: vi
                .fn()
                .mockResolvedValue(["ean_13", "qr_code"]),
        })
        vi.stubGlobal("BarcodeDetector", BarcodeDetectorMock)

        try {
            const onResult = vi.fn()
            const { video } = createVideoFrame()

            const session = await barcodeScanner.start(video, onResult, vi.fn())

            await vi.waitFor(() =>
                expect(onResult).toHaveBeenCalledWith("4006381333931"),
            )
            expect(detectMock).toHaveBeenCalledWith(video)
            session.stop()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    test("falls back to zxing if native BarcodeDetector hangs or times out", async () => {
        const BarcodeDetectorMock = vi.fn()
        Object.assign(BarcodeDetectorMock, {
            getSupportedFormats: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves!
        })
        vi.stubGlobal("BarcodeDetector", BarcodeDetectorMock)

        try {
            const onResult = vi.fn()
            decodeFromCanvasMock.mockReturnValue({
                getText: () => "4006381333931",
            })
            const { video } = createVideoFrame()

            const session = await barcodeScanner.start(video, onResult, vi.fn())

            await vi.waitFor(() =>
                expect(onResult).toHaveBeenCalledWith("4006381333931"),
            )
            session.stop()
        } finally {
            vi.unstubAllGlobals()
        }
    }, 2000)

    test("does not hold camera startup on native detector capability detection", async () => {
        const BarcodeDetectorMock = vi.fn()
        Object.assign(BarcodeDetectorMock, {
            getSupportedFormats: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves!
        })
        vi.stubGlobal("BarcodeDetector", BarcodeDetectorMock)

        try {
            const { video } = createVideoFrame()
            const startPromise = barcodeScanner.start(video, vi.fn(), vi.fn())
            const startupResult = await Promise.race([
                startPromise.then(() => "started" as const),
                new Promise<"timed-out">((resolve) => {
                    setTimeout(() => resolve("timed-out"), 100)
                }),
            ])

            expect(startupResult).toBe("started")
            ;(await startPromise).stop()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    test("falls back to zxing if native BarcodeDetector detect hangs or throws", async () => {
        const detectMock = vi.fn().mockReturnValue(new Promise(() => {})) // detect hangs!
        const BarcodeDetectorMock = vi.fn().mockImplementation(() => ({
            detect: detectMock,
        }))
        Object.assign(BarcodeDetectorMock, {
            getSupportedFormats: vi
                .fn()
                .mockResolvedValue(["ean_13", "qr_code"]),
        })
        vi.stubGlobal("BarcodeDetector", BarcodeDetectorMock)

        try {
            const onResult = vi.fn()
            decodeFromCanvasMock.mockReturnValue({
                getText: () => "4006381333931",
            })
            const { video } = createVideoFrame()

            const session = await barcodeScanner.start(video, onResult, vi.fn())

            await vi.waitFor(
                () => expect(onResult).toHaveBeenCalledWith("4006381333931"),
                { timeout: 2000 },
            )
            session.stop()
        } finally {
            vi.unstubAllGlobals()
        }
    }, 3000)

    test("ignores normal frame decode misses without stopping the session", async () => {
        decodeFromCanvasMock.mockImplementation(() => {
            throw new Error("NotFoundException")
        })
        const onResult = vi.fn()
        const onError = vi.fn()
        const { video } = createVideoFrame()

        const session = await barcodeScanner.start(video, onResult, onError)

        await vi.waitFor(() => expect(decodeFromCanvasMock).toHaveBeenCalled())
        expect(onError).not.toHaveBeenCalled()
        expect(onResult).not.toHaveBeenCalled()
        session.stop()
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

        expect(stream.track.stop).toHaveBeenCalledTimes(1)
        expect(video.srcObject).toBeNull()
    })
})
