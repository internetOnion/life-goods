/** Barcode decoders shared by the live scanner and still-photo decoding. */
import type { BrowserMultiFormatOneDReader } from "@zxing/browser"

const nativeDetectorTimeoutMs = 600
export const nativeDetectFrameTimeoutMs = 250

export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false
        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            reject(new Error(errorMessage))
        }, timeoutMs)

        promise.then(
            (val) => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                resolve(val)
            },
            (err: unknown) => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                reject(err instanceof Error ? err : new Error(String(err)))
            },
        )
    })
}

export type NativeDetector = {
    detect: (
        source: ImageBitmapSource | HTMLVideoElement | HTMLCanvasElement,
    ) => Promise<Array<{ rawValue: string }>>
}

export async function getNativeDetector(): Promise<NativeDetector | null> {
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
        return null
    }
    try {
        const formatsPromise = (
            window as unknown as {
                BarcodeDetector: {
                    getSupportedFormats: () => Promise<string[]>
                }
            }
        ).BarcodeDetector.getSupportedFormats()

        const formats = await withTimeout(
            formatsPromise,
            nativeDetectorTimeoutMs,
            "BarcodeDetector format detection timed out",
        )
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

/** Lazy-load the bundled one-dimensional barcode decoder. */
export function loadZxingReader(): Promise<BrowserMultiFormatOneDReader> {
    return import("@zxing/browser").then(
        ({ BrowserMultiFormatOneDReader }) =>
            new BrowserMultiFormatOneDReader(),
    )
}
