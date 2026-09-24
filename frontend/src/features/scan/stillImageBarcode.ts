/**
 * Decode a Barcode from a still label photo on the device (SPEC section 29.2).
 *
 * Only a GTIN that passes check-digit validation is returned. The photo is never
 * uploaded here, and the decoded Barcode must never travel with a photo submission.
 */
import {
    getNativeDetector,
    loadZxingReader,
    withTimeout,
} from "./barcodeDecoders"
import { validateIdentifier } from "./identifier"

/** Long-edge cap for the bundled decoder; full-resolution photos are slow on phones. */
export const MAX_DECODE_EDGE = 1600
const NATIVE_DETECT_TIMEOUT_MS = 1500

function firstValidBarcode(values: Iterable<string>): string | null {
    for (const value of values) {
        const validation = validateIdentifier(value)
        if (validation.valid) return validation.value
    }
    return null
}

function drawScaled(
    bitmap: ImageBitmap,
    rotateQuarterTurn: boolean,
): HTMLCanvasElement | null {
    const scale = Math.min(
        1,
        MAX_DECODE_EDGE / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = rotateQuarterTurn ? height : width
    canvas.height = rotateQuarterTurn ? width : height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return null
    if (rotateQuarterTurn) {
        context.translate(canvas.width, 0)
        context.rotate(Math.PI / 2)
    }
    context.drawImage(bitmap, 0, 0, width, height)
    return canvas
}

async function decodeWithNativeDetector(
    bitmap: ImageBitmap,
): Promise<string | null> {
    const detector = await getNativeDetector()
    if (!detector) return null
    try {
        const barcodes = await withTimeout(
            detector.detect(bitmap),
            NATIVE_DETECT_TIMEOUT_MS,
            "Native still-image detection timed out",
        )
        return firstValidBarcode(barcodes.map((barcode) => barcode.rawValue))
    } catch {
        return null
    }
}

async function decodeWithZxing(
    bitmap: ImageBitmap,
    isAborted: () => boolean,
): Promise<string | null> {
    let reader: Awaited<ReturnType<typeof loadZxingReader>>
    try {
        reader = await loadZxingReader()
    } catch {
        return null
    }
    for (const rotate of [false, true]) {
        if (isAborted()) return null
        const canvas = drawScaled(bitmap, rotate)
        if (!canvas) return null
        try {
            const value = firstValidBarcode([
                reader.decodeFromCanvas(canvas).getText(),
            ])
            if (value) return value
        } catch {
            // No barcode found in this orientation.
        }
    }
    return null
}

/**
 * Resolve the photo's Barcode, or null when none is readable, the photo cannot be
 * decoded (for example HEIC outside Safari), or the signal aborts.
 */
export async function decodeBarcodeFromImage(
    photo: Blob,
    { signal }: { signal?: AbortSignal } = {},
): Promise<string | null> {
    const isAborted = () => signal?.aborted === true
    if (isAborted() || typeof createImageBitmap !== "function") return null

    let bitmap: ImageBitmap | null = null
    try {
        bitmap = await createImageBitmap(photo)
        if (isAborted()) return null
        const native = await decodeWithNativeDetector(bitmap)
        if (isAborted()) return null
        if (native) return native
        const fallback = await decodeWithZxing(bitmap, isAborted)
        return isAborted() ? null : fallback
    } catch {
        return null
    } finally {
        bitmap?.close()
    }
}
