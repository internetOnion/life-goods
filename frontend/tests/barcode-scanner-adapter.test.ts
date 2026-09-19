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

    test("supports Android-style torch capabilities after preview startup", async () => {
        const lifecycle: string[] = []
        const applyConstraintsMock = vi.fn().mockResolvedValue(undefined)
        const track = {
            addEventListener: vi.fn(),
            applyConstraints: applyConstraintsMock,
            getCapabilities: vi.fn(() => {
                lifecycle.push("capabilities")
                return { torch: [true, false] }
            }),
            kind: "video",
            removeEventListener: vi.fn(),
            stop: vi.fn(),
        }
        const stream = {
            getTracks: () => [track],
            getVideoTracks: () => [track],
        }
        getUserMediaMock.mockResolvedValue(stream)
        const { play, video } = createVideoFrame()
        play.mockImplementation(() => {
            lifecycle.push("play")
            return Promise.resolve()
        })

        const session = await barcodeScanner.start(video, vi.fn(), vi.fn())

        expect(session.torchAvailable).toBe(true)
        expect(lifecycle).toEqual(["play", "capabilities"])
        await session.setTorch(true)
        expect(applyConstraintsMock).toHaveBeenCalledWith({
            advanced: [{ torch: true }],
        })
        session.stop()
    })

    test.each([
        ["cannot turn on", { torch: [false] }],
        ["throws while reading", undefined],
        ["has no getCapabilities method", undefined],
    ])(
        "keeps torch unavailable when the camera %s",
        async (scenario, torch) => {
            const track = {
                addEventListener: vi.fn(),
                applyConstraints: vi.fn().mockResolvedValue(undefined),
                ...(scenario === "has no getCapabilities method"
                    ? {}
                    : {
                          getCapabilities:
                              scenario === "throws while reading"
                                  ? () => {
                                        throw new Error(
                                            "capabilities unavailable",
                                        )
                                    }
                                  : () => ({ torch }),
                      }),
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

            expect(session.torchAvailable).toBe(false)
            await expect(session.setTorch(true)).rejects.toMatchObject({
                name: "NotSupportedError",
            })
            session.stop()
        },
    )

    test("propagates torch constraint failures", async () => {
        const applyConstraintsMock = vi
            .fn()
            .mockRejectedValue(
                new DOMException("torch failed", "OverconstrainedError"),
            )
        const track = {
            addEventListener: vi.fn(),
            applyConstraints: applyConstraintsMock,
            getCapabilities: () => ({ torch: [true, false] }),
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

        await expect(session.setTorch(true)).rejects.toMatchObject({
            name: "OverconstrainedError",
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

    test("rejects a camera request that does not settle before its acquisition deadline", async () => {
        vi.useFakeTimers()
        try {
            getUserMediaMock.mockReturnValue(new Promise(() => undefined))
            const { video } = createVideoFrame()

            const startPromise = barcodeScanner.start(video, vi.fn(), vi.fn(), {
                acquisitionTimeoutMs: 5000,
            })
            const rejection = expect(startPromise).rejects.toMatchObject({
                name: "CameraStartTimeoutError",
            })

            await vi.advanceTimersByTimeAsync(5000)
            await rejection
            expect(video.srcObject).toBeNull()
        } finally {
            vi.useRealTimers()
        }
    })

    test("cancels preview startup and releases its stream", async () => {
        const stream = createStream()
        getUserMediaMock.mockResolvedValue(stream)
        const { play, video } = createVideoFrame(false)
        const abortController = new AbortController()

        const startPromise = barcodeScanner.start(video, vi.fn(), vi.fn(), {
            signal: abortController.signal,
        })
        await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        abortController.abort()

        await expect(startPromise).rejects.toMatchObject({ name: "AbortError" })
        expect(stream.track.stop).toHaveBeenCalledTimes(1)
        expect(video.srcObject).toBeNull()
    })

    test("stops a late timed-out stream without disturbing a newer session", async () => {
        vi.useFakeTimers()
        try {
            let resolveFirst: (
                stream: ReturnType<typeof createStream>,
            ) => void = () => undefined
            const firstStream = createStream()
            const secondStream = createStream()
            getUserMediaMock
                .mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            resolveFirst = resolve
                        }),
                )
                .mockResolvedValueOnce(secondStream)
            const { video } = createVideoFrame()

            const firstStart = barcodeScanner.start(video, vi.fn(), vi.fn(), {
                acquisitionTimeoutMs: 5000,
            })
            const firstRejection = expect(firstStart).rejects.toMatchObject({
                name: "CameraStartTimeoutError",
            })
            await vi.advanceTimersByTimeAsync(5000)
            await firstRejection

            const secondSession = await barcodeScanner.start(
                video,
                vi.fn(),
                vi.fn(),
                { acquisitionTimeoutMs: 5000 },
            )
            expect(video.srcObject).toBe(secondStream)

            resolveFirst(firstStream)
            await Promise.resolve()
            await Promise.resolve()

            expect(firstStream.track.stop).toHaveBeenCalledTimes(1)
            expect(secondStream.track.stop).not.toHaveBeenCalled()
            expect(video.srcObject).toBe(secondStream)
            secondSession.stop()
        } finally {
            vi.useRealTimers()
        }
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
