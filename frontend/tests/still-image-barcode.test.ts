import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const { decodeFromCanvasMock } = vi.hoisted(() => ({
    decodeFromCanvasMock: vi.fn(),
}))

vi.mock("@zxing/browser", () => ({
    BrowserMultiFormatOneDReader: vi.fn(() => ({
        decodeFromCanvas: decodeFromCanvasMock,
    })),
}))

import { decodeBarcodeFromImage } from "../src/features/scan/stillImageBarcode"

const VALID_EAN = "8850999320014"
const INVALID_EAN = "8850999320015"

function stubBitmap(width = 4000, height = 3000) {
    const close = vi.fn()
    const createImageBitmapMock = vi.fn().mockResolvedValue({
        width,
        height,
        close,
    })
    vi.stubGlobal("createImageBitmap", createImageBitmapMock)
    return { close, createImageBitmapMock }
}

function stubNativeDetector(values: string[] | Error) {
    const detect =
        values instanceof Error
            ? vi.fn().mockRejectedValue(values)
            : vi
                  .fn()
                  .mockResolvedValue(values.map((rawValue) => ({ rawValue })))
    const BarcodeDetectorMock = vi.fn().mockImplementation(() => ({ detect }))
    Object.assign(BarcodeDetectorMock, {
        getSupportedFormats: vi.fn().mockResolvedValue(["ean_13", "upc_a"]),
    })
    vi.stubGlobal("BarcodeDetector", BarcodeDetectorMock)
    return detect
}

const photo = new Blob(["jpeg"], { type: "image/jpeg" })

describe("decodeBarcodeFromImage", () => {
    beforeEach(() => {
        decodeFromCanvasMock.mockReset()
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            drawImage: vi.fn(),
            rotate: vi.fn(),
            translate: vi.fn(),
        } as unknown as RenderingContext)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    test("returns a check-digit-valid Barcode from the native detector", async () => {
        const { close } = stubBitmap()
        const detect = stubNativeDetector([INVALID_EAN, VALID_EAN])

        await expect(decodeBarcodeFromImage(photo)).resolves.toBe(VALID_EAN)
        expect(detect).toHaveBeenCalledTimes(1)
        expect(decodeFromCanvasMock).not.toHaveBeenCalled()
        expect(close).toHaveBeenCalled()
    })

    test("falls back to zxing on a downscaled copy, then a rotated copy", async () => {
        stubBitmap(4000, 3000)
        stubNativeDetector(new Error("detector failed"))
        const widths: number[] = []
        decodeFromCanvasMock.mockImplementation((canvas: HTMLCanvasElement) => {
            widths.push(canvas.width)
            if (widths.length === 1) throw new Error("NotFoundException")
            return { getText: () => VALID_EAN }
        })

        await expect(decodeBarcodeFromImage(photo)).resolves.toBe(VALID_EAN)
        expect(widths).toEqual([1600, 1200])
    })

    test("never returns a value that fails check-digit validation", async () => {
        stubBitmap()
        stubNativeDetector([INVALID_EAN])
        decodeFromCanvasMock.mockReturnValue({ getText: () => INVALID_EAN })

        await expect(decodeBarcodeFromImage(photo)).resolves.toBeNull()
    })

    test("resolves null when the photo cannot be decoded, such as HEIC", async () => {
        vi.stubGlobal(
            "createImageBitmap",
            vi.fn().mockRejectedValue(new DOMException("unsupported")),
        )
        stubNativeDetector([VALID_EAN])

        await expect(decodeBarcodeFromImage(photo)).resolves.toBeNull()
    })

    test("resolves null without decoding once the signal aborts", async () => {
        const { createImageBitmapMock } = stubBitmap()
        const detect = stubNativeDetector([VALID_EAN])
        const controller = new AbortController()
        controller.abort()

        await expect(
            decodeBarcodeFromImage(photo, { signal: controller.signal }),
        ).resolves.toBeNull()
        expect(createImageBitmapMock).not.toHaveBeenCalled()
        expect(detect).not.toHaveBeenCalled()
    })
})
